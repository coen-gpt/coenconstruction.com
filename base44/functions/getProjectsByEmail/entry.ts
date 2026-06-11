import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Returns the design projects for the email embedded in a magic-link token
// minted by sendMagicLink. Token-only: the old bare-email mode let anyone
// enumerate any customer's projects (name, phone, address, designs) just by
// typing their email address.

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

// Counterpart of signMagicToken in sendMagicLink: b64url(email|expiry) + "." +
// b64url(HMAC-SHA256("magiclink:" + payload)). Returns the email, or null if
// the token is malformed, tampered with, or expired.
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
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }

    const secret = Deno.env.get('MAGIC_LINK_SECRET') || Deno.env.get('ADMIN_SESSION_SECRET');
    if (!secret) {
      return Response.json({ error: 'Magic links are not configured' }, { status: 503 });
    }

    const email = await verifyMagicToken(token, secret);
    if (!email) {
      return Response.json({ error: 'This link is invalid or has expired. Please request a new one from the homepage.' }, { status: 401 });
    }

    // Fetch all projects as service role and filter by email in code
    // (avoids RLS/user-lookup issues with field-level filtering)
    const allProjects = await base44.asServiceRole.entities.Project.list('-created_date', 200);
    const projects = allProjects.filter(p => p.email?.toLowerCase().trim() === email);

    return Response.json({ projects, email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
