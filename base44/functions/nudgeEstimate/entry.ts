import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Send a friendly reminder ("nudge") for a quote that was emailed but not yet
 * actioned. Admin-only (can_access_estimates). Body: { estimate_id }.
 *
 * The reminder is a light email (no PDF re-attachment) with the same tracked
 * CTA + open pixel as the original send, so nudge engagement shows up on the
 * Customer Quotes page too. Increments nudge_count / last_nudged_at.
 */

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

function b64urlEncode(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

// Engagement tracking token (same HMAC scheme as campaignTrack, "estimate:" context).
async function signTrackingToken(estimateId, projectId) {
  const secret = Deno.env.get('MAGIC_LINK_SECRET') || Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret) return null;
  const payload = b64urlEncode(new TextEncoder().encode(`${estimateId}|${projectId}`));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`estimate:${payload}`));
  return `${payload}.${b64urlEncode(new Uint8Array(signature))}`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates', body);

    const { estimate_id } = body;
    if (!estimate_id) return Response.json({ error: 'estimate_id is required' }, { status: 400 });

    const estimates = await base44.asServiceRole.entities.Estimate.filter({ id: estimate_id });
    const estimate = estimates[0];
    if (!estimate) return Response.json({ error: 'Estimate not found' }, { status: 404 });
    if (estimate.status !== 'sent') {
      return Response.json({ error: 'Only quotes that are awaiting a response can be nudged' }, { status: 400 });
    }

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: estimate.project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (!project.client_email) return Response.json({ error: 'No client email on file' }, { status: 400 });

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const appUrl = 'https://coenconstruction.com';
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ project_id: estimate.project_id });
    const portalUrl = portals[0]?.portal_token ? `${appUrl}/customer-portal?token=${portals[0].portal_token}` : null;

    const trackToken = await signTrackingToken(estimate.id, estimate.project_id);
    const trackBase = trackToken ? `${appUrl}/api/functions/estimateTrack?t=${trackToken}` : null;
    const ctaUrl = trackBase ? `${trackBase}&a=c` : portalUrl;
    if (!ctaUrl) return Response.json({ error: 'No customer portal link exists for this project' }, { status: 400 });
    const pixelTag = trackBase
      ? `<img src="${trackBase}&a=o" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;"/>`
      : '';

    const isChangeOrder = estimate.type === 'change_order';
    const docTypeLabel = isChangeOrder ? `Change Order #${estimate.change_order_number || ''}` : 'estimate';
    const firstName = String(project.client_name || '').split(' ')[0] || 'there';

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Coen Construction</h1>
          <p style="color:#aaa;margin:4px 0 0;font-size:13px;">Licensed & Insured General Contractor</p>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-top:none;">
          <p style="font-size:16px;color:#1B2B3A;">Hi ${firstName},</p>
          <p>Just a quick follow-up — your ${docTypeLabel} for <strong>$${(estimate.grand_total || 0).toLocaleString()}</strong> is ready and waiting for your review.</p>
          <div style="margin:24px 0;text-align:center;">
            <a href="${ctaUrl}" style="background:#E35235;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
              Review Your ${isChangeOrder ? 'Change Order' : 'Estimate'} →
            </a>
          </div>
          <p style="font-size:13px;color:#555;">Have questions or want to walk through any of the details? Just reply to this email — we're happy to help.</p>
          ${estimate.valid_until ? `<p style="font-size:12px;color:#888;">This ${docTypeLabel} is valid until ${estimate.valid_until}.</p>` : ''}
        </div>
        <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
          <p style="color:#888;font-size:11px;margin:0;">© ${new Date().getFullYear()} Coen Construction · coenconstruction.com</p>
        </div>
      </div>
      ${pixelTag}
    `;

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Coen Construction <info@coenconstruction.com>',
        reply_to: 'ops@coenconstruction.com',
        to: project.client_email,
        subject: `Quick follow-up on your ${isChangeOrder ? 'change order' : 'estimate'} from Coen Construction`,
        html: emailHtml,
      }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.json().catch(() => ({}));
      throw new Error(`Resend error: ${sendRes.status} — ${err.message || 'Unknown'}`);
    }

    await base44.asServiceRole.entities.Estimate.update(estimate.id, {
      nudge_count: (estimate.nudge_count || 0) + 1,
      last_nudged_at: new Date().toISOString(),
    });

    return Response.json({ success: true, sent_to: project.client_email });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
