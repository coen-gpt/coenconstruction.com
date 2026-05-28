import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Client confirms a walkthrough slot. Creates the Google Calendar event,
 * sends confirmation emails to both client and team, and updates the lead/project.
 *
 * Payload: { lead_token, slot_start, slot_end }
 */

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
    const { lead_token, slot_start, slot_end } = await req.json();

    if (!lead_token || !slot_start || !slot_end) {
      return Response.json({ error: 'lead_token, slot_start, and slot_end are required' }, { status: 400 });
    }

    // Validate token
    const leads = await base44.asServiceRole.entities.Lead.filter({ booking_token: lead_token });
    if (!leads || leads.length === 0) {
      return Response.json({ error: 'Invalid or expired booking link.' }, { status: 404 });
    }
    const lead = leads[0];

    const { full_name, email, phone, project_type, address, source, contractor_project_id } = lead;

    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    const companyName = company.company_name || 'Coen Construction';
    const teamEmail = company.lead_notification_email || 'scott@coenconstruction.com';
    const brandColor = company.brand_color || '#E35235';

    const projectLabel = PROJECT_LABELS[project_type] || project_type || 'General Inquiry';
    const sourceLabel = source || 'Website';

    const startTime = new Date(slot_start);
    const endTime = new Date(slot_end);

    const appUrl = contractor_project_id
      ? `https://coenconstruction.base44.app/estimator/projects/${contractor_project_id}`
      : 'https://coenconstruction.base44.app/estimator/projects';

    const dateLabel = startTime.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Create Google Calendar event
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const description = [
      `📋 Lead Walkthrough — ${projectLabel}`,
      ``,
      `Client: ${full_name}`,
      phone ? `Phone: ${phone}` : null,
      email ? `Email: ${email}` : null,
      address ? `Address: ${address}` : null,
      `Project Type: ${projectLabel}`,
      `Lead Source: ${sourceLabel}`,
      ``,
      `⚡ Client self-scheduled this appointment.`,
      ``,
      contractor_project_id ? `View Project: ${appUrl}` : null,
    ].filter(Boolean).join('\n');

    const eventBody = {
      summary: `🏠 Walkthrough: ${full_name} — ${projectLabel}`,
      description,
      start: { dateTime: startTime.toISOString(), timeZone: 'America/New_York' },
      end: { dateTime: endTime.toISOString(), timeZone: 'America/New_York' },
      attendees: [
        { email: teamEmail, displayName: companyName },
        ...(email ? [{ email, displayName: full_name }] : []),
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      colorId: '6',
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
    };

    const calendarId = Deno.env.get('GOOGLE_WALKTHROUGH_CALENDAR_ID') || 'primary';
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      }
    );

    if (!calRes.ok) {
      const err = await calRes.json();
      throw new Error(`Google Calendar error: ${calRes.status} — ${JSON.stringify(err.error?.message || err)}`);
    }

    const calEvent = await calRes.json();
    console.log(`Booking confirmed: ${calEvent.id} for ${full_name} at ${slot_start}`);

    // Update lead with booked date + invalidate token
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      status: 'Contacted',
      notes: `${lead.notes || ''}\n[Auto] Walkthrough booked by client for ${dateLabel} ET`.trim(),
    });

    // Update contractor project if linked
    if (contractor_project_id) {
      await base44.asServiceRole.entities.ContractorProject.update(contractor_project_id, {
        google_calendar_event_id: calEvent.id,
        walkthrough_date: startTime.toISOString().split('T')[0],
      });
    }

    // Send confirmation emails (client + team)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const firstName = full_name?.split(' ')[0] || 'there';

      // Client confirmation email
      if (email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${companyName} <noreply@coenconstruction.com>`,
            to: email,
            subject: `✅ Your Walkthrough is Confirmed — ${dateLabel} ET`,
            html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:${brandColor};padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">${companyName}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Licensed General Contractor · Greater Boston, MA</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;color:#1B2B3A;font-size:22px;">Your Walkthrough is Confirmed! ✅</h2>
          <p style="margin:0 0 24px;font-size:16px;color:#333;line-height:1.6;">Hi <strong>${firstName}</strong>, we're excited to meet with you!</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;border:1px solid #efefef;margin-bottom:28px;">
            <tr><td style="padding:24px 28px;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">Appointment Details</p>
              <p style="margin:0 0 6px;font-size:15px;color:#333;">📅 <strong>${dateLabel} ET</strong></p>
              ${address ? `<p style="margin:0 0 6px;font-size:15px;color:#333;">📍 <strong>${address}</strong></p>` : ''}
              <p style="margin:0;font-size:15px;color:#333;">🏗️ <strong>${projectLabel}</strong></p>
            </td></tr>
          </table>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">You'll also receive a Google Calendar invite at this email address. A member of our team will call to confirm the day before your appointment.</p>
          <p style="margin:0 0 6px;font-size:15px;color:#333;">Questions? Reach us anytime:</p>
          <p style="margin:0 0 32px;font-size:15px;color:#333;">
            📞 <a href="tel:${company.phone || ''}" style="color:${brandColor};text-decoration:none;font-weight:600;">${company.phone || ''}</a>
            &nbsp;&nbsp;✉️ <a href="mailto:${company.email || ''}" style="color:${brandColor};text-decoration:none;font-weight:600;">${company.email || ''}</a>
          </p>
          <p style="margin:0;font-size:15px;color:#333;">We look forward to seeing you,<br/><strong>The ${companyName} Team</strong></p>
        </td></tr>
        <tr><td style="background:#1B2B3A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);">${companyName} · Licensed &amp; Insured · Greater Boston, MA</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          }),
        });
      }

      // Team notification
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${companyName} <noreply@coenconstruction.com>`,
          to: teamEmail,
          subject: `📅 Walkthrough Booked by Client: ${full_name} — ${dateLabel} ET`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#1B2B3A;padding:20px 28px;border-radius:8px 8px 0 0;">
              <h2 style="color:#fff;margin:0;font-size:18px;">Client Self-Scheduled a Walkthrough ✅</h2>
            </div>
            <div style="border:1px solid #e5e5e5;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
              <table style="font-size:14px;color:#444;border-collapse:collapse;width:100%">
                <tr><td style="padding:5px 0;font-weight:600;width:120px">Client</td><td>${full_name}</td></tr>
                ${phone ? `<tr><td style="padding:5px 0;font-weight:600">Phone</td><td><a href="tel:${phone}" style="color:#E35235">${phone}</a></td></tr>` : ''}
                ${email ? `<tr><td style="padding:5px 0;font-weight:600">Email</td><td><a href="mailto:${email}" style="color:#E35235">${email}</a></td></tr>` : ''}
                ${address ? `<tr><td style="padding:5px 0;font-weight:600">Address</td><td>${address}</td></tr>` : ''}
                <tr><td style="padding:5px 0;font-weight:600">Project</td><td>${projectLabel}</td></tr>
                <tr><td style="padding:5px 0;font-weight:600">Scheduled</td><td><strong>${dateLabel} ET</strong></td></tr>
              </table>
              <div style="margin-top:24px;">
                <a href="${calEvent.htmlLink || '#'}" style="display:inline-block;background:#E35235;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-right:10px;">View in Google Calendar →</a>
                ${contractor_project_id ? `<a href="${appUrl}" style="display:inline-block;background:#1B2B3A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Open Project →</a>` : ''}
              </div>
            </div>
          </div>`,
        }),
      });
    }

    return Response.json({
      success: true,
      calendar_event_id: calEvent.id,
      calendar_link: calEvent.htmlLink,
      scheduled_for: startTime.toISOString(),
      date_label: dateLabel,
    });

  } catch (error) {
    console.error('confirmBooking error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});