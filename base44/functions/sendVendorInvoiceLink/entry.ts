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

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44, user } = await verifyAdminSession(req, 'can_access_invoices', body);

    const { invoice_id, channel = 'email', vendor_email, vendor_phone, payment_stage } = body;
    if (!invoice_id) return Response.json({ error: 'invoice_id required' }, { status: 400 });

    const records = await base44.asServiceRole.entities.InvoiceRecord.filter({ id: invoice_id });
    if (!records.length) return Response.json({ error: 'Invoice not found' }, { status: 404 });
    const invoice = records[0];

    // ── GLOBAL SMS KILL SWITCH (SMS channel only) ───────────────────────────
    if (channel === 'sms') {
      const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
      const smsEnabled = profiles[0]?.sms_enabled;
      if (smsEnabled === false) {
        console.log('[SMS DISABLED] Global kill switch is ON — skipping vendor SMS link');
        return Response.json({ success: false, skipped: true, reason: 'sms_globally_disabled' });
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    // Generate secure token (expires in 7 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Build the portal URL
    const appUrl = req.headers.get('origin') || 'https://app.base44.com';
    const portalUrl = `${appUrl}/vendor/invoice-update?token=${token}`;

    const effectiveEmail = vendor_email || invoice.vendor_email;
    const effectivePhone = vendor_phone || invoice.vendor_phone;
    const vendorName = invoice.vendor_name || 'Vendor';
    const stage = payment_stage || invoice.payment_stage || 'Invoice';

    // Save token + stage to invoice record
    const updateData = {
      vendor_token: token,
      vendor_token_expires_at: expiresAt,
      vendor_portal_sent_at: new Date().toISOString(),
      vendor_portal_channel: channel,
      payment_stage: payment_stage || invoice.payment_stage || undefined,
    };
    if (vendor_email && !invoice.vendor_email) updateData.vendor_email = vendor_email;
    if (vendor_phone) updateData.vendor_phone = vendor_phone;

    const history = [...(invoice.history || []), {
      action: `vendor_portal_link_sent_via_${channel}`,
      by: user.email,
      at: new Date().toISOString(),
      note: `Sent ${stage} request to ${effectiveEmail || effectivePhone}`
    }];
    updateData.history = history;

    await base44.asServiceRole.entities.InvoiceRecord.update(invoice_id, updateData);

    // Send via email (primary)
    if (channel === 'email' || !channel) {
      if (!effectiveEmail) return Response.json({ error: 'No vendor email on file' }, { status: 400 });

      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (!resendKey) return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
        from: 'Coen Construction <info@coenconstruction.com>',
        to: effectiveEmail,
        subject: `Action Required: Please Submit Your ${stage} Invoice`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1B2B3A; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Coen Construction</h1>
              <p style="color: #aaa; margin: 4px 0 0; font-size: 13px;">Invoice Management Portal</p>
            </div>
            <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="color: #374151; font-size: 15px;">Hi ${vendorName},</p>
              <p style="color: #374151; font-size: 15px;">We're ready to process your <strong>${stage}</strong> payment. Please click the button below to securely upload your updated invoice.</p>
              ${invoice.invoice_number ? `<p style="color: #6b7280; font-size: 13px;">Reference: Invoice #${invoice.invoice_number}</p>` : ''}
              <div style="text-align: center; margin: 30px 0;">
                <a href="${portalUrl}" style="background: #E35235; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
                  Upload ${stage} Invoice →
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">This link expires in 7 days. If you have questions, reply to this email.</p>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 20px 0;" />
              <p style="color: #9ca3af; font-size: 11px; text-align: center;">Coen Construction · 387 Page Street Ste 10B, Stoughton, MA 02072</p>
            </div>
          </div>
        `,
        }),
      });

      return Response.json({ success: true, channel: 'email', sent_to: effectiveEmail });
    }

    // SMS channel
    if (channel === 'sms') {
      if (!effectivePhone) return Response.json({ error: 'No vendor phone on file' }, { status: 400 });

      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuth = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (twilioSid && twilioAuth && twilioFrom) {
        const smsBody = `Coen Construction: Please submit your ${stage} invoice here: ${portalUrl} (link expires in 7 days)`;
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const formData = new URLSearchParams({ To: effectivePhone, From: twilioFrom, Body: smsBody });

        const smsRes = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${twilioSid}:${twilioAuth}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        });
        const smsData = await smsRes.json();
        if (!smsRes.ok) return Response.json({ error: `SMS failed: ${smsData.message}` }, { status: 400 });
        return Response.json({ success: true, channel: 'sms', sent_to: effectivePhone });
      } else {
        return Response.json({ success: true, channel: 'sms', portal_url: portalUrl, manual: true, message: 'Twilio not configured. Copy the portal_url and send manually.' });
      }
    }

    return Response.json({ error: 'Invalid channel' }, { status: 400 });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});