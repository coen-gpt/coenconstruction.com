import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOOTER_OPT_OUT = 'Reply STOP to opt out.';

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s().-]/g, '').trim();
}

function renderTemplate(triggerType, variables) {
  if (triggerType === 'estimate_scheduled_reminder') {
    return `Coen Construction: Friendly reminder ${variables.clientName}, your site visit is scheduled for ${variables.dateTime} with ${variables.repName}. Call ${variables.repPhone} to reschedule. ${FOOTER_OPT_OUT}`;
  }

  if (triggerType === 'project_update') {
    return `Coen Construction: Hi ${variables.clientName}, the ${variables.stageName} stage of your project is complete! See photos in your portal: ${variables.portalUrl}. Reply STOP to unsubscribe.`;
  }

  if (triggerType === 'estimate_invoice_ready') {
    return `Coen Construction: Hello ${variables.clientName}, your estimate for the ${variables.projectType} is ready. View it here: ${variables.portalUrl}. ${FOOTER_OPT_OUT}`;
  }

  throw new Error('Unsupported SMS trigger type');
}

async function findConsent(base44, phoneNumber) {
  const normalized = normalizePhone(phoneNumber);
  const records = await base44.asServiceRole.entities.SmsConsent.filter({ phone_number: normalized });
  return records?.[0] || null;
}

async function logMessage(base44, data) {
  await base44.asServiceRole.entities.SmsMessageLog.create({
    ...data,
    sent_at: data.sent_at || new Date().toISOString()
  });
}

async function sendTwilioMessage(to, body) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured');
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ From: fromNumber, To: to, Body: body })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || 'Twilio delivery failed');
  }

  return payload;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const phoneNumber = normalizePhone(body.phone_number || body.to);
    const triggerType = body.trigger_type || body.triggerType;
    const variables = body.variables || {};

    if (!phoneNumber || !triggerType) {
      return Response.json({ error: 'phone_number and trigger_type are required' }, { status: 400 });
    }

    const messageBody = renderTemplate(triggerType, variables);
    const consent = await findConsent(base44, phoneNumber);

    if (!consent?.sms_opt_in_status) {
      await logMessage(base44, {
        phone_number: phoneNumber,
        direction: 'outbound',
        trigger_type: triggerType,
        body: messageBody,
        status: 'blocked_opt_out',
        error_message: 'SMS blocked because the customer has not opted in'
      });
      return Response.json({ success: false, blocked: true, reason: 'sms_opt_in_required' }, { status: 403 });
    }

    const twilioMessage = await sendTwilioMessage(phoneNumber, messageBody);
    await logMessage(base44, {
      phone_number: phoneNumber,
      direction: 'outbound',
      trigger_type: triggerType,
      body: messageBody,
      twilio_sid: twilioMessage.sid,
      status: twilioMessage.status || 'queued'
    });

    return Response.json({ success: true, messageSid: twilioMessage.sid, status: twilioMessage.status });
  } catch (error) {
    console.error('sendCompliantSms failed', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});