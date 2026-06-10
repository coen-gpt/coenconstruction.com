import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public, token-secured. Returns the onboarding record (so the new hire can
// resume where they left off) plus the company info needed by the portal.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

    const records = await base44.asServiceRole.entities.EmployeeOnboarding.filter({ onboarding_token: token });
    const record = records[0];
    if (!record) return Response.json({ error: "This onboarding link is invalid." }, { status: 404 });
    if (record.token_expires && new Date(record.token_expires) < new Date()) {
      return Response.json({ error: "This onboarding link has expired. Please ask the office to resend it." }, { status: 410 });
    }

    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const profile = profiles?.[0] || {};

    return Response.json({
      onboarding: {
        id: record.id,
        full_name: record.full_name,
        email: record.email,
        phone: record.phone,
        position: record.position,
        start_date: record.start_date,
        worker_type: record.worker_type,
        status: record.status,
        personal_info: record.personal_info || {},
        form_w4: record.form_w4 || {},
        form_m4: record.form_m4 || {},
        form_w9: record.form_w9 || {},
        id_front_url: record.id_front_url || "",
        id_back_url: record.id_back_url || "",
        id_capture_method: record.id_capture_method || "",
        handbook_acknowledged: !!record.handbook_acknowledged,
        signed_name: record.signed_name || "",
        submitted_at: record.submitted_at || "",
        review_notes: record.review_notes || "",
      },
      company: {
        name: profile.company_name || "Coen Construction",
        logo_url: profile.logo_url || "",
        brand_color: profile.brand_color || "#E35235",
        employee_handbook_url: profile.employee_handbook_url || "",
        employee_handbook_name: profile.employee_handbook_name || "Employee Handbook",
        phone: profile.phone || "(617) 857-COEN",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
