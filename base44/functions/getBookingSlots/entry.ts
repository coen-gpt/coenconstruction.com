import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Returns available walkthrough booking slots based on CompanyProfile business hours,
 * while checking existing Google Calendar events to avoid double-booking.
 *
 * Payload: { lead_token } — validated against the Lead record
 *      OR  { campaign_token } — HMAC tracking token from a campaign email's
 *          "Schedule a Walkthrough" link. No Lead exists yet in that flow
 *          (it's created by confirmBooking when a slot is confirmed), so the
 *          visitor's details come from the CampaignRecipient instead.
 * Returns: { slots: [{start, end, label}], company: {...}, lead: {...} }
 */

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

// Same scheme as campaignTrack: HMAC-SHA256("campaign:" + payload).
async function verifyCampaignToken(token) {
  try {
    const secret = Deno.env.get('MAGIC_LINK_SECRET') || Deno.env.get('ADMIN_SESSION_SECRET');
    if (!secret) return null;
    const [payload, signature] = String(token).split('.');
    if (!payload || !signature) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(`campaign:${payload}`));
    if (!ok) return null;
    const [recipientId, campaignId] = new TextDecoder().decode(b64urlDecode(payload)).split('|');
    if (!recipientId || !campaignId) return null;
    return { recipientId, campaignId };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { lead_token, campaign_token } = await req.json();

    if (!lead_token && !campaign_token) {
      return Response.json({ error: 'lead_token is required' }, { status: 400 });
    }

    let lead = null;
    if (lead_token) {
      // Validate token against Lead records
      const leads = await base44.asServiceRole.entities.Lead.filter({ booking_token: lead_token });
      if (!leads || leads.length === 0) {
        return Response.json({ error: 'Invalid or expired booking link.' }, { status: 404 });
      }
      lead = leads[0];
    } else {
      const verified = await verifyCampaignToken(campaign_token);
      if (!verified) {
        return Response.json({ error: 'Invalid or expired booking link.' }, { status: 404 });
      }
      const rows = await base44.asServiceRole.entities.CampaignRecipient.filter({ id: verified.recipientId });
      const recipient = rows[0];
      if (!recipient || recipient.campaign_id !== verified.campaignId) {
        return Response.json({ error: 'Invalid or expired booking link.' }, { status: 404 });
      }
      const addressParts = [recipient.address, recipient.city, recipient.state, recipient.zip].filter(Boolean);
      lead = {
        full_name: recipient.client_name || recipient.email,
        email: recipient.email,
        project_type: recipient.project_type || 'General Inquiry',
        address: addressParts.join(', '),
      };
    }

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

    // Availability is checked against the shared walkthrough calendar — the
    // same calendar confirmBooking writes to — so booked slots never reappear.
    const calendarId = Deno.env.get('GOOGLE_WALKTHROUGH_CALENDAR_ID') || 'c_9564c3d75db1610028f8fd25a79d1df698ea9a44e8635d953c71568202838f80@group.calendar.google.com';
    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${windowStart.toISOString()}&timeMax=${windowEnd.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const calRes = await fetch(calUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const calData = calRes.ok ? await calRes.json() : null;
    if (!calData) {
      // Never offer slots blind — failing open here is how double-bookings happen.
      return Response.json({ error: 'Scheduling is temporarily unavailable. Please call us at (617) 857-COEN to book your walkthrough.' }, { status: 502 });
    }
    const existingEvents = calData.items || [];

    // ── Eastern Time helpers ──────────────────────────────────────────────
    // America/New_York alternates between EDT (UTC-4) and EST (UTC-5). A
    // hardcoded offset generated winter slots an hour off, so calendar events
    // landed at the wrong time from November through mid-March.
    const ET_FMT = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const etParts = (date) => {
      const parts = {};
      for (const p of ET_FMT.formatToParts(date)) parts[p.type] = p.value;
      return parts;
    };
    // UTC instant for an ET wall-clock time (two passes settle DST edges)
    const etWallToUtc = (y, mo, d, h, min) => {
      const desired = Date.UTC(y, mo - 1, d, h, min);
      let utc = new Date(desired);
      for (let i = 0; i < 2; i++) {
        const p = etParts(utc);
        const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
        utc = new Date(utc.getTime() + (desired - wall));
      }
      return utc;
    };

    // Build busy intervals in UTC ms. Covers timed events AND all-day blocks
    // (vacations, holidays use start.date), skips events marked Free
    // (transparency "transparent") and cancellations.
    const busyIntervals = existingEvents
      .filter(e => e.status !== 'cancelled' && e.transparency !== 'transparent')
      .map(e => {
        if (e.start?.dateTime) {
          return { start: new Date(e.start.dateTime).getTime(), end: new Date(e.end.dateTime).getTime() };
        }
        if (e.start?.date) {
          // All-day events: block the whole ET day(s). Google's end.date is exclusive.
          const [sy, sm, sd] = e.start.date.split('-').map(Number);
          const [ey, em, ed] = (e.end?.date || e.start.date).split('-').map(Number);
          const start = etWallToUtc(sy, sm, sd, 0, 0).getTime();
          let end = etWallToUtc(ey, em, ed, 0, 0).getTime();
          if (end <= start) end = start + 86400000;
          return { start, end };
        }
        return null;
      })
      .filter(Boolean);

    // Generate slots
    const slots = [];
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });

    for (let d = advanceDays; d < advanceDays + windowDays; d++) {
      // The ET calendar date d days out
      const probe = new Date(now.getTime() + d * 86400000);
      const dow = WEEKDAYS.indexOf(dowFmt.format(probe));
      if (!bookingDays.includes(dow)) continue;
      const p = etParts(probe);
      const y = +p.year, mo = +p.month, dayNum = +p.day;

      // Generate hourly slots within business hours
      for (let h = startHour; h < endHour; h += slotMinutes / 60) {
        const slotHour = Math.floor(h);
        const slotMin = Math.round((h - slotHour) * 60);

        const slotStart = etWallToUtc(y, mo, dayNum, slotHour, slotMin);
        const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);

        // Skip if in the past
        if (slotStart.getTime() <= Date.now()) continue;

        // Check for conflicts
        const startMs = slotStart.getTime();
        const endMs = slotEnd.getTime();
        const hasConflict = busyIntervals.some(b => startMs < b.end && endMs > b.start);
        if (hasConflict) continue;

        // Format display label
        const label = slotStart.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          label,
          date: slotStart.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }),
          time: slotStart.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
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