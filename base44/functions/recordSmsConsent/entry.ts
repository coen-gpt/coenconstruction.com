import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public endpoint used by the contact / design-preview forms to record A2P
// 10DLC SMS consent. The SmsConsent entity is RLS-locked (phone-number PII),
// so the dedupe-by-phone and create/update happen here with the service role
// and a server-side timestamp.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone_number || "").replace(/[\s().-]/g, "").trim();
    if (!phone || !body.sms_consent_text_version) {
      return Response.json({ error: "phone_number and sms_consent_text_version are required" }, { status: 400 });
    }

    const payload = {
      phone_number: phone,
      client_name: String(body.client_name || "").slice(0, 200),
      client_email: String(body.client_email || "").toLowerCase().slice(0, 200),
      sms_opt_in_status: true,
      sms_opt_in_timestamp: new Date().toISOString(),
      sms_opt_in_method: 'WEB_FORM',
      sms_consent_text_version: String(body.sms_consent_text_version).slice(0, 100),
      source_lead_id: String(body.source_lead_id || "").slice(0, 64),
    };
    // A2P compliance: prefer the caller-observed IP, fall back to request headers
    const ip = String(body.sms_opt_in_ip || "").slice(0, 64)
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) payload.sms_opt_in_ip = ip;

    const existing = await base44.asServiceRole.entities.SmsConsent.filter({ phone_number: phone });
    if (existing[0]) {
      await base44.asServiceRole.entities.SmsConsent.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.SmsConsent.create(payload);
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
