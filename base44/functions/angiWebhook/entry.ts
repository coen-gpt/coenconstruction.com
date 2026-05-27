import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Angi SPID: 29783405
// Angi sends leads via HTTP POST to this webhook URL.
// Configure in Angi Pro dashboard → Settings → Lead Delivery → Webhook
// Payload format: Angi Lead Delivery API (XML or JSON depending on your config)

const ANGI_SPID = '29783405';

// Map Angi task names → our project types
function mapAngiTask(task = '') {
  const t = task.toLowerCase();
  if (t.includes('kitchen')) return 'Kitchen Remodel';
  if (t.includes('bathroom') || t.includes('bath')) return 'Bathroom Remodel';
  if (t.includes('deck') || t.includes('porch') || t.includes('pergola')) return 'Deck / Porch / Pergola';
  if (t.includes('siding')) return 'Siding';
  if (t.includes('addition') || t.includes('room add')) return 'Home Addition';
  if (t.includes('snow')) return 'Snow Removal';
  if (t.includes('carpentry') || t.includes('trim') || t.includes('cabinet')) return 'Custom Carpentry';
  if (t.includes('roof')) return 'Roofing';
  if (t.includes('renovation') || t.includes('remodel')) return 'Full Home Renovation';
  return 'General Inquiry';
}

