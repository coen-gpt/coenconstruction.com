import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { signAdminSession, verifyAdminSession, safeAdminUser } from '../_shared/adminSession.ts';

const SITE_URL = "https://www.coenconstruction.com";

function generateToken() {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    let user = users[0];

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
    await verifyAdminSession(req, 'can_access_team', body);
    const { userId } = body;
    const users = await base44.asServiceRole.entities.AdminUser.filter({ id: userId });
    const user = users[0];
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const token = generateToken();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72h

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
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Coen Construction <noreply@coenconstruction.com>",
            to: user.email,
            subject: "You've been invited to Coen Construction Admin",
            html: `<p>Hi ${user.name},</p><p>You've been added to the Coen Construction admin dashboard as a <strong>${user.role}</strong>.</p><p><a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #E35235; color: white; text-decoration: none; border-radius: 4px;">Set Your Password</a></p><p style="color: #999; font-size: 12px;">This link expires in 72 hours. If you have any questions, contact your administrator.</p>`
          })
        });
        if (res.ok) emailSent = true;
      }
    } catch (e) {
      // Email could not be delivered
    }

    return Response.json({ ok: true, emailSent, link: (!emailSent && Deno.env.get('ENVIRONMENT') === 'development') ? link : undefined });
  }

  // ── FORGOT PASSWORD ────────────────────────────────────────────────
  if (action === "forgot") {
    const { email } = body;
    const users = await base44.asServiceRole.entities.AdminUser.filter({ email: email.toLowerCase().trim() });
    const user = users[0];

    // Always return ok to avoid leaking which emails exist
    if (!user || user.active === false) return Response.json({ ok: true });

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    await base44.asServiceRole.entities.AdminUser.update(user.id, {
      reset_token: token,
      reset_token_expires: expires,
    });

    const link = `${SITE_URL}/admin/set-password?token=${token}`;

    // Try to send email via Resend
    let emailSent = false;
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Coen Construction <noreply@coenconstruction.com>",
            to: user.email,
            subject: "Reset your Coen Construction Admin password",
            html: `<p>Hi ${user.name},</p><p>We received a request to reset your password.</p><p><a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #E35235; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a></p><p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`
          })
        });
        if (res.ok) emailSent = true;
      }
    } catch (e) {
      // Email could not be delivered
    }

    return Response.json({ ok: true, emailSent, link: (!emailSent && Deno.env.get('ENVIRONMENT') === 'development') ? link : undefined });
  }

  // ── SET PASSWORD (from token) ─────────────────────────────────────
  if (action === "setPassword") {
    const { token, password } = body;
    if (!token || !password || password.length < 8) {
      return Response.json({ error: "Invalid request. Password must be at least 8 characters." }, { status: 400 });
    }

    // Find user by token — list all and filter (entity filter on non-indexed fields)
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
    const verified = await verifyAdminSession(req, undefined, body);
    return Response.json(verified.user);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});