import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Read a vendor's document-compliance status for the public doc-upload page
// (admin-generated /sub-doc-upload?vendorId=... links). Vendor is RLS-locked,
// so this returns only the non-sensitive doc fields needed to render the
// upload UI — never tax IDs or full packet form data.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '').trim();
    if (!vendorId) return Response.json({ error: 'vendor_id required' }, { status: 400 });

    const vendors = await base44.asServiceRole.entities.Vendor.filter({ id: vendorId });
    const v = vendors[0];
    if (!v) return Response.json({ error: 'not_found' }, { status: 404 });

    return Response.json({
      vendor: {
        id: v.id,
        company_name: v.company_name,
        contact_name: v.contact_name,
        email: v.email,
        phone: v.phone,
        packet_status: v.packet_status,
        insurance_status: v.insurance_status,
        workers_comp_url: v.workers_comp_url,
        workers_comp_expiry: v.workers_comp_expiry,
        liability_ins_url: v.liability_ins_url,
        liability_ins_expiry: v.liability_ins_expiry,
        w9_url: v.w9_url,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
