import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Returns one design project. Two auth paths:
//  - Logged-in Base44 user: may load their own projects (email/created_by
//    match); app admins may load any.
//  - Magic-link token (same HMAC scheme as getProjectsByEmail): may load
//    projects whose email matches the token's email. Without this, customers
//    arriving from a magic link could list projects but never open one.

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifyMagicToken(token, secret) {
  try {
    const [payload, signature] = String(token).split('.');
    if (!payload || !signature) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(`magiclink:${payload}`));
    if (!ok) return null;
    const [email, expiry] = new TextDecoder().decode(b64urlDecode(payload)).split('|');
    if (!email || !expiry || Date.now() > Number(expiry)) return null;
    return email;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { id, token } = await req.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

    let tokenEmail = null;
    if (token) {
      const secret = Deno.env.get('MAGIC_LINK_SECRET') || Deno.env.get('ADMIN_SESSION_SECRET');
      if (secret) tokenEmail = await verifyMagicToken(token, secret);
    }

    let user = null;
    if (!tokenEmail) {
      user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await base44.asServiceRole.entities.Project.get(id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Service role bypasses RLS, so enforce ownership here.
    const viewerEmail = (tokenEmail || user?.email || '').toLowerCase();
    const isOwner = [project.email, project.created_by]
      .filter(Boolean)
      .some(e => String(e).toLowerCase() === viewerEmail);
    if (!isOwner && user?.role !== 'admin') {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
