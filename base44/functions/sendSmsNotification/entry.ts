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

function normalizePhoneForTwilio(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return raw.replace(/[\s().-]/g, '');
}

function consentPhoneVariants(phone) {
  const e164 = normalizePhoneForTwilio(phone);
  const digits = e164.replace(/\D/g, '');
  return [...new Set([
    e164,
    digits,
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : null,
  ].filter(Boolean))];
}

Deno.serve(async (req) => {
  try {
    const requestBody = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', requestBody);
    const { to, body } = requestBody;

    if (!to || !body) {
      return Response.json({ error: 'to and body are required' }, { status: 400 });
    }

    // ── GLOBAL SMS KILL SWITCH ──────────────────────────────────────────────
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const smsEnabled = profiles[0]?.sms_enabled;
    if (smsEnabled === false) {
      console.log('[SMS DISABLED] Global kill switch is ON — skipping SMS to', to);
      return Response.json({ success: true, skipped: true, reason: 'sms_globally_disabled' });
    }
    // ───────────────────────────────────────────────────────────────────────

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    // Validate and normalize for Twilio while matching existing consent records.
    const normalizedPhone = normalizePhoneForTwilio(to);
    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return Response.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    let consentRecord = null;
    for (const variant of consentPhoneVariants(to)) {
      const records = await base44.asServiceRole.entities.SmsConsent.filter({ phone_number: variant });
      if (records?.[0]) {
        consentRecord = records[0];
        break;
      }
    }
    if (!consentRecord?.sms_opt_in_status) {
      await base44.asServiceRole.entities.SmsMessageLog.create({
        phone_number: normalizedPhone,
        direction: 'outbound',
        trigger_type: 'manual',
        body,
        status: 'blocked_opt_out',
        error_message: 'SMS blocked because the customer has not opted in',
        sent_at: new Date().toISOString()
      });
      return Response.json({ error: 'SMS opt-in required', blocked: true }, { status: 403 });
    }

    const compliantBody = `${body.startsWith('Coen Construction:') ? body : `Coen Construction: ${body}`}${/reply stop/i.test(body) ? '' : ' Reply STOP to opt out.'}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append('From', fromNumber);
    formData.append('To', normalizedPhone);
    formData.append('Body', compliantBody);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      await base44.asServiceRole.entities.SmsMessageLog.create({
        phone_number: normalizedPhone,
        direction: 'outbound',
        trigger_type: 'manual',
        body: compliantBody,
        status: 'failed',
        error_message: errorData.message,
        sent_at: new Date().toISOString()
      });
      return Response.json({ 
        error: 'Failed to send SMS', 
        details: errorData.message 
      }, { status: res.status });
    }

    const data = await res.json();
    await base44.asServiceRole.entities.SmsMessageLog.create({
      phone_number: normalizedPhone,
      direction: 'outbound',
      trigger_type: 'manual',
      body: compliantBody,
      twilio_sid: data.sid,
      status: data.status || 'queued',
      sent_at: new Date().toISOString()
    });
    return Response.json({ 
      success: true, 
      messageSid: data.sid,
      status: data.status
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});