// Parse Angi XML payload into a flat JS object
function parseAngiXml(xml) {
  const get = (tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() : '';
  };
  return {
    lead_id: get('LeadID') || get('lead_id') || get('id'),
    first_name: get('FirstName') || get('first_name'),
    last_name: get('LastName') || get('last_name'),
    email: get('Email') || get('email'),
    phone: get('Phone') || get('phone') || get('PhoneNumber'),
    address: get('Address') || get('address') || get('Street'),
    city: get('City') || get('city'),
    state: get('State') || get('state') || 'MA',
    zip: get('Zip') || get('ZipCode') || get('zip'),
    task: get('TaskName') || get('task') || get('ServiceRequested') || get('Category'),
    description: get('Comments') || get('Description') || get('description') || get('Notes'),
    budget: get('Budget') || get('budget'),
    timeline: get('Timeline') || get('timeline') || get('TimeFrame'),
    spid: get('SPID') || get('spid'),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const contentType = req.headers.get('content-type') || '';
    const rawBody = await req.text();

    let lead_data = {};

    // Parse body — Angi sends XML or JSON depending on account configuration
    if (contentType.includes('xml') || rawBody.trim().startsWith('<')) {
      lead_data = parseAngiXml(rawBody);
    } else {
      try {
        const json = JSON.parse(rawBody);
        // Normalize common Angi JSON formats
        lead_data = {
          lead_id: json.LeadID || json.lead_id || json.id || json.srId,
          first_name: json.FirstName || json.first_name || json.fname || (json.customer?.first_name),
          last_name: json.LastName || json.last_name || json.lname || (json.customer?.last_name),
          email: json.Email || json.email || (json.customer?.email),
          phone: json.Phone || json.phone || json.PhoneNumber || (json.customer?.phone),
          address: json.Address || json.address || json.street || (json.serviceAddress?.street),
          city: json.City || json.city || (json.serviceAddress?.city),
          state: json.State || json.state || (json.serviceAddress?.state) || 'MA',
          zip: json.Zip || json.zip || json.ZipCode || (json.serviceAddress?.zip),
          task: json.TaskName || json.task || json.category || json.serviceType || json.CategoryName,
          description: json.Comments || json.description || json.comments || json.notes,
          budget: json.Budget || json.budget,
          timeline: json.Timeline || json.timeline || json.timeframe,
          spid: json.SPID || json.spid,
          raw: json,
        };
      } catch (_) {
        return Response.json({ error: 'Could not parse request body' }, { status: 400 });
      }
    }

    // Validate it's for our SPID (if provided in payload)
    if (lead_data.spid && lead_data.spid !== ANGI_SPID) {
      console.warn(`SPID mismatch: got ${lead_data.spid}, expected ${ANGI_SPID}`);
      return Response.json({ error: 'SPID mismatch' }, { status: 403 });
    }

    const fullName = [lead_data.first_name, lead_data.last_name].filter(Boolean).join(' ') || 'Angi Customer';
    const fullAddress = [lead_data.address, lead_data.city, lead_data.state, lead_data.zip].filter(Boolean).join(', ');
    const projectType = mapAngiTask(lead_data.task);

    // Deduplicate by Angi lead ID
    if (lead_data.lead_id) {
      const existing = await base44.asServiceRole.entities.Lead.filter({ angi_lead_id: lead_data.lead_id });
      if (existing.length > 0) {
        console.log(`Duplicate Angi lead ${lead_data.lead_id} — skipping`);
        return Response.json({ success: true, duplicate: true, lead_id: existing[0].id });
      }
    }

    // ── 1. Create ContractorProject ────────────────────────────────────────
    const project = await base44.asServiceRole.entities.ContractorProject.create({
      client_name: fullName,
      client_email: lead_data.email || '',
      client_phone: lead_data.phone || '',
      client_address: lead_data.address || '',
      client_city: lead_data.city || '',
      client_zipcode: lead_data.zip || '',
      project_type: projectType,
      status: 'walkthrough',
      description: lead_data.description || '',
      scope_of_work: [
        `Angi Lead — Task: ${lead_data.task || 'Not specified'}`,
        lead_data.budget ? `Budget: ${lead_data.budget}` : null,
        lead_data.timeline ? `Timeline: ${lead_data.timeline}` : null,
        lead_data.description ? `\nCustomer Notes:\n${lead_data.description}` : null,
      ].filter(Boolean).join('\n'),
      internal_notes: `Lead Source: Angi (SPID ${ANGI_SPID})\nAngi Lead ID: ${lead_data.lead_id || 'N/A'}\nReceived: ${new Date().toISOString()}`,
      tags: ['angi'],
    });

    // ── 2. Create Lead record ──────────────────────────────────────────────
    const leadRecord = await base44.asServiceRole.entities.Lead.create({
      full_name: fullName,
      email: lead_data.email || '',
      phone: lead_data.phone || '',
      address: fullAddress,
      project_type: projectType,
      source: 'Angi',
      status: 'New',
      message: [
        lead_data.task ? `Service Requested: ${lead_data.task}` : null,
        lead_data.budget ? `Budget: ${lead_data.budget}` : null,
        lead_data.timeline ? `Timeline: ${lead_data.timeline}` : null,
        lead_data.description ? `\n${lead_data.description}` : null,
      ].filter(Boolean).join('\n'),
      notes: `Auto-created from Angi lead. Project created: /estimator/projects/${project.id}`,
      contractor_project_id: project.id,
      angi_lead_id: lead_data.lead_id || null,
      angi_task: lead_data.task || null,
      angi_budget: lead_data.budget || null,
      angi_timeline: lead_data.timeline || null,
      angi_raw: lead_data.raw || {},
    });

    // ── 3. Send lead notification email + client welcome email ────────────
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const notifyEmail = profiles[0]?.lead_notification_email || 'scott@coenconstruction.com';
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Send personalized welcome email to the client (fire-and-forget)
    if (resendApiKey && lead_data.email) {
      base44.asServiceRole.functions.invoke('sendLeadWelcomeEmail', {
        full_name: fullName,
        email: lead_data.email,
        project_type: projectType,
        source: 'Angi',
      }).catch((e) => console.error('Welcome email failed:', e));
    }

    // Auto-schedule walkthrough on Google Calendar (fire-and-forget)
    base44.asServiceRole.functions.invoke('scheduleLeadWalkthrough', {
      full_name: fullName,
      email: lead_data.email || '',
      phone: lead_data.phone || '',
      project_type: projectType,
      address: fullAddress,
      source: 'Angi',
      contractor_project_id: project.id,
      lead_id: leadRecord.id,
    }).catch((e) => console.error('Calendar scheduling failed:', e));

    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@coenconstruction.com',
          to: notifyEmail,
          subject: `🔔 New Angi Lead: ${fullName} — ${projectType}`,
          html: `
            <h2 style="color:#E35235;">New Angi Lead Received</h2>
            <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
              <tr><td style="padding:6px 0;font-weight:bold;color:#555;width:140px">Name</td><td>${fullName}</td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#555">Email</td><td><a href="mailto:${lead_data.email}">${lead_data.email || '—'}</a></td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#555">Phone</td><td><a href="tel:${lead_data.phone}">${lead_data.phone || '—'}</a></td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#555">Address</td><td>${fullAddress || '—'}</td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#555">Service</td><td>${lead_data.task || projectType}</td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#555">Budget</td><td>${lead_data.budget || '—'}</td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#555">Timeline</td><td>${lead_data.timeline || '—'}</td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#555">Notes</td><td>${lead_data.description || '—'}</td></tr>
            </table>
            <br/>
            <a href="https://app.base44.com/estimator/projects/${project.id}" style="background:#E35235;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View Project in Estimator →</a>
          `,
        }),
      });
    }

    return Response.json({
      success: true,
      lead_id: leadRecord.id,
      contractor_project_id: project.id,
      name: fullName,
      project_type: projectType,
    });

  } catch (error) {
    console.error('Angi webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});