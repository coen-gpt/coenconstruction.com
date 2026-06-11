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
// Base44 Core.SendEmail integration. Never throws — the packet/link already
// exists, so a delivery hiccup must not 500 the whole request.
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
    const { base44, user } = await verifyAdminSession(req, 'can_access_team', body);

    let record;
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (body.onboarding_id) {
      // Resend an existing packet — refresh the token + expiry
      const records = await base44.asServiceRole.entities.EmployeeOnboarding.filter({ id: body.onboarding_id });
      record = records[0];
      if (!record) return Response.json({ error: "Onboarding record not found" }, { status: 404 });
      await base44.asServiceRole.entities.EmployeeOnboarding.update(record.id, {
        onboarding_token: record.onboarding_token || randomToken(),
        token_expires: expires,
        last_sent_at: now.toISOString(),
      });
      record = (await base44.asServiceRole.entities.EmployeeOnboarding.filter({ id: record.id }))[0];
    } else {
      const { full_name, email, phone, worker_type, position, start_date } = body;
      if (!full_name || !email) return Response.json({ error: "Name and email are required" }, { status: 400 });
      record = await base44.asServiceRole.entities.EmployeeOnboarding.create({
        full_name: String(full_name).trim(),
        email: String(email).toLowerCase().trim(),
        phone: phone || "",
        position: position || "",
        start_date: start_date || "",
        worker_type: worker_type === "contractor" ? "contractor" : "w2",
        status: "sent",
        onboarding_token: randomToken(),
        token_expires: expires,
        invited_by: user.email,
        last_sent_at: now.toISOString(),
      });
    }

    const appBaseUrl = (Deno.env.get("BASE44_APP_URL") || req.headers.get("origin") || "https://coenconstruction.com").replace(/\/$/, "");
    const portalUrl = `${appBaseUrl}/employee-onboarding?token=${record.onboarding_token}`;

    const isContractor = record.worker_type === "contractor";
    const formsLine = isContractor
      ? "1. Your information\n2. IRS Form W-9 (taxpayer identification)\n3. Photo ID (live capture or upload)\n4. Review & sign"
      : "1. Your information\n2. Federal Form W-4 and Massachusetts Form M-4 (tax withholding)\n3. Photo ID (live capture or upload)\n4. Employee handbook review & acknowledgment\n5. Review & sign";

    const emailBody = `Hi ${record.full_name},

Welcome to Coen Construction! To get you set up${record.start_date ? ` before your start date (${record.start_date})` : ""}, please complete your ${isContractor ? "contractor" : "new-hire"} onboarding packet online. It only takes a few minutes and everything is fillable right on the page:

${formsLine}

Start here (link valid for 30 days):
${portalUrl}

Questions? Reply to this email or call (617) 857-COEN.

Coen Construction LLC
387 Page St, Suite 10B, Stoughton, MA 02072`;

    const emailSent = await sendEmailSafe(base44, {
      to: record.email,
      subject: `Welcome to Coen Construction — complete your ${isContractor ? "contractor" : "new-hire"} onboarding packet`,
      body: emailBody,
    });

    // Optional SMS nudge — best-effort
    let smsSent = false;
    if (record.phone) {
      try {
        const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
        if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
          const digits = (record.phone || "").replace(/\D/g, "");
          const toPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
          const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: TWILIO_FROM,
              To: toPhone,
              Body: `Coen Construction: complete your onboarding packet here: ${portalUrl}`,
            }),
          });
          smsSent = smsRes.ok;
        }
      } catch (e) {
        console.error("Onboarding SMS failed:", e.message);
      }
    }

    return Response.json({ success: true, onboarding_id: record.id, portal_url: portalUrl, email_sent: emailSent, sms_sent: smsSent });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
