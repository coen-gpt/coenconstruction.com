/**
 * Review & sync the shared Office (walkthrough) Google Calendar with the app.
 * Call with {} for a dry-run review, { apply: true } to sync.
 *
 * Covers both directions the calendar gets walkthroughs:
 *  - Lead self-scheduled via /book-walkthrough → event already linked through
 *    Lead.booking_event_id / ContractorProject.google_calendar_event_id; this
 *    heals walkthrough_date drift if the event was moved on the calendar.
 *  - Office admin added an event directly on the calendar → matched to an
 *    existing Lead by attendee email or client name, otherwise a new Lead is
 *    created (source "Office Calendar") so the booking exists in the app.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

// "🏠 Walkthrough: Jane Doe — Kitchen Remodel" → "Jane Doe"
function nameFromSummary(summary) {
  const stripped = String(summary || '').replace(/^[^\w]*walkthrough[:\s]*/i, '').trim();
  return stripped.split(/\s+[—–-]\s+/)[0].trim();
}

function parseDescriptionField(description, label) {
  const m = String(description || '').match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
  return m ? m[1].trim() : '';
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    const apply = body.apply === true;

    const calendarId = Deno.env.get('GOOGLE_WALKTHROUGH_CALENDAR_ID') || 'c_9564c3d75db1610028f8fd25a79d1df698ea9a44e8635d953c71568202838f80@group.calendar.google.com';
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const timeMin = new Date(Date.now() - 14 * 86400_000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 86400_000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
      `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250&singleEvents=true&orderBy=startTime`;
    const calRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!calRes.ok) {
      const err = await calRes.json().catch(() => ({}));
      throw new Error(`Google Calendar error: ${calRes.status} — ${err.error?.message || 'unknown'}`);
    }
    const events = (await calRes.json()).items || [];

    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 500);
    const projects = await base44.asServiceRole.entities.ContractorProject.list('-updated_date', 500);

    const leadByEventId = Object.fromEntries(leads.filter(l => l.booking_event_id).map(l => [l.booking_event_id, l]));
    const projectByEventId = Object.fromEntries(projects.filter(p => p.google_calendar_event_id).map(p => [p.google_calendar_event_id, p]));
    const leadByEmail = Object.fromEntries(leads.filter(l => l.email).map(l => [l.email.toLowerCase(), l]));
    const leadByName = Object.fromEntries(leads.filter(l => l.full_name).map(l => [l.full_name.trim().toLowerCase(), l]));

    const results = [];
    let appliedCount = 0;

    for (const ev of events) {
      if (ev.status === 'cancelled') continue;
      if (ev.transparency === 'transparent') continue; // free blocks, not appointments

      const startIso = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T13:00:00.000Z` : null); // all-day ≈ 9am ET
      if (!startIso) continue;
      const eventDate = startIso.split('T')[0];
      const row = { event_id: ev.id, summary: ev.summary || '(no title)', start: startIso, all_day: !ev.start?.dateTime };

      // 1) Already linked — heal walkthrough_date drift if the event moved
      const linkedLead = leadByEventId[ev.id];
      const linkedProject = projectByEventId[ev.id] ||
        (linkedLead?.contractor_project_id ? projects.find(p => p.id === linkedLead.contractor_project_id) : null);
      if (linkedLead || linkedProject) {
        const projectDrifted = linkedProject && linkedProject.walkthrough_date && linkedProject.walkthrough_date !== eventDate;
        const leadDrifted = linkedLead && linkedLead.booking_slot_start && linkedLead.booking_slot_start !== startIso && !ev.start?.date;
        if (!projectDrifted && !leadDrifted) {
          results.push({ ...row, status: 'synced', detail: linkedLead ? `Linked to lead ${linkedLead.full_name}` : `Linked to project ${linkedProject.client_name}` });
          continue;
        }
        row.status = apply ? 'updated' : 'drifted';
        row.detail = `Event moved — walkthrough date ${apply ? 'updated' : 'will update'} to ${eventDate}`;
        if (apply) {
          if (projectDrifted) await base44.asServiceRole.entities.ContractorProject.update(linkedProject.id, { walkthrough_date: eventDate });
          if (leadDrifted) await base44.asServiceRole.entities.Lead.update(linkedLead.id, { booking_slot_start: startIso });
          appliedCount++;
        }
        results.push(row);
        continue;
      }

      // 2) Manually-added event. Only treat clearly-labeled walkthroughs as
      // leads — the office also uses this calendar for busy blocks.
      const looksLikeWalkthrough = /walkthrough/i.test(ev.summary || '') || /walkthrough/i.test(ev.description || '');
      if (!looksLikeWalkthrough) {
        results.push({ ...row, status: 'skipped', detail: 'Not labeled as a walkthrough — rename the event to include "Walkthrough" to sync it' });
        continue;
      }

      const attendeeEmail = (ev.attendees || []).find(a => !a.organizer && !a.self && !a.resource)?.email?.toLowerCase() || '';
      const clientName = nameFromSummary(ev.summary);
      const matchedLead =
        (attendeeEmail && leadByEmail[attendeeEmail]) ||
        (clientName && leadByName[clientName.toLowerCase()]) ||
        null;

      if (matchedLead) {
        row.status = apply ? 'linked' : 'link_lead';
        row.detail = `${apply ? 'Linked' : 'Will link'} to existing lead ${matchedLead.full_name}`;
        if (apply) {
          await base44.asServiceRole.entities.Lead.update(matchedLead.id, {
            booking_event_id: ev.id,
            booking_slot_start: startIso,
            ...(matchedLead.status === 'New' ? { status: 'Contacted' } : {}),
            notes: `${matchedLead.notes || ''}\n[Auto] Walkthrough on ${eventDate} linked from Office Calendar event "${ev.summary}"`.trim(),
          });
          if (matchedLead.contractor_project_id) {
            await base44.asServiceRole.entities.ContractorProject.update(matchedLead.contractor_project_id, {
              google_calendar_event_id: ev.id,
              walkthrough_date: eventDate,
            }).catch(() => {});
          }
          appliedCount++;
        }
        results.push(row);
        continue;
      }

      // 3) No matching lead — create one so the booking exists in the app
      row.status = apply ? 'created' : 'create_lead';
      row.detail = `${apply ? 'Created' : 'Will create'} new lead "${clientName || ev.summary}" (manually scheduled on the Office Calendar)`;
      if (apply) {
        await base44.asServiceRole.entities.Lead.create({
          full_name: clientName || ev.summary || 'Office Calendar walkthrough',
          email: attendeeEmail || parseDescriptionField(ev.description, 'Email') || '',
          phone: parseDescriptionField(ev.description, 'Phone') || '',
          status: 'Contacted',
          source: 'Office Calendar',
          booking_event_id: ev.id,
          booking_slot_start: startIso,
          address: parseDescriptionField(ev.description, 'Address') || ev.location || '',
          notes: `[Auto] Imported from Office Calendar — walkthrough "${ev.summary}" on ${eventDate} was added directly to the calendar`,
        });
        appliedCount++;
      }
      results.push(row);
    }

    return Response.json({
      success: true,
      applied: apply ? appliedCount : 0,
      needs_sync: results.filter(r => ['drifted', 'link_lead', 'create_lead'].includes(r.status)).length,
      events: results,
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
