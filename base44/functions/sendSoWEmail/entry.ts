import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function verifyAdminSession(req, permission, body) {
  const token = body?.admin_session_token ||
    req.headers.get('x-admin-session-token') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized: no session token');
  const base44 = createClientFromRequest(req);
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Unauthorized: invalid token');
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Unauthorized: token expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: payload.email });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden: account inactive');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden: missing permission');
  return { base44, user };
}

function isValidEmailList(to) {
  return String(to || '')
    .split(/[;,]/)
    .map(v => v.trim())
    .filter(Boolean)
    .every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    const { to, subject, body: html, from_email } = body;
    if (!to || !isValidEmailList(to)) return Response.json({ error: 'A valid recipient email is required' }, { status: 400 });
    if (!subject) return Response.json({ error: 'subject is required' }, { status: 400 });
    if (!html) return Response.json({ error: 'body is required' }, { status: 400 });

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

    const toList = String(to).split(/[;,]/).map(v => v.trim()).filter(Boolean);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Coen Construction <info@coenconstruction.com>',
        reply_to: from_email || 'bids@coenconstruction.com',
        to: toList,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Resend error: ${res.status} — ${err.message || 'Unknown'}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});