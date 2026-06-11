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

async function sendInvite(user) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return false;
  const link = `${SITE_URL}/admin/set-password?token=${user.reset_token}`;
  const isFieldCrew = user.role === "field_crew";
  const roleLabel = String(user.role || "").replace(/_/g, " ");
  // Field crew never use the office dashboard — point them at the crew app
  const subject = isFieldCrew
    ? "You've been invited to the Coen Construction crew app"
    : "You've been invited to Coen Construction Admin";
  const intro = isFieldCrew
    ? `You've been added to the Coen Construction <strong>crew app</strong> — your time clock, tasks, materials, equipment, and receipts, all in one place.`
    : `You've been added to the Coen Construction admin dashboard as a <strong>${roleLabel}</strong>.`;
  const whereToSignIn = isFieldCrew
    ? `<p>Once your password is set, sign in any time at <a href="${SITE_URL}/field"><strong>${SITE_URL.replace(/^https?:\/\//, "")}/field</strong></a> — save it to your phone's home screen for quick access.</p>`
    : `<p>Once your password is set, sign in at <a href="${SITE_URL}/admin"><strong>${SITE_URL.replace(/^https?:\/\//, "")}/admin</strong></a>.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Coen Construction <noreply@coenconstruction.com>",
      to: user.email,
      subject,
      html: `<p>Hi ${user.name},</p><p>${intro}</p><p><a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #E35235; color: white; text-decoration: none; border-radius: 4px;">Set Your Password</a></p>${whereToSignIn}<p style="color: #999; font-size: 12px;">This link expires in 72 hours.</p>`,
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
      const emailSent = await sendInvite(fresh);
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
