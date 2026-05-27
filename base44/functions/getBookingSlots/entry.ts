import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Returns available walkthrough booking slots based on CompanyProfile business hours,
 * while checking existing Google Calendar events to avoid double-booking.
 *
 * Payload: { lead_token } — validated against the Lead record
 * Returns: { slots: [{start, end, label}], company: {...}, lead: {...} }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { lead_token } = await req.json();

    if (!lead_token) {
      return Response.json({ error: 'lead_token is required' }, { status: 400 });
    }

    // Validate token against Lead records
    const leads = await base44.asServiceRole.entities.Lead.filter({ booking_token: lead_token });
    if (!leads || leads.length === 0) {
      return Response.json({ error: 'Invalid or expired booking link.' }, { status: 404 });
    }
    const lead = leads[0];

    // Get company profile / business hours
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    const bookingDays = company.booking_days ?? [1, 2, 3, 4, 5]; // Mon–Fri default
    const startHour = company.booking_start_hour ?? 8;
    const endHour = company.booking_end_hour ?? 17;
    const slotMinutes = company.booking_slot_minutes ?? 60;
    const advanceDays = company.booking_advance_days ?? 1;
    const windowDays = company.booking_window_days ?? 14;

    // Fetch existing calendar events to check for conflicts
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const now = new Date();
    const windowStart = new Date(now.getTime() + advanceDays * 86400000);
    const windowEnd = new Date(now.getTime() + (advanceDays + windowDays) * 86400000);

    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${windowStart.toISOString()}&timeMax=${windowEnd.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const calRes = await fetch(calUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const calData = calRes.ok ? await calRes.json() : { items: [] };
    const existingEvents = calData.items || [];

    // Build busy intervals in UTC ms
    const busyIntervals = existingEvents
      .filter(e => e.start?.dateTime)
      .map(e => ({
        start: new Date(e.start.dateTime).getTime(),
        end: new Date(e.end.dateTime).getTime(),
      }));

    // Generate slots
    const slots = [];
    const ET_OFFSET_MS = 4 * 60 * 60 * 1000; // EDT = UTC-4

    for (let d = advanceDays; d < advanceDays + windowDays; d++) {
      const day = new Date(now);
      day.setUTCHours(0, 0, 0, 0);
      day.setUTCDate(day.getUTCDate() + d);

      // Convert UTC day to ET day-of-week
      const etDay = new Date(day.getTime() - ET_OFFSET_MS);
      const dow = etDay.getUTCDay();

      if (!bookingDays.includes(dow)) continue;

      // Generate hourly slots within business hours
      for (let h = startHour; h < endHour; h += slotMinutes / 60) {
        const slotHour = Math.floor(h);
        const slotMin = Math.round((h - slotHour) * 60);

        // Build slot start in ET then convert to UTC
        const slotStartET = new Date(day);
        slotStartET.setUTCHours(slotHour + 4, slotMin, 0, 0); // ET → UTC (+4 for EDT)
        const slotEndET = new Date(slotStartET.getTime() + slotMinutes * 60 * 1000);

        // Skip if in the past
        if (slotStartET.getTime() <= Date.now()) continue;

        // Check for conflicts
        const startMs = slotStartET.getTime();
        const endMs = slotEndET.getTime();
        const hasConflict = busyIntervals.some(b => startMs < b.end && endMs > b.start);
        if (hasConflict) continue;

        // Format display label
        const label = slotStartET.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        slots.push({
          start: slotStartET.toISOString(),
          end: slotEndET.toISOString(),
          label,
          date: slotStartET.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }),
          time: slotStartET.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
        });
      }
    }

    return Response.json({
      slots,
      lead: { full_name: lead.full_name, email: lead.email, project_type: lead.project_type, address: lead.address },
      company: {
        company_name: company.company_name,
        brand_color: company.brand_color || '#E35235',
        logo_url: company.logo_url,
        phone: company.phone,
        slot_minutes: slotMinutes,
      },
    });

  } catch (error) {
    console.error('getBookingSlots error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});