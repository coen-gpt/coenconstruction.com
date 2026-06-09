import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, parsedBody) {
  const base44 = createClientFromRequest(req);
  const body = parsedBody || await req.clone().json().catch(() => ({}));
  const auth = req.headers.get('authorization') || '';
  const token = String(body.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
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

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_seo');
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { audit_id, revert_to_version } = await req.json();
    if (!audit_id) return Response.json({ error: 'audit_id required' }, { status: 400 });

    const audit = await base44.asServiceRole.entities.SeoAudit.get(audit_id);
    if (!audit) return Response.json({ error: 'Audit not found' }, { status: 404 });

    const history = audit.revert_history || [];
    if (history.length === 0) {
      return Response.json({ error: 'No revert history available for this audit.' }, { status: 400 });
    }

    // Find the target version entry — default to most recent (last item)
    let targetEntry;
    if (revert_to_version !== undefined) {
      targetEntry = history.find(h => h.version === revert_to_version);
    } else {
      targetEntry = history[history.length - 1];
    }

    if (!targetEntry) {
      return Response.json({ error: 'Revert version not found in history.' }, { status: 404 });
    }

    const key = `seo_meta_${audit.page}`;
    const revertValue = JSON.stringify({
      title: targetEntry.title,
      description: targetEntry.description,
      keywords: targetEntry.keywords || [],
    });

    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { key, value: revertValue });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key, value: revertValue });
    }

    // Remove entries from history up to and including the one we reverted to
    const revertIndex = history.indexOf(targetEntry);
    const trimmedHistory = history.slice(0, revertIndex);

    await base44.asServiceRole.entities.SeoAudit.update(audit_id, {
      status: 'analyzed',
      applied_version: targetEntry.version,
      revert_history: trimmedHistory,
    });

    return Response.json({
      success: true,
      message: `"${audit.page}" successfully reverted to version ${targetEntry.version} (applied ${new Date(targetEntry.applied_at).toLocaleDateString()}).`,
      reverted_to: targetEntry,
    });
  } catch (error) {
    console.error('Revert SEO error:', error);
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});