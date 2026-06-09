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
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, 'can_access_seo', body);
    const { audit_id } = body;
    if (!audit_id) return Response.json({ error: 'audit_id required' }, { status: 400 });

    const audit = await base44.asServiceRole.entities.SeoAudit.get(audit_id);
    if (!audit) return Response.json({ error: 'Audit not found' }, { status: 404 });

    const key = `seo_meta_${audit.page}`;

    // Save current live state to revert_history before overwriting
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key });
    let previousState = null;
    if (existing.length > 0) {
      try { previousState = JSON.parse(existing[0].value); } catch (_) {}
    }

    const revertEntry = {
      applied_at: new Date().toISOString(),
      applied_by: user.email,
      title: previousState?.title || audit.current_title || '',
      description: previousState?.description || audit.current_description || '',
      keywords: previousState?.keywords || [],
      version: audit.applied_version || 0,
    };

    const newValue = JSON.stringify({
      title: audit.suggested_title,
      description: audit.suggested_description,
      keywords: audit.keywords,
    });

    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { key, value: newValue });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key, value: newValue });
    }

    const updatedHistory = [...(audit.revert_history || []), revertEntry];
    const newVersion = (audit.applied_version || 0) + 1;

    await base44.asServiceRole.entities.SeoAudit.update(audit_id, {
      status: 'applied',
      applied_version: newVersion,
      revert_history: updatedHistory,
    });

    return Response.json({
      success: true,
      message: `SEO suggestions for "${audit.page}" applied successfully. Version ${newVersion} is now live.`,
      version: newVersion,
    });
  } catch (error) {
    console.error('Apply SEO error:', error);
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});