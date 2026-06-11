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

// Best-effort email: Resend first (proven delivery path in this app), then the
// Base44 Core.SendEmail integration. Never throws — the invite link is already
// created, so a delivery hiccup must not 500 the whole request.
async function sendEmailSafe(base44, { to, subject, body }) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <noreply@coenconstruction.com>",
          to,
          subject,
          text: body,
        }),
      });
      if (res.ok) return true;
      console.error("Resend send failed:", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("Resend send error:", e.message);
    }
  }
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body });
    return true;
  } catch (e) {
    console.error("Core.SendEmail failed:", e.message);
    return false;
  }
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

    const appBaseUrl = (Deno.env.get("BASE44_APP_URL") || req.headers.get("origin") || "https://coenconstruction.com").replace(/\/$/, "");
    const portalUrl = `${appBaseUrl}/sub-onboarding?token=${token}&vendor=${vendor_id}`;

    const emailBody = `Hi ${vendor.contact_name || vendor.company_name},

Coen Construction LLC has invited you to complete your subcontractor onboarding packet. This must be completed before you can access bids or receive payments.

Click the link below to get started (link valid for 30 days):
${portalUrl}

You will need to complete:
1. Company Information
2. Insurance Certificates (Workers Comp + General Liability)
3. W-9 Form
4. Review & Sign the Subcontractor Agreement

Questions? Contact us at subs@coenconstruction.com or (617) 857-COEN.

Coen Construction LLC
387 Page St, Suite 10B, Stoughton, MA 02072`;

    // Send email — best-effort; the link already exists so never 500 here
    let emailSent = false;
    if (vendor.email) {
      emailSent = await sendEmailSafe(base44, {
        to: vendor.email,
        subject: "Action Required: Complete Your Subcontractor Onboarding — Coen Construction",
        body: emailBody,
      });
    }

    // Send SMS if phone available — also best-effort
    let smsSent = false;
    if (vendor.phone) {
      try {
        const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
        if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
          const digits = (vendor.phone || "").replace(/\D/g, "");
          const toPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
          const smsBody = `Coen Construction: Complete your subcontractor onboarding packet to access bids & payments: ${portalUrl}`;
          const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ From: TWILIO_FROM, To: toPhone, Body: smsBody }),
          });
          smsSent = smsRes.ok;
        }
      } catch (e) {
        console.error("Invite SMS failed:", e.message);
      }
    }

    return Response.json({ success: true, portal_url: portalUrl, email_sent: emailSent, sms_sent: smsSent });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});