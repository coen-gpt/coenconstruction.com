import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Handles Google Calendar webhook notifications.
 * Called by the Base44 platform when GCal signals a change.
 * Uses incremental sync (syncToken) to fetch only changed events,
 * then updates the corresponding ContractorProject records.
 */

const CALENDAR_ID = 'primary';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    // ACK the initial sync ping
    const state = body.data?._provider_meta?.['x-goog-resource-state'];
    if (state === 'sync') return Response.json({ status: 'sync_ack' });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Load stored syncToken
    const syncStates = await base44.asServiceRole.entities.SyncState.filter({ key: 'google_calendar' });
    const syncRecord = syncStates.length > 0 ? syncStates[0] : null;

    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?maxResults=100`;
    if (syncRecord?.sync_token) {
      url += `&syncToken=${syncRecord.sync_token}`;
    } else {
      url += `&timeMin=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`;
    }

    let res = await fetch(url, { headers: authHeader });

    // syncToken expired → full re-sync from 30 days ago
    if (res.status === 410) {
      url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?maxResults=100` +
        `&timeMin=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`;
      res = await fetch(url, { headers: authHeader });
    }

    if (!res.ok) return Response.json({ status: 'api_error', code: res.status });

    // Drain all pages, collect syncToken from last page
    const allItems = [];
    let pageData = await res.json();
    let newSyncToken = null;

    while (true) {
      allItems.push(...(pageData.items || []));
      if (pageData.nextSyncToken) newSyncToken = pageData.nextSyncToken;
      if (!pageData.nextPageToken) break;
      const nextRes = await fetch(url + `&pageToken=${pageData.nextPageToken}`, { headers: authHeader });
      if (!nextRes.ok) break;
      pageData = await nextRes.json();
    }

    // Load projects for matching
    const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 500);
    const projectByEventId = {};
    const projectByClientName = {};
    for (const p of projects) {
      if (p.google_calendar_event_id) projectByEventId[p.google_calendar_event_id] = p;
      if (p.client_name) projectByClientName[p.client_name.toLowerCase()] = p;
    }

    let updated = 0;

    for (const event of allItems) {
      if (!event.id) continue;

      // Handle deleted/cancelled events
      if (event.status === 'cancelled') {
        const proj = projectByEventId[event.id];
        if (proj) {
          await base44.asServiceRole.entities.ContractorProject.update(proj.id, {
            walkthrough_date: null,
            google_calendar_event_id: null,
          });
          updated++;
        }
        continue;
      }

      const eventStart = event.start?.dateTime || event.start?.date;
      if (!eventStart) continue;

      let matchedProject = projectByEventId[event.id] || null;

      if (!matchedProject) {
        const title = (event.summary || '').toLowerCase();
        for (const [name, proj] of Object.entries(projectByClientName)) {
          if (title.includes(name)) { matchedProject = proj; break; }
        }
      }

      if (!matchedProject) continue;

      const newDate = eventStart.split('T')[0];
      if (matchedProject.walkthrough_date !== newDate || matchedProject.google_calendar_event_id !== event.id) {
        await base44.asServiceRole.entities.ContractorProject.update(matchedProject.id, {
          walkthrough_date: newDate,
          google_calendar_event_id: event.id,
        });
        updated++;
      }
    }

    // Persist new syncToken
    if (newSyncToken) {
      if (syncRecord) {
        await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
          sync_token: newSyncToken,
          last_synced_at: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.SyncState.create({
          key: 'google_calendar',
          sync_token: newSyncToken,
          last_synced_at: new Date().toISOString(),
        });
      }
    }

    return Response.json({ status: 'ok', processed: allItems.length, updated });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});