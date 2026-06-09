import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SITE_URL = "https://www.coenconstruction.com";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

// ── Inline JWT helpers (no shared imports - Base44 functions are self-contained) ──

function getSessionSecrets() {
  return [Deno.env.get("ADMIN_SESSION_SECRET")].filter(Boolean);
}

async function getKey(secret, usage) {
  const raw = new TextEncoder().encode(secret);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

async function signAdminSession(user) {
  const secret = Deno.env.get("ADMIN_SESSION_SECRET");
  if (!secret) throw new Error("Admin session secret is not configured");
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const body = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const data = new TextEncoder().encode(`${header}.${body}`);
  const key = await getKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${body}.${sigB64}`;
}

async function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const data = new TextEncoder().encode(`${header}.${body}`);
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    let valid = false;
    for (const secret of getSessionSecrets()) {
      const key = await getKey(secret, "verify");
      if (await crypto.subtle.verify("HMAC", key, sigBytes, data)) {
        valid = true;
        break;
      }
    }
    if (!valid) return null;
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function verifyAdminSession(req, requiredPermission, body) {
  const token = body?.admin_session_token ||
    req.headers.get("x-admin-session-token") ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) throw new Error("Unauthorized: no session token");

  const payload = await verifyToken(token);
  if (!payload) throw new Error("Unauthorized: invalid or expired token");

  // Re-fetch the user from DB to get fresh permissions
  const base44 = createClientFromRequest(req);
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: payload.email });
  const user = users[0];

  if (!user || user.active === false) throw new Error("Forbidden: account inactive");
  if (requiredPermission && user.role !== "admin" && !user[requiredPermission]) {
    throw new Error(`Forbidden: missing permission ${requiredPermission}`);
  }

  return { user };
}

function safeAdminUser(user, sessionToken) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.name,
    name: user.name,
    role: user.role,
    can_access_estimates: user.can_access_estimates,
    can_access_leads: user.can_access_leads,
    can_access_invoices: user.can_access_invoices,
    can_access_blog: user.can_access_blog,
    can_access_cms: user.can_access_cms,
    can_access_seo: user.can_access_seo,
    can_access_team: user.can_access_team,
    can_access_tracking: user.can_access_tracking,
    session_token: sessionToken,
  };
}

function generateToken() {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { action } = body;

  // ── LOGIN ──────────────────────────────────────────────────────────
  if (action === "login") {
    const { email, password } = body;
    if (!email || !password) {
      return Response.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const users = await base44.asServiceRole.entities.AdminUser.filter({ email: normalizedEmail });
    const user = users[0];

    if (!user || user.active === false) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.password_hash) {
      return Response.json({ error: "Account not set up yet. Check your email for a setup link." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const sessionToken = await signAdminSession(user);
    return Response.json(safeAdminUser(user, sessionToken));
  }

  // ── SEND INVITE (set-password email for new user) ─────────────────
  if (action === "invite") {
    try {
      await verifyAdminSession(req, 'can_access_team', body);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 403 });
    }
    const { userId } = body;
    const users = await base44.asServiceRole.entities.AdminUser.filter({ id: userId });
    const user = users[0];
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const token = generateToken();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.AdminUser.update(userId, {
      reset_token: token,
      reset_token_expires: expires,
    });

    const link = `${SITE_URL}/admin/set-password?token=${token}`;

    let emailSent = false;
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Coen Construction <noreply@coenconstruction.com>",
            to: user.email,
            subject: "You've been invited to Coen Construction Admin",
            html: `<p>Hi ${user.name},</p><p>You've been added to the Coen Construction admin dashboard as a <strong>${user.role}</strong>.</p><p><a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #E35235; color: white; text-decoration: none; border-radius: 4px;">Set Your Password</a></p><p style="color: #999; font-size: 12px;">This link expires in 72 hours.</p>`
          })
        });
        if (res.ok) emailSent = true;
      }
    } catch {}

    return Response.json({ ok: true, emailSent });
  }

  // ── FORGOT PASSWORD ────────────────────────────────────────────────
  if (action === "forgot") {
    const { email } = body;
    const users = await base44.asServiceRole.entities.AdminUser.filter({ email: email.toLowerCase().trim() });
    const user = users[0];

    if (!user || user.active === false) return Response.json({ ok: true });

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.AdminUser.update(user.id, {
      reset_token: token,
      reset_token_expires: expires,
    });

    const link = `${SITE_URL}/admin/set-password?token=${token}`;

    let emailSent = false;
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Coen Construction <noreply@coenconstruction.com>",
            to: user.email,
            subject: "Reset your Coen Construction Admin password",
            html: `<p>Hi ${user.name},</p><p>We received a request to reset your password.</p><p><a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #E35235; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a></p><p style="color: #999; font-size: 12px;">This link expires in 1 hour.</p>`
          })
        });
        if (res.ok) emailSent = true;
      }
    } catch {}

    return Response.json({ ok: true, emailSent });
  }

  // ── SET PASSWORD (from token) ─────────────────────────────────────
  if (action === "setPassword") {
    const { token, password } = body;
    if (!token || !password || password.length < 8) {
      return Response.json({ error: "Invalid request. Password must be at least 8 characters." }, { status: 400 });
    }

    const allUsers = await base44.asServiceRole.entities.AdminUser.list();
    const user = allUsers.find(u => u.reset_token === token);

    if (!user) return Response.json({ error: "Invalid or expired link." }, { status: 400 });
    if (new Date(user.reset_token_expires) < new Date()) {
      return Response.json({ error: "This link has expired. Please request a new one." }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    await base44.asServiceRole.entities.AdminUser.update(user.id, {
      password_hash: hash,
      reset_token: null,
      reset_token_expires: null,
    });

    return Response.json({ ok: true });
  }

  // ── VERIFY SESSION ───────────────────────────────────────────────
  if (action === "verifySession") {
    try {
      const verified = await verifyAdminSession(req, undefined, body);
      return Response.json(safeAdminUser(verified.user, body.admin_session_token));
    } catch (e) {
      return Response.json({ error: e.message }, { status: 401 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});