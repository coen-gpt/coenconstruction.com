import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Crew dispatch writes. A crew member can work multiple sites in a day but
// never two at once — every placement is validated against their existing
// slots INCLUDING an automatic drive-time buffer between consecutive sites
// (Google Distance Matrix on the project addresses, 30-minute fallback when
// the API can't answer). Reads stay on the adminEntities proxy; writes come
// through here so the validation can't be skipped by a creative client.

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

// ── Time helpers ──────────────────────────────────────────────────────────
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const toMin = (t) => {
  const m = TIME_RE.exec(String(t || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const roundUp15 = (m) => Math.ceil(m / 15) * 15;

const DEFAULT_TRAVEL_MIN = 30; // when the Distance Matrix can't answer
const DEFAULT_DAY_START = 7 * 60; // 07:00
const FULL_DAY_END = 15 * 60 + 30; // 15:30
const DEFAULT_SLOT_MIN = 4 * 60; // follow-up stops default to 4h blocks

// Drive time between two site addresses, rounded up to 5 minutes. Cached per
// request — a chain recompute asks about the same pair more than once.
function makeDriveLookup() {
  const cache = new Map();
  const key = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('GOOGLE_PLACES_API_KEY') || '';
  return async function driveMinutes(fromAddr, toAddr) {
    const from = String(fromAddr || '').trim();
    const to = String(toAddr || '').trim();
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) return { minutes: 0, estimated: false };
    const cacheKey = `${from}→${to}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    let result = { minutes: DEFAULT_TRAVEL_MIN, estimated: true };
    if (key) {
      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(from)}&destinations=${encodeURIComponent(to)}&units=imperial&key=${key}`;
        const res = await fetch(url);
        const data = await res.json();
        const el = data?.rows?.[0]?.elements?.[0];
        if (data?.status === 'OK' && el?.status === 'OK' && el?.duration?.value >= 0) {
          const mins = Math.ceil(el.duration.value / 60 / 5) * 5;
          result = { minutes: Math.min(Math.max(mins, 5), 180), estimated: false };
        } else {
          console.error('Distance Matrix unusable:', data?.status, el?.status);
        }
      } catch (e) {
        console.error('Distance Matrix error:', e.message);
      }
    }
    cache.set(cacheKey, result);
    return result;
  };
}

const sortByStart = (list) =>
  [...list].sort((a, b) => (toMin(a.start_time) ?? 0) - (toMin(b.start_time) ?? 0));

// Check a full day chain: every stop must start at or after the previous
// stop's end plus the drive between the two sites. Returns null or a
// human-readable conflict.
async function findConflict(dayAssignments, drive) {
  const chain = sortByStart(dayAssignments);
  for (let i = 0; i < chain.length; i++) {
    const cur = chain[i];
    const s = toMin(cur.start_time);
    const e = toMin(cur.end_time);
    if (s === null || e === null || e <= s) return `"${cur.project_name}" has an invalid time slot.`;
    if (i === 0) continue;
    const prev = chain[i - 1];
    const { minutes } = await drive(prev.project_address, cur.project_address);
    const earliest = toMin(prev.end_time) + minutes;
    if (s < earliest) {
      return `Overlaps ${prev.project_name} (ends ${prev.end_time}${minutes ? ` + ${minutes} min drive` : ''}). Earliest start: ${fromMin(roundUp15(earliest))}.`;
    }
  }
  return null;
}

// Re-stamp travel_minutes_before / travel_from_name down a crew member's day
// so the board and the field app always show the current chain.
async function recomputeChain(svc, drive, userId, date) {
  const day = sortByStart(await svc.CrewAssignment.filter({ user_id: userId, date }));
  for (let i = 0; i < day.length; i++) {
    const cur = day[i];
    const prev = i > 0 ? day[i - 1] : null;
    const { minutes } = prev ? await drive(prev.project_address, cur.project_address) : { minutes: 0 };
    const fromName = prev ? prev.project_name || '' : '';
    if (cur.travel_minutes_before !== minutes || (cur.travel_from_name || '') !== fromName) {
      await svc.CrewAssignment.update(cur.id, { travel_minutes_before: minutes, travel_from_name: fromName });
    }
  }
}

