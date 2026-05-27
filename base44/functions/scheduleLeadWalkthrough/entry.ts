import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automatically schedules a "Lead Walkthrough" calendar event on the company Google Calendar
 * for the next available business day (Mon–Fri, 10am–11am ET) when a new lead comes in.
 *
 * Called by: angiWebhook and sendLeadNotification after lead creation.
 *
 * Payload: { full_name, email, phone, project_type, address, source, contractor_project_id, lead_id }
 */

// Find the next weekday at a given hour (ET = UTC-4 or UTC-5)
function nextWeekdayAt(hour = 10, daysAhead = 1) {
  const now = new Date();
  // Add daysAhead days
  const dt = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  // Skip to Monday if weekend
  const day = dt.getUTCDay();
  if (day === 0) dt.setUTCDate(dt.getUTCDate() + 1); // Sunday → Monday
  if (day === 6) dt.setUTCDate(dt.getUTCDate() + 2); // Saturday → Monday
  // Set time: hour in ET (UTC-4 during DST)
  dt.setUTCHours(hour + 4, 0, 0, 0); // 10am ET = 14:00 UTC (EDT)
  return dt;
}

const PROJECT_LABELS = {
  'Kitchen Remodel': 'Kitchen Remodel',
  'Bathroom Remodel': 'Bathroom Remodel',
  'Deck / Porch / Pergola': 'Deck / Porch / Pergola',
  'Siding': 'Siding',
  'Home Addition': 'Home Addition',
  'Snow Removal': 'Snow Removal',
  'Custom Carpentry': 'Custom Carpentry',
  'Roofing': 'Roofing',
  'Full Home Renovation': 'Full Home Renovation',
  'General Inquiry': 'General Inquiry',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { full_name, email, phone, project_type, address, source, contractor_project_id, lead_id } = await req.json();

    if (!full_name) {
      return Response.json({ error: 'full_name is required' }, { status: 400 });
    }

    // Get Google Calendar access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Get company profile for team email + name
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    const companyName = company.company_name || 'Coen Construction';
    const teamEmail = company.lead_notification_email || 'scott@coenconstruction.com';

    const projectLabel = PROJECT_LABELS[project_type] || project_type || 'General Inquiry';
    const sourceLabel = source || 'Website';

    // Schedule for next business day at 10am ET
    const startTime = nextWeekdayAt(10, 1);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour

    const appUrl = contractor_project_id
      ? `https://coenconstruction.base44.app/estimator/projects/${contractor_project_id}`
      : 'https://coenconstruction.base44.app/estimator/projects';

    const description = [
      `📋 <b>Lead Walkthrough — ${projectLabel}</b>`,
      ``,
      `<b>Client:</b> ${full_name}`,
      phone ? `<b>Phone:</b> ${phone}` : null,
      email ? `<b>Email:</b> ${email}` : null,
      address ? `<b>Address:</b> ${address}` : null,
      `<b>Project Type:</b> ${projectLabel}`,
      `<b>Lead Source:</b> ${sourceLabel}`,
      ``,
      `<b>Action Items:</b>`,
      `• Call client to confirm walkthrough time`,
      `• Review project scope before visit`,
      `• Prepare estimate template`,
      ``,
      contractor_project_id ? `<a href="${appUrl}">View Project in Estimator →</a>` : null,
    ].filter(Boolean).join('\n');

    const eventBody = {
      summary: `🏠 Walkthrough: ${full_name} — ${projectLabel}`,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/New_York',
      },
      attendees: [
        { email: teamEmail, displayName: companyName },
        // Include client if email available — sends them a calendar invite
        ...(email ? [{ email, displayName: full_name }] : []),
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },    // 1hr before
          { method: 'popup', minutes: 30 },    // 30min popup
        ],
      },
      colorId: '6', // Tangerine/orange to match brand
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
    };

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!calRes.ok) {
      const err = await calRes.json();
      throw new Error(`Google Calendar API error: ${calRes.status} — ${JSON.stringify(err.error?.message || err)}`);
    }

    const calEvent = await calRes.json();
    console.log(`Calendar event created: ${calEvent.id} — ${calEvent.summary} on ${startTime.toISOString()}`);

    // Persist the calendar event ID back to the ContractorProject if we have one
    if (contractor_project_id) {
      await base44.asServiceRole.entities.ContractorProject.update(contractor_project_id, {
        google_calendar_event_id: calEvent.id,
        walkthrough_date: startTime.toISOString().split('T')[0],
      });
    }

    // Send internal team notification email with calendar link
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey && teamEmail) {
      const calLink = calEvent.htmlLink || '#';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${companyName} <noreply@coenconstruction.com>`,
          to: teamEmail,
          subject: `📅 Walkthrough Scheduled: ${full_name} — ${projectLabel}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
              <div style="background:#1B2B3A;padding:20px 28px;border-radius:8px 8px 0 0;">
                <h2 style="color:#fff;margin:0;font-size:18px;">Walkthrough Auto-Scheduled ✅</h2>
              </div>
              <div style="border:1px solid #e5e5e5;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 16px;color:#333;font-size:15px;">A walkthrough has been automatically added to your Google Calendar for:</p>
                <table style="font-size:14px;color:#444;border-collapse:collapse;width:100%">
                  <tr><td style="padding:5px 0;font-weight:600;width:120px">Client</td><td>${full_name}</td></tr>
                  ${phone ? `<tr><td style="padding:5px 0;font-weight:600">Phone</td><td><a href="tel:${phone}" style="color:#E35235">${phone}</a></td></tr>` : ''}
                  ${email ? `<tr><td style="padding:5px 0;font-weight:600">Email</td><td><a href="mailto:${email}" style="color:#E35235">${email}</a></td></tr>` : ''}
                  ${address ? `<tr><td style="padding:5px 0;font-weight:600">Address</td><td>${address}</td></tr>` : ''}
                  <tr><td style="padding:5px 0;font-weight:600">Project</td><td>${projectLabel}</td></tr>
                  <tr><td style="padding:5px 0;font-weight:600">Source</td><td>${sourceLabel}</td></tr>
                  <tr><td style="padding:5px 0;font-weight:600">Scheduled</td><td>${startTime.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} ET</td></tr>
                </table>
                <div style="margin-top:24px;display:flex;gap:12px;">
                  <a href="${calLink}" style="display:inline-block;background:#E35235;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-right:10px;">View in Google Calendar →</a>
                  ${contractor_project_id ? `<a href="${appUrl}" style="display:inline-block;background:#1B2B3A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Open Project →</a>` : ''}
                </div>
                <p style="margin:20px 0 0;font-size:12px;color:#999;">Tip: Call the client to confirm the time before the visit. The client has also received a calendar invite if their email was provided.</p>
              </div>
            </div>
          `,
        }),
      });
    }

    return Response.json({
      success: true,
      calendar_event_id: calEvent.id,
      calendar_link: calEvent.htmlLink,
      scheduled_for: startTime.toISOString(),
    });

  } catch (error) {
    console.error('scheduleLeadWalkthrough error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});