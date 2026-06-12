import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Client confirms a walkthrough slot. Creates the Google Calendar event,
 * sends confirmation emails to both client and team, and updates the lead/project.
 *
 * Payload: { lead_token, slot_start, slot_end }
 *      OR  { campaign_token, slot_start, slot_end } — campaign-email flow.
 *          No Lead exists yet there (email security scanners GET every link,
 *          so nothing may be created on a bare click); the Lead is created
 *          HERE, born already booked. sendLeadNotification sees the
 *          booking_event_id and skips its automations — this function sends
 *          the client + team emails itself.
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

function bookingToken() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  for (let i = 0; i < 32; i++) result += chars[rand[i] % chars.length];
  return result;
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

// One Google Calendar event color per project type, so the walkthrough
// calendar reads at a glance. Google event colorIds: 1 Lavender, 2 Sage,
// 3 Grape, 4 Flamingo, 5 Banana, 6 Tangerine, 7 Peacock, 8 Graphite,
// 9 Blueberry, 10 Basil, 11 Tomato.
const PROJECT_TYPE_COLORS = {
  'Kitchen Remodel': '6',        // Tangerine
  'Bathroom Remodel': '7',       // Peacock
  'Home Addition': '9',          // Blueberry
  'Deck / Porch / Pergola': '10', // Basil
  'Siding': '8',                 // Graphite
  'Roofing': '11',               // Tomato
  'Custom Carpentry': '5',       // Banana
  'Full Home Renovation': '3',   // Grape
  'Snow Removal': '1',           // Lavender
  'General Inquiry': '2',        // Sage
};
const FALLBACK_COLOR = '2'; // Sage — unclassified inquiries

