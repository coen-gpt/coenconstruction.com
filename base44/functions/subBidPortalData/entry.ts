import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Token-secured data access for the public subcontractor bid portal.
// ContractorProject and Vendor are RLS-locked, so the portal reads the
// project + existing vendor (and upserts the vendor on packet submission)
// through this function, gated by the SubBid invite_token.

function sanitizeProject(p) {
  if (!p) return null;
  return {
    id: p.id,
    client_name: p.client_name,
    client_address: p.client_address,
    client_city: p.client_city,
    client_zipcode: p.client_zipcode,
    project_type: p.project_type,
    title: p.title,
    description: p.description,
    scope_of_work: p.scope_of_work,
    status: p.status,
  };
}

function sanitizeVendor(v) {
  if (!v) return null;
  return {
    id: v.id,
    company_name: v.company_name,
    contact_name: v.contact_name,
    email: v.email,
    phone: v.phone,
    address: v.address,
    packet_status: v.packet_status,
    insurance_status: v.insurance_status,
    workers_comp_url: v.workers_comp_url,
    workers_comp_expiry: v.workers_comp_expiry,
    liability_ins_url: v.liability_ins_url,
    liability_ins_expiry: v.liability_ins_expiry,
    w9_url: v.w9_url,
    // packet form data is needed to pre-fill the sub's own packet (it's their data)
    packet_form_data: v.packet_form_data || {},
  };
}

async function bidFromToken(base44, token) {
  if (!token) return null;
  const bids = await base44.asServiceRole.entities.SubBid.filter({ invite_token: String(token).trim() });
  return bids[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, action } = body;

    const bid = await bidFromToken(base44, token);
    if (!bid) return Response.json({ error: 'Invalid or expired bid link.' }, { status: 404 });

    if (action === 'get') {
      const [projects, company] = await Promise.all([
        base44.asServiceRole.entities.ContractorProject.filter({ id: bid.project_id }),
        base44.asServiceRole.entities.CompanyProfile.list(),
      ]);
      let vendor = null;
      if (bid.vendor_email) {
        const vendors = await base44.asServiceRole.entities.Vendor.filter({ email: bid.vendor_email });
        vendor = vendors[0] || null;
      }
      const profile = company?.[0] || null;
      return Response.json({
        project: sanitizeProject(projects[0] || null),
        vendor: sanitizeVendor(vendor),
        company: profile ? {
          company_name: profile.company_name,
          logo_url: profile.logo_url,
          brand_color: profile.brand_color,
          phone: profile.phone,
        } : null,
      });
    }

    if (action === 'upsertVendor') {
      const updates = body.updates || {};
      // Vendor identity is bound to the bid's invited email — never client-supplied
      let vendor = null;
      if (bid.vendor_email) {
        const vendors = await base44.asServiceRole.entities.Vendor.filter({ email: bid.vendor_email });
        vendor = vendors[0] || null;
      }
      const payload = { ...updates, email: bid.vendor_email || updates.email };
      let saved;
      if (vendor) {
        saved = await base44.asServiceRole.entities.Vendor.update(vendor.id, payload);
      } else {
        saved = await base44.asServiceRole.entities.Vendor.create({ ...payload, active: true });
      }
      return Response.json({ vendor: sanitizeVendor(saved) });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
