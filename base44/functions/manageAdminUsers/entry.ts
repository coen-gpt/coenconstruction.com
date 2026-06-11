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

const SITE_URL = (Deno.env.get("BASE44_APP_URL") || "https://coenconstruction.com").replace(/\/$/, "");

// Fields the Team Access UI may read/write. password_hash and reset_token
// never leave the server.
const SAFE_FIELDS = [
  "name", "email", "role", "active",
  "can_access_leads", "can_access_invoices", "can_access_estimates",
  "can_access_blog", "can_access_cms", "can_access_seo", "can_access_team",
  "can_access_tracking", "can_access_field_crew", "can_approve_payroll",
];

function safeUser(u) {
  const out = { id: u.id, created_date: u.created_date, has_password: !!u.password_hash };
  for (const f of SAFE_FIELDS) out[f] = u[f];
  return out;
}

function pickSafe(data) {
  const out = {};
  for (const f of SAFE_FIELDS) {
    if (data?.[f] !== undefined) out[f] = f === "email" ? String(data[f]).toLowerCase().trim() : data[f];
  }
  return out;
}

function generateToken() {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Same branded shell as sendBrandedEmail — navy header/footer, brand accent
function brandedInviteHtml(company, user, link) {
  const accentColor = company?.brand_color || "#E35235";
  const navyColor = "#1B2B3A";
  const companyName = company?.company_name || "Coen Construction";
  const companyPhone = company?.phone || "";
  const isFieldCrew = user.role === "field_crew";
  const roleLabel = String(user.role || "").replace(/_/g, " ");
  const signInUrl = isFieldCrew ? `${SITE_URL}/field` : `${SITE_URL}/admin`;
  const signInLabel = signInUrl.replace(/^https?:\/\//, "");
  const intro = isFieldCrew
    ? `You've been added to the <strong>${companyName} crew app</strong> — your time clock, tasks, materials, equipment, and receipts, all in one place.`
    : `You've been added to the <strong>${companyName}</strong> admin dashboard as a <strong style="text-transform:capitalize;">${roleLabel}</strong>.`;
  const afterSetup = isFieldCrew
    ? `Once your password is set, sign in any time at <a href="${signInUrl}" style="color:${accentColor};font-weight:700;text-decoration:none;">${signInLabel}</a> — save it to your phone's home screen for quick access on the jobsite.`
    : `Once your password is set, sign in at <a href="${signInUrl}" style="color:${accentColor};font-weight:700;text-decoration:none;">${signInLabel}</a>.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${navyColor};padding:24px 32px;border-radius:10px 10px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:white;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${companyName}</span>
                  <br><span style="color:rgba(255,255,255,0.45);font-size:12px;font-weight:500;">Licensed General Contractor · Est. 1998</span>
                </td>
                <td align="right">
                  <div style="width:10px;height:10px;border-radius:50%;background:${accentColor};display:inline-block;"></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px 36px;border:1px solid #e8e8e8;border-top:none;">
            <p style="font-size:16px;color:#1B2B3A;margin:0 0 20px 0;">Hi ${user.name},</p>
            <p style="font-size:15px;color:#1B2B3A;margin:0 0 20px 0;line-height:1.6;">${intro}</p>
            <div style="margin:24px 0;text-align:center;">
              <a href="${link}" style="display:inline-block;background:${accentColor};color:white;padding:13px 30px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">
                Set Your Password →
              </a>
            </div>
            <p style="font-size:14px;color:#1B2B3A;margin:0 0 8px 0;line-height:1.6;">${afterSetup}</p>
            <p style="color:#999;font-size:12px;margin:16px 0 0 0;">This link expires in 72 hours.</p>
          </td>
        </tr>
        <tr>
          <td style="background:${navyColor};padding:18px 32px;border-radius:0 0 10px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:rgba(255,255,255,0.5);font-size:12px;">${companyName}</span>
                  ${companyPhone ? `<span style="color:rgba(255,255,255,0.3);font-size:12px;"> · ${companyPhone}</span>` : ""}
                </td>
                <td align="right">
                  <a href="https://coenconstruction.com" style="color:rgba(255,255,255,0.4);font-size:11px;text-decoration:none;">coenconstruction.com</a>
                </td>
              </tr>
              <tr><td colspan="2" style="padding-top:8px;">
                <span style="color:rgba(255,255,255,0.25);font-size:10px;">© ${new Date().getFullYear()} ${companyName}. This message was sent from our project management system.</span>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendInvite(user, company) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return false;
  const link = `${SITE_URL}/admin/set-password?token=${user.reset_token}`;
  const companyName = company?.company_name || "Coen Construction";
  const subject = user.role === "field_crew"
    ? `You've been invited to the ${companyName} crew app`
    : `You've been invited to ${companyName} Admin`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${companyName} <noreply@coenconstruction.com>`,
      to: user.email,
      subject,
      html: brandedInviteHtml(company, user, link),
    }),
  }).catch(() => null);
  return !!res?.ok;
}

// Team Access & Roles management. The AdminUser entity is RLS-locked (it
// stores password hashes and reset tokens), so all reads/writes go through
// here with a strict field whitelist.
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44, user: actor } = await verifyAdminSession(req, 'can_access_team', body);
    const { action } = body;

    if (action === "list") {
      const users = await base44.asServiceRole.entities.AdminUser.list('-created_date', 100);
      return Response.json({ users: users.map(safeUser) });
    }

    if (action === "create") {
      const data = pickSafe(body.data);
      if (!data.name || !data.email) return Response.json({ error: "Name and email are required" }, { status: 400 });
      const existing = await base44.asServiceRole.entities.AdminUser.filter({ email: data.email });
      if (existing[0]) return Response.json({ error: "A team member with that email already exists" }, { status: 409 });
      const created = await base44.asServiceRole.entities.AdminUser.create({
        ...data,
        active: data.active !== false,
        reset_token: generateToken(),
        reset_token_expires: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      });
      const fresh = (await base44.asServiceRole.entities.AdminUser.filter({ id: created.id }))[0];
      const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
      const emailSent = await sendInvite(fresh, profiles[0] || {});
      return Response.json({ user: safeUser(fresh), emailSent });
    }

    if (action === "update") {
      const { id } = body;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const data = pickSafe(body.data);
      if (actor.id === id && (data.active === false || (data.role && data.role !== "admin" && actor.role === "admin"))) {
        return Response.json({ error: "You can't deactivate or demote your own account." }, { status: 400 });
      }
      await base44.asServiceRole.entities.AdminUser.update(id, data);
      const fresh = (await base44.asServiceRole.entities.AdminUser.filter({ id }))[0];
      return Response.json({ user: safeUser(fresh) });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      if (actor.id === id) return Response.json({ error: "You can't delete your own account." }, { status: 400 });
      await base44.asServiceRole.entities.AdminUser.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
