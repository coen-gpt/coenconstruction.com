import { verifyAdminSession } from '../_shared/adminSession.ts';

/**
 * 2-way sync between ContractorProject walkthroughs and Google Calendar.
 *
 * Pull direction:  GCal events → find matching project by google_calendar_event_id or client name
 *                  and update walkthrough_date if it changed.
 * Push direction:  Projects with walkthrough_date but no google_calendar_event_id
 *                  → create GCal event and store event ID back on the project.
 *
 * Dedup: events already linked via google_calendar_event_id are never re-created.
 */

const CALENDAR_ID = 'primary';

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates');

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // ── 1. Pull: fetch all upcoming events from Google Calendar ──────────────
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ahead

    let gcalEvents = [];
    let pageToken = null;
    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events` +
        `?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      const res = await fetch(url, { headers: authHeader });
      if (!res.ok) break;
      const data = await res.json();
      gcalEvents.push(...(data.items || []));
      pageToken = data.nextPageToken || null;
    } while (pageToken);

    // ── 2. Load all projects ─────────────────────────────────────────────────
    const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 500);

    // Build lookup maps
    const projectByEventId = {};
    const projectByClientName = {};
    for (const p of projects) {
      if (p.google_calendar_event_id) projectByEventId[p.google_calendar_event_id] = p;
      if (p.client_name) projectByClientName[p.client_name.toLowerCase()] = p;
    }

    let pulled = 0;
    let pushed = 0;

    // ── 3. Pull: for each GCal event, update matched project walkthrough_date ─
    for (const event of gcalEvents) {
      if (!event.id || event.status === 'cancelled') continue;

      const eventStart = event.start?.dateTime || event.start?.date;
      if (!eventStart) continue;

      // Skip events that are not walkthroughs (must contain "walkthrough" or match a project client name)
      const title = (event.summary || '').toLowerCase();
      const desc = (event.description || '').toLowerCase();

      let matchedProject = projectByEventId[event.id] || null;

      // If not linked by ID, try to match by client name in title
      if (!matchedProject) {
        for (const [name, proj] of Object.entries(projectByClientName)) {
          if (title.includes(name)) {
            matchedProject = proj;
            break;
          }
        }
      }

      if (!matchedProject) continue;

      const newDate = eventStart.split('T')[0]; // date portion YYYY-MM-DD
      const changed = matchedProject.walkthrough_date !== newDate ||
                      matchedProject.google_calendar_event_id !== event.id;

      if (changed) {
        await base44.asServiceRole.entities.ContractorProject.update(matchedProject.id, {
          walkthrough_date: newDate,
          google_calendar_event_id: event.id,
        });
        // Keep local maps fresh
        matchedProject.walkthrough_date = newDate;
        matchedProject.google_calendar_event_id = event.id;
        projectByEventId[event.id] = matchedProject;
        pulled++;
      }
    }

    // ── 4. Push: projects with walkthrough_date but no linked GCal event ─────
    const linkedEventIds = new Set(gcalEvents.map(e => e.id));

    for (const project of projects) {
      if (!project.walkthrough_date) continue;
      // Already linked AND the event still exists in GCal → skip
      if (project.google_calendar_event_id && linkedEventIds.has(project.google_calendar_event_id)) continue;

      // Build event body
      const dateStr = project.walkthrough_date; // YYYY-MM-DD
      const titleParts = [
        'Walkthrough',
        project.client_name,
        project.project_type,
      ].filter(Boolean);

      const descParts = [
        project.client_address ? `Address: ${project.client_address}` : '',
        project.client_city ? `City: ${project.client_city}` : '',
        project.client_phone ? `Phone: ${project.client_phone}` : '',
        project.client_email ? `Email: ${project.client_email}` : '',
        project.scope_of_work ? `\nScope: ${project.scope_of_work.slice(0, 300)}` : '',
      ].filter(Boolean).join('\n');

      const newEvent = {
        summary: titleParts.join(' — '),
        description: descParts,
        location: [project.client_address, project.client_city].filter(Boolean).join(', '),
        start: { date: dateStr },
        end: { date: dateStr },
      };

      const createRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
        {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvent),
        }
      );

      if (createRes.ok) {
        const created = await createRes.json();
        await base44.asServiceRole.entities.ContractorProject.update(project.id, {
          google_calendar_event_id: created.id,
        });
        pushed++;
      }
    }

    // ── 5. Save sync token for future incremental webhook syncs ───────────────
    const syncStates = await base44.asServiceRole.entities.SyncState.filter({ key: 'google_calendar' });
    const now = new Date().toISOString();
    if (syncStates.length > 0) {
      await base44.asServiceRole.entities.SyncState.update(syncStates[0].id, { last_synced_at: now });
    } else {
      await base44.asServiceRole.entities.SyncState.create({ key: 'google_calendar', last_synced_at: now });
    }

    return Response.json({ success: true, pulled, pushed, total_gcal_events: gcalEvents.length });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
