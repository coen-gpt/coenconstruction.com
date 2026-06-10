import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) return Response.json({ error: 'Invalid portal link' }, { status: 404 });
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: 'This portal link has expired. Please contact Coen Construction for a new link.' }, { status: 410 });
    }

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: portal.project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const estimates = await base44.asServiceRole.entities.Estimate.filter({ project_id: portal.project_id });

    // Punchlist (end-of-project) — latest record for this project, if any
    let punchlist = null;
    try {
      const punchlists = await base44.asServiceRole.entities.Punchlist.filter({ project_id: portal.project_id });
      punchlist = punchlists.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))[0] || null;
    } catch (_) { /* punchlist is optional */ }

    // Company info the portal needs (deposit %, contract terms) — sanitized
    let company = null;
    try {
      const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
      const cp = profiles[0];
      if (cp) {
        company = {
          company_name: cp.company_name,
          phone: cp.phone,
          deposit_percentage: cp.deposit_percentage,
          estimate_terms: cp.estimate_terms,
          contract_template_url: cp.contract_template_url,
        };
      }
    } catch (_) { /* company info is optional */ }

    // Update last viewed
    await base44.asServiceRole.entities.CustomerPortal.update(portal.id, {
      last_viewed_at: new Date().toISOString(),
    });

    // Sanitize: strip internal_notes from estimates line items, strip internal_notes from project
    const cleanProject = {
      id: project.id,
      client_name: project.client_name,
      client_email: project.client_email,
      client_address: project.client_address,
      client_city: project.client_city,
      client_zipcode: project.client_zipcode,
      project_type: project.project_type,
      status: project.status,
      scope_of_work: project.scope_of_work,
      rooms: project.rooms,
      photos: project.photos,
      photos_360: project.photos_360 || [],
      documents_meta: project.documents_meta || [],
      workflow_stages: project.workflow_stages || [],
      workflow_schedule: project.workflow_schedule || {},
      contract_signed_pdf_url: project.contract_signed_pdf_url || null,
      client_signed: project.client_signed,
      signed_date: project.signed_date,
      deposit_paid: project.deposit_paid || false,
      deposit_amount: project.deposit_amount || null,
      deposit_payment_method: project.deposit_payment_method || null,
      portal_access_granted: project.portal_access_granted || false,
      original_estimate_total: project.original_estimate_total,
      adjusted_total: project.adjusted_total,
      walkthrough_date: project.walkthrough_date,
    };

    const cleanEstimates = estimates.map(e => ({
      id: e.id,
      type: e.type,
      status: e.status,
      title: e.title,
      grand_total: e.grand_total,
      notes: e.notes,
      valid_until: e.valid_until,
      change_order_number: e.change_order_number,
      scope_change_description: e.scope_change_description,
      line_items: (e.line_items || []).map(item => ({
        id: item.id,
        parent_group: item.parent_group,
        subgroup: item.subgroup,
        title: item.title,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        total: item.total,
        is_allowance: item.is_allowance,
        // internal_notes, unit_cost, markup_pct, cost_type intentionally
        // omitted — internal cost structure never leaves the office
      })),
    }));

    return Response.json({
      portal: {
        client_name: portal.client_name,
        customer_notes: portal.customer_notes || [],
        chat_messages: portal.chat_messages || [],
      },
      project: cleanProject,
      estimates: cleanEstimates,
      punchlist,
      company,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});