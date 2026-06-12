/**
 * Record a subcontractor's explicit Net-30 payment-terms acknowledgment without
 * re-running the full onboarding packet. Used by existing subs whose packet was
 * signed before the acknowledgment checkbox existed. Token-validated the same
 * way as submitSubOnboardingPacket (packet_form_data.onboarding_token).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, vendor_id } = body;

    if (!token || !vendor_id) return Response.json({ error: "Invalid request" }, { status: 400 });

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

    const now = new Date();
    await base44.asServiceRole.entities.Vendor.update(vendor_id, {
      packet_form_data: {
        ...(vendor.packet_form_data || {}),
        payment_terms_acknowledged: true,
        payment_terms_acknowledged_at: now.toISOString(),
      },
    });

    // Notify the office — best-effort, the acknowledgment is already saved
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <no-reply@coenconstruction.com>",
          to: ["scott@coenconstruction.com"],
          subject: `✅ Net-30 Payment Terms Acknowledged — ${vendor.company_name}`,
          text: `${vendor.company_name} (${vendor.contact_name || "—"}) acknowledged the 30-day payment terms on ${now.toLocaleString()}.`,
        }),
      }).catch((e) => console.error("Resend send error:", e.message));
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
