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
    const { base44, user } = await verifyAdminSession(req, 'can_access_blog');

    const body = await req.json().catch(() => ({}));
    const { enabled, days, time } = body;

    // Convert time from ET to UTC (EST = UTC-5)
    const [hStr, mStr] = (time || "09:00").split(":");
    const hourET = parseInt(hStr);
    const hourUTC = (hourET + 5) % 24;
    const minute = parseInt(mStr || "0");

    // Build cron expression
    const dayStr = (days && days.length > 0) ? days.join(",") : "1";
    const cronExpression = `${minute} ${hourUTC} * * ${dayStr}`;

    // Save settings to AppSettings for UI to load back
    const settingsRecords = await base44.asServiceRole.entities.AppSettings.filter({ key: "blog_schedule_settings" });
    const settingsValue = JSON.stringify({ enabled, days: days || [], time: time || "09:00", cronExpression });

    if (settingsRecords[0]?.id) {
      await base44.asServiceRole.entities.AppSettings.update(settingsRecords[0].id, { value: settingsValue });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: "blog_schedule_settings", value: settingsValue });
    }

    return Response.json({ success: true, cronExpression, enabled });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});