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

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates', body);

    const { sub_bid_id } = body;
    if (!sub_bid_id) return Response.json({ error: 'sub_bid_id required' }, { status: 400 });

    const subBids = await base44.asServiceRole.entities.SubBid.filter({ id: sub_bid_id });
    const subBid = subBids[0];
    if (!subBid) return Response.json({ error: 'SubBid not found' }, { status: 404 });

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: subBid.project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    await base44.asServiceRole.entities.SubBid.update(sub_bid_id, {
      invite_token: token,
      invite_sent_at: new Date().toISOString(),
      status: 'invited',
    });

    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    const companyName = company.company_name || 'Coen Construction';
    const brandColor = company.brand_color || '#E35235';
    const companyEmail = company.email || 'info@coenconstruction.com';
    const companyPhone = company.phone || '';
    const logoHtml = company?.logo_url
      ? `<img src="${company.logo_url}" alt="${companyName}" height="44" style="display:inline-block;height:44px;max-width:220px;width:auto;background:#ffffff;padding:8px 14px;border-radius:8px;" />`
      : `<span style="color:#ffffff;font-size:22px;font-weight:700;">${companyName}</span>`;

    const portalUrl = `https://coenconstruction.com/sub-bid-portal?token=${token}`;
    const projectAddress = [project.client_address, project.client_city].filter(Boolean).join(', ');

    const sowItems = subBid.sow_trade_items || [];
    const sowSection = sowItems.length > 0 ? `
      <div style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">📋 Scope of Work — ${subBid.trade}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid #e0e0e0;">
              <th style="text-align:left;padding:6px 8px;color:#666;font-weight:600;">Item</th>
              <th style="text-align:left;padding:6px 8px;color:#666;font-weight:600;">Description</th>
              <th style="text-align:center;padding:6px 8px;color:#666;font-weight:600;">Qty / Unit</th>
            </tr>
          </thead>
          <tbody>
            ${sowItems.map((it, i) => `
              <tr style="border-bottom:1px solid #f0f0f0;background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
                <td style="padding:7px 8px;color:#333;font-weight:600;vertical-align:top;">${it.item || ''}</td>
                <td style="padding:7px 8px;color:#555;vertical-align:top;">${it.description || it.notes || ''}</td>
                <td style="padding:7px 8px;color:#555;text-align:center;vertical-align:top;">${it.quantity ? `${it.quantity} ${it.unit || ''}`.trim() : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : project.scope_of_work ? `
      <div style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">📋 Scope of Work</p>
        <p style="margin:0;font-size:13px;color:#555;white-space:pre-wrap;line-height:1.6;">${project.scope_of_work}</p>
      </div>` : '';

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

    const recipientName = subBid.vendor_name || subBid.vendor_company || 'there';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:${brandColor};padding:28px 40px;">
          <table width="100%"><tr>
            <td>${logoHtml}
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Subcontractor Bid Request</p></td>
            <td align="right"><div style="background:rgba(255,255,255,0.15);border-radius:6px;padding:8px 14px;display:inline-block;">
              <span style="color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${subBid.trade}</span>
            </div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.6;">Hi <strong>${recipientName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">You've been invited to submit a bid for the <strong>${subBid.trade}</strong> scope on the project below.</p>
          <div style="background:#1B2B3A;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#fff;">${project.client_name || 'Project'}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);">${project.project_type || ''}${projectAddress ? ' · ' + projectAddress : ''}</p>
          </div>
          ${sowSection}
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr><td style="background:${brandColor};border-radius:8px;">
              <a href="${portalUrl}" style="display:inline-block;padding:16px 40px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
                📋 View Full Scope &amp; Submit Bid →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 6px;font-size:14px;color:#333;">Questions? Contact us:</p>
          <p style="margin:0;font-size:14px;color:#333;">
            ${companyPhone ? `📞 <a href="tel:${companyPhone}" style="color:${brandColor};text-decoration:none;font-weight:600;">${companyPhone}</a>  &nbsp;` : ''}
            ✉️ <a href="mailto:${companyEmail}" style="color:${brandColor};text-decoration:none;font-weight:600;">${companyEmail}</a>
          </p>
        </td></tr>
        <tr><td style="background:#1B2B3A;padding:18px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.8;">
            ${companyName} · Licensed &amp; Insured · Greater Boston, MA<br/>
            This link is unique to you — do not forward or share it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${companyName} <info@coenconstruction.com>`,
        reply_to: 'bids@coenconstruction.com',
        to: subBid.vendor_email,
        subject: `Bid Request — ${project.client_name || 'Project'} · ${subBid.trade} · ${companyName}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      throw new Error(`Resend error: ${emailRes.status} — ${err.message || 'Unknown'}`);
    }

    const emailResult = await emailRes.json();
    return Response.json({ success: true, portal_url: portalUrl, resend_id: emailResult.id });
  } catch (error) {
    console.error('sendSubBidInvite error:', error);
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});