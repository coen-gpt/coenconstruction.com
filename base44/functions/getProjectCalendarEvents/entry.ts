import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    // Portal-token validated: a raw project_id parameter let anyone who could
    // guess an id read the company calendar. The token resolves the project.
    if (!token) {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) return Response.json({ error: 'Invalid portal link' }, { status: 404 });
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: 'This portal link has expired' }, { status: 410 });
    }

    const project = await base44.asServiceRole.entities.ContractorProject.get(portal.project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get Google Calendar access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Match events by this client's name or address only. Generic terms like
    // the project type matched every "Kitchen Remodel" on the calendar and
    // showed other clients' events in this customer's portal.
    const searchTerms = [
      project.client_name,
      project.client_address,
    ].filter(t => t && t.trim().length > 3);
    if (searchTerms.length === 0) {
      return Response.json({ events: [] });
    }

    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1); // Include events from 1 month ago

    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 6); // Look 6 months ahead

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${timeMin.toISOString()}&` +
      `timeMax=${timeMax.toISOString()}&` +
      `maxResults=100&` +
      `orderBy=startTime&` +
      `singleEvents=true`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch calendar events' }, { status: res.status });
    }

    const data = await res.json();
    const allEvents = data.items || [];

    // Filter events that match this project
    const projectEvents = allEvents.filter(event => {
      const eventText = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
      return searchTerms.some(term => 
        eventText.includes(term.toLowerCase())
      );
    });

    // Map to timeline events with standardized categories
    const timelineEvents = projectEvents.map(event => {
      const startDate = new Date(event.start?.dateTime || event.start?.date);
      const endDate = event.end?.dateTime || event.end?.date ? new Date(event.end.dateTime || event.end.date) : null;
      
      // Categorize based on event title/description
      let category = 'other';
      let icon = 'CalendarDays';
      
      const eventText = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
      
      if (eventText.includes('tear') || eventText.includes('demolition') || eventText.includes('remove')) {
        category = 'tear-off';
        icon = 'Trash2';
      } else if (eventText.includes('install') || eventText.includes('construction') || eventText.includes('build')) {
        category = 'installation';
        icon = 'Wrench';
      } else if (eventText.includes('walkthrough') || eventText.includes('final') || eventText.includes('inspection')) {
        category = 'walkthrough';
        icon = 'CheckSquare';
      } else if (eventText.includes('delivery') || eventText.includes('material')) {
        category = 'delivery';
        icon = 'Truck';
      } else if (eventText.includes('meeting') || eventText.includes('consultation')) {
        category = 'meeting';
        icon = 'Users';
      }

      return {
        id: event.id,
        title: event.summary || 'Scheduled Event',
        description: event.description || '',
        start_date: startDate.toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        category,
        icon,
        all_day: !event.start?.dateTime, // If no time, it's an all-day event
        location: event.location || '',
      };
    });

    return Response.json({ events: timelineEvents });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});