const str = (v, max = 1000) => (typeof v === 'string' ? v.slice(0, max) : '');

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44, user: actor } = await verifyAdminSession(req, 'can_access_field_crew', body);
    const svc = base44.asServiceRole.entities;
    const { action } = body;
    const drive = makeDriveLookup();

    // ── place: assign (drop from roster) or move (drag between cells) ─────
    if (action === 'place') {
      const date = String(body.date || '');
      const projectId = String(body.project_id || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !projectId) {
        return Response.json({ error: 'date and project_id required' }, { status: 400 });
      }

      let moved = null;
      if (body.assignment_id) {
        moved = (await svc.CrewAssignment.filter({ id: body.assignment_id }))[0];
        if (!moved) return Response.json({ error: 'Assignment not found' }, { status: 404 });
      }
      const userId = String(body.user_id || moved?.user_id || '');
      if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 });

      const [crewUser, project] = await Promise.all([
        svc.AdminUser.filter({ id: userId }).then((r) => r[0]),
        svc.ContractorProject.filter({ id: projectId }).then((r) => r[0]),
      ]);
      if (!crewUser) return Response.json({ error: 'Crew member not found' }, { status: 404 });
      if (!project && !moved) return Response.json({ error: 'Project not found' }, { status: 404 });

      const projectName = project?.client_name || moved?.project_name || 'Project';
      const projectAddress = project?.client_address || moved?.project_address || '';

      const others = (await svc.CrewAssignment.filter({ user_id: userId, date }))
        .filter((a) => a.id !== moved?.id);

      // Explicit times win; otherwise auto-place — first stop gets the full
      // day, follow-up stops start after the last stop plus the drive over.
      let startMin = toMin(body.start_time);
      let endMin = toMin(body.end_time);
      if (startMin === null || endMin === null) {
        if (!others.length) {
          startMin = toMin(moved?.start_time) ?? DEFAULT_DAY_START;
          endMin = toMin(moved?.end_time) ?? FULL_DAY_END;
          // Keep a moved slot's duration, but a fresh first stop fills the day
          if (!moved) { startMin = DEFAULT_DAY_START; endMin = FULL_DAY_END; }
        } else {
          const last = sortByStart(others)[others.length - 1];
          const { minutes } = await drive(last.project_address, projectAddress);
          startMin = roundUp15(toMin(last.end_time) + minutes);
          const duration = moved && toMin(moved.end_time) !== null && toMin(moved.start_time) !== null
            ? toMin(moved.end_time) - toMin(moved.start_time)
            : DEFAULT_SLOT_MIN;
          endMin = startMin + Math.max(duration, 30);
        }
      }
      if (endMin <= startMin) return Response.json({ error: 'End time must be after the start time' }, { status: 400 });

      const candidate = {
        id: moved?.id || '__new__',
        date,
        user_id: userId,
        user_name: crewUser.name || moved?.user_name || '',
        user_email: crewUser.email || moved?.user_email || '',
        project_id: projectId,
        project_name: projectName,
        project_address: projectAddress,
        start_time: fromMin(startMin),
        end_time: fromMin(endMin),
        assigned_by: actor.email,
      };

      const conflict = await findConflict([...others, candidate], drive);
      if (conflict) return Response.json({ error: conflict }, { status: 409 });

      const { id: _ignore, ...data } = candidate;
      const saved = moved
        ? await svc.CrewAssignment.update(moved.id, data)
        : await svc.CrewAssignment.create(data);

      await recomputeChain(svc, drive, userId, date);
      // A move can leave a hole in the old day/person chain too
      if (moved && (moved.user_id !== userId || moved.date !== date)) {
        await recomputeChain(svc, drive, moved.user_id, moved.date);
      }
      return Response.json({ assignment: saved });
    }

    // ── updateTimes: edit a slot in place ──────────────────────────────────
    if (action === 'updateTimes') {
      const existing = (await svc.CrewAssignment.filter({ id: body.id }))[0];
      if (!existing) return Response.json({ error: 'Assignment not found' }, { status: 404 });
      const startMin = toMin(body.start_time);
      const endMin = toMin(body.end_time);
      if (startMin === null || endMin === null || endMin <= startMin) {
        return Response.json({ error: 'Enter a valid time range (end after start)' }, { status: 400 });
      }
      const others = (await svc.CrewAssignment.filter({ user_id: existing.user_id, date: existing.date }))
        .filter((a) => a.id !== existing.id);
      const candidate = { ...existing, start_time: fromMin(startMin), end_time: fromMin(endMin) };
      const conflict = await findConflict([...others, candidate], drive);
      if (conflict) return Response.json({ error: conflict }, { status: 409 });

      const patch = { start_time: candidate.start_time, end_time: candidate.end_time };
      if (body.note !== undefined) patch.note = str(body.note);
      const saved = await svc.CrewAssignment.update(existing.id, patch);
      await recomputeChain(svc, drive, existing.user_id, existing.date);
      return Response.json({ assignment: saved });
    }

    // ── remove ─────────────────────────────────────────────────────────────
    if (action === 'remove') {
      const existing = (await svc.CrewAssignment.filter({ id: body.id }))[0];
      if (!existing) return Response.json({ error: 'Assignment not found' }, { status: 404 });
      await svc.CrewAssignment.delete(existing.id);
      await recomputeChain(svc, drive, existing.user_id, existing.date);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
