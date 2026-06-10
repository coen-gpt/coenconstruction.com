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

async function sendEmailViaResend({ to, subject, html, replyTo = "ops@coenconstruction.com" }) {
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
    const { base44, user } = await verifyAdminSession(req, 'can_access_team', body);
    const { onboarding_id, action, notes } = body;
    if (!onboarding_id || !["approve", "request_changes"].includes(action)) {
      return Response.json({ error: "onboarding_id and a valid action are required" }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.EmployeeOnboarding.filter({ id: onboarding_id });
    const record = records[0];
    if (!record) return Response.json({ error: "Onboarding record not found" }, { status: 404 });

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.EmployeeOnboarding.update(onboarding_id, {
      status: action === "approve" ? "approved" : "changes_requested",
      reviewed_by: user.email,
      reviewed_at: now,
      review_notes: notes || "",
    });

    // Keep the linked Vendor in step for contractors
    if (action === "approve" && record.worker_type === "contractor" && record.vendor_id) {
      await base44.asServiceRole.entities.Vendor.update(record.vendor_id, {
        packet_status: "approved",
        packet_approved_by: user.email,
        packet_approved_at: now,
      }).catch(() => {});
    }

    const appBaseUrl = (Deno.env.get("BASE44_APP_URL") || "https://www.coenconstruction.com").replace(/\/$/, "");
    const portalUrl = `${appBaseUrl}/employee-onboarding?token=${record.onboarding_token}`;

    const innerHtml = action === "approve"
      ? `
          <p>Your onboarding packet has been reviewed and <strong style="color:#16a34a;">approved</strong> — you're all set!${record.start_date ? ` We look forward to seeing you on ${record.start_date}.` : ""}</p>
          ${notes ? `<p style="background:#fff;border:1px solid #eee;border-radius:6px;padding:12px;">Note from the office: ${notes}</p>` : ""}`
      : `
          <p>We reviewed your onboarding packet and need a couple of updates before we can approve it:</p>
          <p style="background:#fff;border:1px solid #eee;border-radius:6px;padding:12px;">${notes || "Please review your packet and re-submit."}</p>
          <div style="margin:24px 0;text-align:center;">
            <a href="${portalUrl}" style="background:#E35235;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
              Update My Packet →
            </a>
          </div>`;

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Coen Construction</h1>
          <p style="color:#aaa;margin:4px 0 0;font-size:13px;">Licensed & Insured General Contractor</p>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-top:none;">
          <p style="font-size:16px;color:#1B2B3A;">Hi ${record.full_name},</p>
          ${innerHtml}
          <p style="font-size:12px;color:#888;">Questions? Reply to this email or call (617) 857-COEN.</p>
        </div>
        <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
          <p style="color:#888;font-size:11px;margin:0;">Coen Construction LLC · 387 Page St, Suite 10B, Stoughton, MA 02072</p>
        </div>
      </div>`;

    let emailSent = true;
    try {
      await sendEmailViaResend({
        to: record.email,
        subject: action === "approve"
          ? "Your Coen Construction onboarding packet is approved"
          : "Action needed: updates to your Coen Construction onboarding packet",
        html: emailHtml,
      });
    } catch (e) {
      emailSent = false;
      console.error("Review notification email failed:", e.message);
    }

    return Response.json({ success: true, email_sent: emailSent });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
