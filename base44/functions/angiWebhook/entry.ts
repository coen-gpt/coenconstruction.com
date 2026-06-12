import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Angi SPID: 29783405
// Angi sends leads via HTTP POST to this webhook URL.
// Configure in Angi Pro dashboard → Settings → Lead Delivery → Webhook
// Payload format: Angi Lead Delivery API (XML or JSON depending on your config)

const ANGI_SPID = '29783405';

// Angi sends some fields as numbers (zip, phone, lead ids) depending on the
// payload version — every extracted value goes through this so string methods
// downstream can never throw (a thrown error = 500 = Angi retry storm).
const str = (v) => (v === null || v === undefined) ? '' : String(v).trim();

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
    const method = req.method;
    const url = new URL(req.url);

    // Log every incoming request for debugging
    console.log('=== ANGI WEBHOOK HIT ===');
    console.log('Method:', method);
    console.log('Content-Type:', contentType);
    console.log('Query params:', url.searchParams.toString());
    console.log('Raw body (first 2000 chars):', rawBody.substring(0, 2000));
    console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));

    // Handle GET verification pings from Angi
    if (method === 'GET') {
      console.log('GET ping received — returning 200 OK');
      return new Response('OK', { status: 200 });
    }

    // If body is empty, return 200 (Angi sometimes sends test pings)
    if (!rawBody.trim()) {
      console.log('Empty body — returning 200');
      return new Response('OK', { status: 200 });
    }

    let lead_data = {};

    // Parse body — Angi sends XML or JSON depending on account configuration
    if (contentType.includes('xml') || rawBody.trim().startsWith('<')) {
      console.log('Parsing as XML');
      lead_data = parseAngiXml(rawBody);
    } else {
      try {
        const json = JSON.parse(rawBody);
        console.log('Parsed JSON keys:', Object.keys(json));
        console.log('Full JSON payload:', JSON.stringify(json));

        // Angi Lead Delivery API format (the most common modern format)
        // Fields: srId, taskName, comments, firstName, lastName, email, phone,
        //         address (street/city/state/zip), spid, budget, timeFrame
        // Some Angi payload versions send the contact as a single "name" field
        // (real May-2026 leads arrived with email + comments but no firstName) —
        // split it so the customer's name is never lost.
        const singleName = str(json.name || json.contactName || json.customerName || json.fullName);
        const [splitFirst, ...splitRest] = singleName.split(/\s+/).filter(Boolean);

        lead_data = {
          lead_id: str(json.leadOid || json.srOid || json.LeadID || json.lead_id || json.id || json.leadId),
          first_name: str(json.firstName || json.FirstName || json.first_name || json.fname || json.customer?.first_name) || splitFirst || '',
          last_name: str(json.lastName || json.LastName || json.last_name || json.lname || json.customer?.last_name) || splitRest.join(' '),
          email: str(json.email || json.Email || json.customer?.email),
          phone: str(json.primaryPhone || json.phone || json.Phone || json.phoneNumber || json.PhoneNumber || json.customer?.phone),
          address: str(json.address || json.street || json.Address || json.serviceAddress?.street),
          city: str(json.city || json.City || json.serviceAddress?.city),
          state: str(json.stateProvince || json.state || json.State || json.serviceAddress?.state) || 'MA',
          zip: str(json.postalCode || json.zip || json.Zip || json.zipCode || json.ZipCode || json.serviceAddress?.zip),
          task: str(json.taskName || json.TaskName || json.task || json.category || json.serviceType || json.CategoryName),
          description: str(json.comments || json.Comments || json.description || json.notes),
          budget: str(json.budget || json.Budget),
          timeline: str(json.timeFrame || json.Timeline || json.timeline || json.timeframe),
          spid: str(json.spid || json.SPID),
          raw: json,
        };

        console.log('Mapped lead_data:', JSON.stringify(lead_data));
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr.message);
        console.log('Body was not valid JSON. Raw:', rawBody);
        // Try XML as fallback
        lead_data = parseAngiXml(rawBody);
      }
    }

    // Validate it's for our SPID (if provided in payload)
    if (lead_data.spid && lead_data.spid !== ANGI_SPID) {
      console.warn(`SPID mismatch: got ${lead_data.spid}, expected ${ANGI_SPID}`);
      // Don't block — log and continue, in case SPID format differs
    }

    const fullName = [lead_data.first_name, lead_data.last_name].filter(Boolean).join(' ') || 'Angi Customer';
    const fullAddress = [lead_data.address, lead_data.city, lead_data.state, lead_data.zip].filter(Boolean).join(', ');
    const projectType = mapAngiTask(lead_data.task);
    // ContractorProject's enum uses "Other" where Lead uses "General Inquiry"
    // (same mapping the Angi backfill applies) — sending GI to the project
    // writes an out-of-enum value that type filters and dropdowns can't match.
    const projectTypeForProject = projectType === 'General Inquiry' ? 'Other' : projectType;

    // When nothing identifiable was extracted, the payload format wasn't one we
    // recognize. Still capture the lead, but preserve the raw body on the record
    // so the office can recover the customer — in May 2026 three real customers
    // arrived as empty "Angi Customer" shells with the payload discarded.
    const unparsed = !lead_data.first_name && !lead_data.last_name && !lead_data.email && !lead_data.phone && !lead_data.lead_id;

    // Deduplicate. Angi retries the webhook every ~15 minutes until it gets a
    // clean 200, and not every payload carries a lead id — so dedupe BOTH by
    // angi_lead_id and by matching email/phone among recent Angi leads.
    // (A missing-id retry storm previously created triplicate projects.)
    let existingLead = null;
    if (lead_data.lead_id) {
      const existing = await base44.asServiceRole.entities.Lead.filter({ angi_lead_id: lead_data.lead_id });
      if (existing.length > 0) existingLead = existing[0];
    }
    const email = (lead_data.email || '').toLowerCase().trim();
    const phoneDigits = (lead_data.phone || '').replace(/\D/g, '');
    if (!existingLead && (email || phoneDigits)) {
      const recentLeads = await base44.asServiceRole.entities.Lead.filter({ source: 'Angi' }, '-created_date', 100);
      const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
      existingLead = recentLeads.find(l =>
        new Date(l.created_date).getTime() > cutoff && (
          (email && (l.email || '').toLowerCase().trim() === email) ||
          (phoneDigits && (l.phone || '').replace(/\D/g, '') === phoneDigits)
        )
      ) || null;
    }
    if (existingLead?.contractor_project_id) {
      console.log(`Duplicate Angi lead (${existingLead.id}) — skipping`);
      return Response.json({ success: true, duplicate: true, lead_id: existingLead.id });
    }
    // A duplicate WITHOUT a linked project means a prior attempt died between
    // creating the Lead and the project — fall through and heal it.
    if (existingLead) console.log(`Duplicate Angi lead (${existingLead.id}) missing its project — healing`);

    // ── 1. Create Lead record FIRST ────────────────────────────────────────
    // The Lead is what dedupe keys on. Creating it before the project means a
    // project-create failure can never cause an orphan-project retry storm
    // (the Ghardy Daniel / Raheal getahun incidents left 11 duplicate projects
    // each because retries kept re-creating projects with no Lead to dedupe on).
    const leadRecord = existingLead || await base44.asServiceRole.entities.Lead.create({
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
        unparsed ? `\n[Unrecognized Angi payload — raw body preserved for manual recovery]\n${rawBody.substring(0, 1500)}` : null,
      ].filter(Boolean).join('\n'),
      notes: 'Auto-created from Angi lead.',
      angi_lead_id: lead_data.lead_id || null,
      angi_task: lead_data.task || null,
      angi_budget: lead_data.budget || null,
      angi_timeline: lead_data.timeline || null,
      angi_raw: lead_data.raw || { raw_body: rawBody.substring(0, 4000) },
    });

    // ── 2. Create ContractorProject and link it back ──────────────────────
    const project = await base44.asServiceRole.entities.ContractorProject.create({
      client_name: fullName,
      client_email: lead_data.email || '',
      client_phone: lead_data.phone || '',
      client_address: lead_data.address || '',
      client_city: lead_data.city || '',
      client_zipcode: lead_data.zip || '',
      project_type: projectTypeForProject,
      status: 'walkthrough',
      description: lead_data.description || '',
      scope_of_work: [
        `Angi Lead — Task: ${lead_data.task || 'Not specified'}`,
        lead_data.budget ? `Budget: ${lead_data.budget}` : null,
        lead_data.timeline ? `Timeline: ${lead_data.timeline}` : null,
        lead_data.description ? `\nCustomer Notes:\n${lead_data.description}` : null,
      ].filter(Boolean).join('\n'),
      internal_notes: `Lead Source: Angi (SPID ${ANGI_SPID})\nAngi Lead ID: ${lead_data.lead_id || 'N/A'}\nReceived: ${new Date().toISOString()}`,
      tags: ['Angi'],
    });

    await base44.asServiceRole.entities.Lead.update(leadRecord.id, {
      contractor_project_id: project.id,
      notes: `Auto-created from Angi lead. Project created: /estimator/projects/${project.id}`,
    });

    // ── 3. Notifications ───────────────────────────────────────────────────
    // Creating the Lead record fires the sendLeadNotification create-hook,
    // which sends the ONE internal alert, the client welcome email, and the
    // self-booking link. This webhook used to send its own alert + welcome +
    // booking link on top of that — four emails per lead, multiplied by Angi
    // retries. It now does nothing extra.

    return Response.json({
      success: true,
      duplicate: !!existingLead,
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