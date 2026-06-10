import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendEmailViaResend({ to, subject, html, replyTo = "subs@coenconstruction.com" }) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Coen Construction <info@coenconstruction.com>",
      reply_to: replyTo,
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_team', body);
    const { vendor_id } = body;

    if (!vendor_id) return Response.json({ error: "vendor_id required" }, { status: 400 });

    const vendors = await base44.asServiceRole.entities.Vendor.filter({ id: vendor_id });
    const vendor = vendors[0];
    if (!vendor) return Response.json({ error: "Vendor not found" }, { status: 404 });

    const token = randomToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await base44.asServiceRole.entities.Vendor.update(vendor_id, {
      is_subcontractor: true,
      packet_status: ["completed", "approved"].includes(vendor.packet_status) ? vendor.packet_status : "in_progress",
      // Reuse reset_token pattern: store in packet_form_data
      packet_form_data: {
        ...(vendor.packet_form_data || {}),
        onboarding_token: token,
        onboarding_token_expires: expires,
      },
    });

    const appBaseUrl = (Deno.env.get("BASE44_APP_URL") || req.headers.get("origin") || "https://www.coenconstruction.com").replace(/\/$/, "");
    const portalUrl = `${appBaseUrl}/sub-onboarding?token=${token}&vendor=${vendor_id}`;

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Coen Construction</h1>
          <p style="color:#aaa;margin:4px 0 0;font-size:13px;">Licensed & Insured General Contractor</p>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-top:none;">
          <p style="font-size:16px;color:#1B2B3A;">Hi ${vendor.contact_name || vendor.company_name},</p>
          <p>Coen Construction LLC has invited you to complete your subcontractor onboarding packet. This must be completed before you can access bids or receive payments.</p>
          <p>You will need to complete:</p>
          <ol style="color:#1B2B3A;line-height:1.8;margin:16px 0;padding-left:22px;">
            <li>Company Information</li>
            <li>Insurance Certificates (Workers Comp + General Liability)</li>
            <li>W-9 Form</li>
            <li>Review &amp; Sign the Subcontractor Agreement</li>
          </ol>
          <div style="margin:24px 0;text-align:center;">
            <a href="${portalUrl}" style="background:#E35235;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
              Start My Onboarding Packet →
            </a>
          </div>
          <p style="font-size:12px;color:#888;">This link is valid for 30 days. Questions? Contact us at subs@coenconstruction.com or (617) 412-6046.</p>
        </div>
        <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
          <p style="color:#888;font-size:11px;margin:0;">Coen Construction LLC · 387 Page St, Suite 10B, Stoughton, MA 02072</p>
        </div>
      </div>`;

    // Send email
    if (vendor.email) {
      await sendEmailViaResend({
        to: vendor.email,
        subject: "Action Required: Complete Your Subcontractor Onboarding — Coen Construction",
        html: emailHtml,
      });
    }

    // Send SMS if phone available
    if (vendor.phone) {
      const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
        const digits = (vendor.phone || "").replace(/\D/g, "");
        const toPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
        const smsBody = `Coen Construction: Complete your subcontractor onboarding packet to access bids & payments: ${portalUrl}`;
        // SMS is a nice-to-have nudge — never fail the invite over it
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: TWILIO_FROM, To: toPhone, Body: smsBody }),
        }).catch(() => {});
      }
    }

    return Response.json({ success: true, portal_url: portalUrl });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});