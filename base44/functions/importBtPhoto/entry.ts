// importBtPhoto — temporary one-off endpoint used to migrate jobsite photos out of
// BuilderTrend (whose file URLs are session-locked) into Base44 storage.
// The browser, logged into BuilderTrend, fetches each photo same-origin and POSTs
// it here as base64 along with a normal admin session token; we upload to Base44
// storage and append the resulting URL to the target DailyLog and/or
// ContractorProject photos arrays.
// Remove this function once the migration is complete.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// CORS is open to buildertrend.net because the import loop runs inside a
// logged-in BuilderTrend tab; auth still requires a valid admin session token.
const CORS = {
  'Access-Control-Allow-Origin': 'https://buildertrend.net',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, parsedBody) {
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
  if (user.role !== 'admin') throw new Error('Forbidden');
  return { base44, user };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json();
    let base44;
    try {
      ({ base44 } = await verifyAdminSession(req, body));
    } catch (e) {
      return json({ error: String(e?.message || e) }, 401);
    }

    const { filename, mime, data, daily_log_id, project_id } = body;
    if (!data || (!daily_log_id && !project_id)) return json({ error: 'Missing fields' }, 400);
    if (data.length > 9_000_000) return json({ error: 'File too large' }, 413);

    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const file = new File([bytes], filename || 'photo.jpg', { type: mime || 'image/jpeg' });
    const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const url = uploaded?.file_url;
    if (!url) return json({ error: 'Upload failed' }, 500);

    if (daily_log_id) {
      const log = await base44.asServiceRole.entities.DailyLog.get(daily_log_id);
      const photos = Array.isArray(log?.photos) ? log.photos : [];
      if (!photos.includes(url)) {
        await base44.asServiceRole.entities.DailyLog.update(daily_log_id, { photos: [...photos, url] });
      }
    }
    if (project_id) {
      const project = await base44.asServiceRole.entities.ContractorProject.get(project_id);
      const photos = Array.isArray(project?.photos) ? project.photos : [];
      if (!photos.includes(url)) {
        await base44.asServiceRole.entities.ContractorProject.update(project_id, { photos: [...photos, url] });
      }
    }

    return json({ ok: true, url });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
