import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Server-side API for the Field Crew app (/field) and staff time-off page.
// All reads and writes go through here with the service role after verifying
// the company login (the same AdminUser session as the office backend — crew
// are NOT Base44 dashboard users), so the field entities can be RLS-locked
// without breaking the app, and ownership rules (crew can only touch their
// own records) are enforced server-side instead of trusted to the browser.

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

// Any ACTIVE AdminUser may use the field app — crew clock in, office staff
// request time off. No area permission required; ownership rules below keep
// everyone limited to their own records.
async function verifyEmployeeSession(req, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Unauthorized');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  return { base44, user };
}

function stripProject(p) {
  if (!p) return p;
  // Field crew don't need the customer's signed-approval token
  const { approval_token, ...rest } = p;
  return rest;
}

function userName(user) {
  return user.name || user.full_name || user.email;
}

function todayStr() {
  // Job sites are US Eastern — date-stamp entries in that zone, not UTC
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

const str = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const strOrNull = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : null);

function cleanGps(gps) {
  if (!gps || typeof gps !== 'object') return null;
  const { lat, lng, accuracy } = gps;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng, accuracy: typeof accuracy === 'number' ? accuracy : 0 };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    let base44, user;
    try {
      ({ base44, user } = await verifyEmployeeSession(req, body));
    } catch (authErr) {
      const status = authErr.message === 'Forbidden' ? 403 : 401;
      return Response.json({ error: 'Please sign in with your company login.' }, { status });
    }

    const svc = base44.asServiceRole.entities;
    const { action } = body;

    // ── Projects ──────────────────────────────────────────────────────────
    if (action === 'list') {
      const projects = await svc.ContractorProject.filter({ status: 'in_progress' });
      return Response.json({ projects: projects.map(stripProject) });
    }

    if (action === 'get') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      const projects = await svc.ContractorProject.filter({ id: body.id });
      return Response.json({ project: stripProject(projects[0] || null) });
    }

    if (action === 'updateChecklist') {
      if (!body.id || !Array.isArray(body.material_checklist)) {
        return Response.json({ error: 'id and material_checklist required' }, { status: 400 });
      }
      const projects = await svc.ContractorProject.filter({ id: body.id });
      const project = projects[0];
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      if (project.status !== 'in_progress') {
        return Response.json({ error: 'Checklist can only be updated on active projects' }, { status: 403 });
      }

      // Merge ONLY the ordered/received tracking flags onto the existing
      // checklist — the client used to be able to replace (or wipe) the whole
      // list on any project it could name.
      const incoming = new Map(
        body.material_checklist
          .filter((i) => i && typeof i.id === 'string')
          .map((i) => [i.id, i])
      );
      const merged = (project.material_checklist || []).map((item) => {
        const u = incoming.get(item.id);
        if (!u) return item;
        return {
          ...item,
          ordered: !!u.ordered,
          ordered_at: strOrNull(u.ordered_at, 40),
          ordered_by: strOrNull(u.ordered_by, 120),
          received: !!u.received,
          received_at: strOrNull(u.received_at, 40),
          received_by: strOrNull(u.received_by, 120),
        };
      });

      const updated = await svc.ContractorProject.update(body.id, {
        material_checklist: merged,
      });
      return Response.json({ project: stripProject(updated) });
    }

    // ── My schedule ───────────────────────────────────────────────────────
    if (action === 'mySchedule') {
      // Tomorrow's job site stays hidden until the night before — it unlocks
      // at 5pm ET so the office can shuffle the board during the day.
      const today = todayStr();
      const hourET = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(new Date())
      );
      const tomorrowUnlocked = hourET >= 17;
      const t = new Date(`${today}T12:00:00Z`);
      t.setUTCDate(t.getUTCDate() + 1);
      const tomorrow = t.toISOString().slice(0, 10);
      const [todayAssignments, tomorrowAssignments] = await Promise.all([
        svc.CrewAssignment.filter({ user_id: user.id, date: today }),
        tomorrowUnlocked ? svc.CrewAssignment.filter({ user_id: user.id, date: tomorrow }) : Promise.resolve([]),
      ]);
      return Response.json({
        today: todayAssignments,
        tomorrow: tomorrowAssignments,
        tomorrowUnlocked,
        dates: { today, tomorrow },
      });
    }

    // ── Tasks ─────────────────────────────────────────────────────────────
    if (action === 'listTasks') {
      const tasks = await svc.FieldTask.filter({ assigned_to_id: user.id });
      return Response.json({ tasks });
    }

    if (action === 'updateTask') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      const tasks = await svc.FieldTask.filter({ id: body.id });
      const task = tasks[0];
      if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
      if (task.assigned_to_id !== user.id) return Response.json({ error: 'Not your task' }, { status: 403 });

      const patch = {};
      const ALLOWED_STATUS = ['assigned', 'in_progress', 'done', 'blocked'];
      if (body.status !== undefined) {
        if (!ALLOWED_STATUS.includes(body.status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
        patch.status = body.status;
        if (body.status === 'done') patch.completed_at = new Date().toISOString();
      }
      if (body.completion_notes !== undefined) patch.completion_notes = str(body.completion_notes, 4000);
      if (Array.isArray(body.completion_photos)) {
        patch.completion_photos = body.completion_photos.filter((u) => typeof u === 'string').slice(0, 30);
      }
      if (Array.isArray(body.add_progress_photos)) {
        const added = body.add_progress_photos
          .filter((p) => p && typeof p.url === 'string')
          .slice(0, 30)
          .map((p) => ({
            url: p.url,
            uploaded_at: new Date().toISOString(),
            uploaded_by: userName(user),
            caption: str(p.caption, 300),
          }));
        patch.progress_photos = [...(task.progress_photos || []), ...added];
      }
      if (!Object.keys(patch).length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
      const updated = await svc.FieldTask.update(body.id, patch);
      return Response.json({ task: updated });
    }

    // ── Time clock ────────────────────────────────────────────────────────
    if (action === 'timeStatus') {
      // Active entry regardless of date — a forgotten overnight clock-in must
      // still surface so the crew member can close it out
      const all = await svc.TimeEntry.filter({ user_id: user.id }, '-clock_in', 50);
      const active = all.find((e) => e.status === 'clocked_in' || e.status === 'on_break') || null;
      const today = todayStr();
      const completedToday = all.filter((e) => e.date === today && e.status === 'clocked_out');
      return Response.json({ active, completedToday });
    }

    if (action === 'clockIn') {
      if (!body.project_id) return Response.json({ error: 'project_id required' }, { status: 400 });
      const existing = await svc.TimeEntry.filter({ user_id: user.id }, '-clock_in', 50);
      if (existing.some((e) => e.status === 'clocked_in' || e.status === 'on_break')) {
        return Response.json({ error: 'You are already clocked in — clock out first.' }, { status: 409 });
      }
      const projects = await svc.ContractorProject.filter({ id: body.project_id });
      const project = projects[0];
      if (!project || project.status !== 'in_progress') {
        return Response.json({ error: 'Project not found or not active' }, { status: 400 });
      }
      const now = new Date();
      const entry = await svc.TimeEntry.create({
        user_id: user.id,
        user_name: userName(user),
        user_email: user.email,
        project_id: project.id,
        project_name: project.client_name || 'Project',
        clock_in: now.toISOString(),
        date: todayStr(),
        status: 'clocked_in',
        gps_clock_in: cleanGps(body.gps),
        breaks: [],
      });
      return Response.json({ entry });
    }

    if (action === 'startBreak' || action === 'endBreak') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      const entries = await svc.TimeEntry.filter({ id: body.id });
      const entry = entries[0];
      if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 });
      if (entry.user_id !== user.id) return Response.json({ error: 'Not your entry' }, { status: 403 });

      if (action === 'startBreak') {
        if (entry.status !== 'clocked_in') return Response.json({ error: 'Not clocked in' }, { status: 400 });
        const breaks = [...(entry.breaks || []), { start: new Date().toISOString(), end: null }];
        const updated = await svc.TimeEntry.update(entry.id, { status: 'on_break', breaks });
        return Response.json({ entry: updated });
      }
      if (entry.status !== 'on_break') return Response.json({ error: 'Not on break' }, { status: 400 });
      const breaks = (entry.breaks || []).map((b, i, arr) =>
        i === arr.length - 1 && !b.end ? { ...b, end: new Date().toISOString() } : b
      );
      const updated = await svc.TimeEntry.update(entry.id, { status: 'clocked_in', breaks });
      return Response.json({ entry: updated });
    }

    if (action === 'clockOut') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      if (!body.photo_url || typeof body.photo_url !== 'string') {
        return Response.json({ error: 'A jobsite photo is required to clock out' }, { status: 400 });
      }
      const entries = await svc.TimeEntry.filter({ id: body.id });
      const entry = entries[0];
      if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 });
      if (entry.user_id !== user.id) return Response.json({ error: 'Not your entry' }, { status: 403 });
      if (entry.status === 'clocked_out') return Response.json({ error: 'Already clocked out' }, { status: 400 });

      const outTime = new Date();
      // Close any break left open, then compute worked minutes server-side
      const breaks = (entry.breaks || []).map((b) => (b.start && !b.end ? { ...b, end: outTime.toISOString() } : b));
      const breakMs = breaks.reduce(
        (s, b) => (b.start && b.end ? s + (new Date(b.end).getTime() - new Date(b.start).getTime()) : s),
        0
      );
      const totalMinutes = Math.max(0, Math.round((outTime.getTime() - new Date(entry.clock_in).getTime() - breakMs) / 60000));
      const updated = await svc.TimeEntry.update(entry.id, {
        clock_out: outTime.toISOString(),
        status: 'clocked_out',
        breaks,
        gps_clock_out: cleanGps(body.gps),
        total_minutes: totalMinutes,
        clockout_photo_url: body.photo_url,
      });
      return Response.json({ entry: updated });
    }

    // ── Equipment ─────────────────────────────────────────────────────────
    if (action === 'listEquipment') {
      const [available, mine] = await Promise.all([
        svc.EquipmentItem.filter({ status: 'available', active: true }),
        svc.EquipmentCheckout.filter({ user_id: user.id, status: 'out' }),
      ]);
      return Response.json({ available, myCheckouts: mine });
    }

    if (action === 'checkoutEquipment') {
      if (!body.equipment_id || !body.project_id) {
        return Response.json({ error: 'equipment_id and project_id required' }, { status: 400 });
      }
      const items = await svc.EquipmentItem.filter({ id: body.equipment_id });
      const item = items[0];
      if (!item || item.status !== 'available' || item.active === false) {
        return Response.json({ error: 'That item was just checked out by someone else.' }, { status: 409 });
      }
      const projects = await svc.ContractorProject.filter({ id: body.project_id });
      const project = projects[0];
      if (!project) return Response.json({ error: 'Project not found' }, { status: 400 });
      const checkout = await svc.EquipmentCheckout.create({
        equipment_id: item.id,
        equipment_name: item.name,
        user_id: user.id,
        user_name: userName(user),
        user_email: user.email,
        project_id: project.id,
        project_name: project.client_name || 'Project',
        checked_out_at: new Date().toISOString(),
        condition_out: 'good',
        notes_out: str(body.notes, 1000),
        status: 'out',
      });
      await svc.EquipmentItem.update(item.id, { status: 'checked_out' });
      return Response.json({ checkout });
    }

    if (action === 'returnEquipment') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      const checkouts = await svc.EquipmentCheckout.filter({ id: body.id });
      const checkout = checkouts[0];
      if (!checkout) return Response.json({ error: 'Checkout not found' }, { status: 404 });
      if (checkout.user_id !== user.id) return Response.json({ error: 'Not your checkout' }, { status: 403 });
      if (checkout.status === 'returned') return Response.json({ error: 'Already returned' }, { status: 400 });
      await svc.EquipmentCheckout.update(checkout.id, { status: 'returned', checked_in_at: new Date().toISOString() });
      // Don't resurrect an item an admin pulled for maintenance while it was out
      const items = await svc.EquipmentItem.filter({ id: checkout.equipment_id });
      if (items[0] && items[0].status === 'checked_out') {
        await svc.EquipmentItem.update(checkout.equipment_id, { status: 'available' });
      }
      return Response.json({ ok: true });
    }

    // ── Receipts ──────────────────────────────────────────────────────────
    if (action === 'listReceipts') {
      const receipts = await svc.FieldReceipt.filter({ user_id: user.id }, '-created_date', 100);
      return Response.json({ receipts });
    }

    if (action === 'createReceipt') {
      const receiptType = body.receipt_type === 'reimbursement' ? 'reimbursement' : 'job_expense';
      const amount = Number(body.amount);
      if (!body.image_url || typeof body.image_url !== 'string') {
        return Response.json({ error: 'A receipt photo is required' }, { status: 400 });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return Response.json({ error: 'A valid amount is required' }, { status: 400 });
      }
      let projectName = '';
      if (receiptType === 'job_expense') {
        if (!body.project_id) return Response.json({ error: 'Select the project this expense belongs to' }, { status: 400 });
        const projects = await svc.ContractorProject.filter({ id: body.project_id });
        if (!projects[0]) return Response.json({ error: 'Project not found' }, { status: 400 });
        projectName = projects[0].client_name || 'Project';
      } else if (!str(body.reason).trim()) {
        return Response.json({ error: 'A reason is required for reimbursements' }, { status: 400 });
      }
      const receipt = await svc.FieldReceipt.create({
        user_id: user.id,
        user_name: userName(user),
        user_email: user.email,
        receipt_type: receiptType,
        project_id: receiptType === 'job_expense' ? body.project_id : '',
        project_name: projectName,
        reason: str(body.reason, 1000),
        vendor_name: str(body.vendor_name, 200),
        amount,
        receipt_date: todayStr(),
        image_url: body.image_url,
        description: str(body.description, 2000),
        status: 'pending',
      });
      return Response.json({ receipt });
    }

    // ── Time off ──────────────────────────────────────────────────────────
    if (action === 'listTimeOff') {
      const requests = await svc.TimeOffRequest.filter({ user_id: user.id }, '-created_date', 100);
      return Response.json({ requests });
    }

    if (action === 'createTimeOff') {
      const dates = Array.isArray(body.dates)
        ? [...new Set(body.dates.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
        : [];
      if (!dates.length) return Response.json({ error: 'Select at least one date' }, { status: 400 });
      const today = todayStr();
      if (dates.some((d) => d <= today)) {
        return Response.json({ error: 'Time off can only be requested for future dates' }, { status: 400 });
      }
      const LEAVE = ['pto', 'sick', 'unpaid', 'personal', 'other'];
      const isFieldCrew = !!body.is_field_crew;
      const request = await svc.TimeOffRequest.create({
        user_id: user.id,
        user_name: userName(user),
        user_email: user.email,
        user_role: str(user.role, 60),
        request_type: isFieldCrew ? 'unavailable' : 'time_off',
        leave_type: isFieldCrew ? 'other' : (LEAVE.includes(body.leave_type) ? body.leave_type : 'pto'),
        start_date: dates[0],
        end_date: dates[dates.length - 1],
        dates,
        reason: str(body.reason, 1000),
        status: 'pending',
        is_field_crew: isFieldCrew,
      });
      return Response.json({ request });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
