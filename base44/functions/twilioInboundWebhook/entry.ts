import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OPT_OUT_WORDS = new Set(['STOP', 'QUIT', 'UNSUBSCRIBE']);
const OPT_IN_WORDS = new Set(['START', 'UNSTOP']);

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s().-]/g, '').trim();
}

async function hmacSha1Base64(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function isValidTwilioRequest(req, params) {
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const signature = req.headers.get('x-twilio-signature');
  if (!authToken || !signature) return false;

  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const signedPayload = req.url + sorted.map(([key, value]) => `${key}${value}`).join('');
  const expected = await hmacSha1Base64(signedPayload, authToken);
  return expected === signature;
}

async function upsertConsent(base44, phoneNumber, updates) {
  const records = await base44.asServiceRole.entities.SmsConsent.filter({ phone_number: phoneNumber });
  const existing = records?.[0];
  if (existing) {
    await base44.asServiceRole.entities.SmsConsent.update(existing.id, updates);
    return existing.id;
  }
  const created = await base44.asServiceRole.entities.SmsConsent.create({ phone_number: phoneNumber, ...updates });
  return created.id;
}

function twiml() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' }
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);

    if (!(await isValidTwilioRequest(req, params))) {
      return new Response('Invalid Twilio signature', { status: 403 });
    }

    const phoneNumber = normalizePhone(params.get('From'));
    const incomingBody = String(params.get('Body') || '').trim();
    const command = incomingBody.toUpperCase();
    const now = new Date().toISOString();

    await base44.asServiceRole.entities.SmsMessageLog.create({
      phone_number: phoneNumber,
      direction: 'inbound',
      trigger_type: 'inbound_reply',
      body: incomingBody,
      twilio_sid: params.get('MessageSid') || '',
      status: 'received',
      received_at: now
    });

    if (OPT_OUT_WORDS.has(command)) {
      await upsertConsent(base44, phoneNumber, {
        sms_opt_in_status: false,
        sms_opt_out_timestamp: now,
        last_inbound_message: incomingBody,
        last_inbound_at: now
      });
    }

    if (OPT_IN_WORDS.has(command)) {
      await upsertConsent(base44, phoneNumber, {
        sms_opt_in_status: true,
        sms_opt_in_timestamp: now,
        sms_opt_in_method: 'MANUAL',
        sms_consent_text_version: 'TWILIO_KEYWORD_START',
        last_inbound_message: incomingBody,
        last_inbound_at: now
      });
    }

    return twiml();
  } catch (error) {
    console.error('twilioInboundWebhook failed', error.message);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});