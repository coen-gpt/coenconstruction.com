import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, vendor_id } = await req.json();

    if (!token || !vendor_id) return Response.json({ error: "Invalid link" }, { status: 400 });

    const vendors = await base44.asServiceRole.entities.Vendor.filter({ id: vendor_id });
    const vendor = vendors[0];
    if (!vendor) return Response.json({ error: "Not found" }, { status: 404 });

    const storedToken = vendor.packet_form_data?.onboarding_token;
    const tokenExpires = vendor.packet_form_data?.onboarding_token_expires;

    if (!storedToken || storedToken !== token) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }
    if (tokenExpires && new Date(tokenExpires) < new Date()) {
      return Response.json({ error: "Link expired" }, { status: 401 });
    }

    // Return vendor data (strip sensitive token)
    return Response.json({
      vendor: {
        id: vendor.id,
        company_name: vendor.company_name,
        contact_name: vendor.contact_name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        packet_status: vendor.packet_status,
        packet_signed_at: vendor.packet_signed_at,
        packet_signed_name: vendor.packet_signed_name,
        packet_form_data: vendor.packet_form_data,
        workers_comp_url: vendor.workers_comp_url,
        workers_comp_expiry: vendor.workers_comp_expiry,
        liability_ins_url: vendor.liability_ins_url,
        liability_ins_expiry: vendor.liability_ins_expiry,
        w9_url: vendor.w9_url,
        insurance_status: vendor.insurance_status,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});