// When lead capture didn't pin down a project type, ask the LLM to match the
// lead's free-text message to one of the known types so the event still gets
// a meaningful color. Returns null when there's nothing to go on or the model
// can't make a confident match — callers fall back to the General Inquiry color.
async function aiMatchProjectType(base44, lead) {
  const text = [lead.message, lead.angi_task].filter(Boolean).join('\n').trim();
  if (!text) return null;
  try {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `A construction company received this lead inquiry. Match it to exactly one project type from this list, or "none" if no confident match:
${Object.keys(PROJECT_TYPE_COLORS).filter(t => t !== 'General Inquiry').join(', ')}

Lead inquiry:
${text.slice(0, 1500)}

Return: {"project_type": "<exact type from the list or none>"}`,
      response_json_schema: {
        type: 'object',
        properties: { project_type: { type: 'string' } },
        required: ['project_type'],
      },
    });
    const matched = result?.project_type;
    return PROJECT_TYPE_COLORS[matched] && matched !== 'General Inquiry' ? matched : null;
  } catch (e) {
    console.error('AI project-type match failed (non-fatal):', e?.message || e);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { lead_token, campaign_token, slot_start, slot_end } = await req.json();

    if ((!lead_token && !campaign_token) || !slot_start || !slot_end) {
      return Response.json({ error: 'lead_token, slot_start, and slot_end are required' }, { status: 400 });
    }

    let lead = null;
    let recipient = null;

    if (lead_token) {
      // Validate token
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
      recipient = rows[0];
      if (!recipient || recipient.campaign_id !== verified.campaignId) {
        return Response.json({ error: 'Invalid or expired booking link.' }, { status: 404 });
      }
      // The recipient may already have a Lead — from an earlier confirmation,
      // or created at click time before scanners forced this two-step flow.
      // Reuse it instead of duplicating (also match by email+source so a
      // double-submit race loser reuses the winner's Lead).
      if (recipient.lead_id) {
        const leadRows = await base44.asServiceRole.entities.Lead.filter({ id: recipient.lead_id });
        lead = leadRows[0] || null;
      }
      if (!lead) {
        const existing = await base44.asServiceRole.entities.Lead.filter({ email: recipient.email, source: 'Email Campaign' }, '-created_date', 1);
        lead = existing[0] || null;
      }
    }

    // Idempotent: a second click / refresh / replayed request never creates a
    // duplicate calendar event. Answer with the slot that was actually booked
    // (a replay may carry a different slot_start than the original booking).
    if (lead?.booking_event_id) {
      const bookedStart = lead.booking_slot_start || slot_start;
      return Response.json({
        success: true,
        already_booked: true,
        calendar_event_id: lead.booking_event_id,
        scheduled_for: bookedStart,
        date_label: new Date(bookedStart).toLocaleString('en-US', {
          timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        }),
      });
    }

    // Campaign flow has no Lead yet — visitor details come from the recipient.
    const recipientAddress = recipient
      ? [recipient.address, recipient.city, recipient.state, recipient.zip].filter(Boolean).join(', ')
      : '';
    const full_name = lead?.full_name || recipient?.client_name || recipient?.email;
    const email = lead ? lead.email : recipient?.email;
    const phone = lead ? lead.phone : (recipient?.phone || 'Not provided');
    const project_type = lead ? lead.project_type : (recipient?.project_type || 'General Inquiry');
    const address = lead ? lead.address : recipientAddress;
    const source = lead ? lead.source : 'Email Campaign';
    const contractor_project_id = lead?.contractor_project_id || null;

    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    const companyName = company.company_name || 'Coen Construction';
    const teamEmail = company.lead_notification_email || 'scott@coenconstruction.com';
    const brandColor = company.brand_color || '#E35235';
    const logoHtml = company?.logo_url
      ? `<img src="${company.logo_url}" alt="${companyName}" height="44" style="display:inline-block;height:44px;max-width:220px;width:auto;background:#ffffff;padding:8px 14px;border-radius:8px;" />`
      : `<span style="color:#ffffff;font-size:26px;font-weight:700;">${companyName}</span>`;

    const sourceLabel = source || 'Website';

    // Event color comes from the captured project type; for unclassified
    // leads, try an AI match on the inquiry text. Never blocks the booking —
    // any failure just lands on the General Inquiry color.
    let effectiveType = PROJECT_TYPE_COLORS[project_type] ? project_type : null;
    let aiMatched = false;
    if (!effectiveType || effectiveType === 'General Inquiry') {
      const matched = await aiMatchProjectType(base44, lead || { message: recipient?.line_items || '' });
      if (matched) {
        effectiveType = matched;
        aiMatched = true;
      }
    }
    const eventColorId = PROJECT_TYPE_COLORS[effectiveType] || FALLBACK_COLOR;
    const projectLabel = PROJECT_LABELS[effectiveType || project_type] || project_type || 'General Inquiry';

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
      `Project Type: ${projectLabel}${aiMatched ? ' (AI-matched from inquiry)' : ''}`,
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
      // Only the client is invited — the event already lives on the shared team
      // calendar, and the office gets one booking-notification email. Adding
      // the team as an attendee doubled the noise per booking.
      attendees: email ? [{ email, displayName: full_name }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      colorId: eventColorId,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
    };

    const calendarId = Deno.env.get('GOOGLE_WALKTHROUGH_CALENDAR_ID') || 'c_9564c3d75db1610028f8fd25a79d1df698ea9a44e8635d953c71568202838f80@group.calendar.google.com';
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

    const autoNotes = `[Auto] Walkthrough booked by client for ${dateLabel} ET${aiMatched ? `\n[Auto] Project type "${effectiveType}" AI-matched from inquiry (was "${project_type || 'unset'}")` : ''}`;
    if (lead) {
      // Update lead: record the event id (idempotency marker) + booked date
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        status: 'Contacted',
        booking_event_id: calEvent.id,
        booking_slot_start: startTime.toISOString(),
        // Persist the AI match so admin pages and later emails agree with the
        // calendar — the note keeps the original capture value auditable.
        ...(aiMatched ? { project_type: effectiveType } : {}),
        notes: `${lead.notes || ''}\n${autoNotes}`.trim(),
      });
    } else {
      // Campaign flow: the Lead is born here, already booked. Creating it
      // still fires sendLeadNotification, which skips its welcome/auto-schedule/
      // alert when booking_event_id is already set — the emails below cover it.
      const campaignRows = await base44.asServiceRole.entities.EmailCampaign.filter({ id: recipient.campaign_id });
      const campaignName = campaignRows[0]?.name || 'Email Campaign';
      lead = await base44.asServiceRole.entities.Lead.create({
        full_name,
        email,
        phone,
        project_type: aiMatched ? effectiveType : (project_type || 'General Inquiry'),
        source: 'Email Campaign',
        status: 'Contacted',
        address,
        message: recipient.origin === 'inquiry'
          ? `Booked a walkthrough from the "${campaignName}" email campaign. Original inquiry #${recipient.quote_number || '—'} (${recipient.quote_status || 'unknown status'}): ${recipient.line_items || 'no project details'}.`
          : `Booked a walkthrough from the "${campaignName}" email campaign. Past quote #${recipient.quote_number || '—'} (${recipient.quote_status || 'unknown status'}): ${recipient.line_items || 'no line items'}.`,
        booking_token: bookingToken(),
        booking_event_id: calEvent.id,
        booking_slot_start: startTime.toISOString(),
        notes: autoNotes,
      });
    }

    // Stamp the campaign recipient: this is the moment a walkthrough was
    // genuinely requested (scanner clicks never reach here).
    if (recipient) {
      const nowIso = new Date().toISOString();
      await base44.asServiceRole.entities.CampaignRecipient.update(recipient.id, {
        walkthrough_requested_at: recipient.walkthrough_requested_at || nowIso,
        last_engaged_at: nowIso,
        lead_id: lead.id,
      }).catch((e) => console.error('CampaignRecipient stamp failed (non-fatal):', e?.message || e));
    }

    // Update contractor project if linked
    if (contractor_project_id) {
      await base44.asServiceRole.entities.ContractorProject.update(contractor_project_id, {
        google_calendar_event_id: calEvent.id,
        walkthrough_date: startTime.toISOString().split('T')[0],
        status: 'walkthrough',
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
          ${logoHtml}
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