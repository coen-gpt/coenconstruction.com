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

// Mirrors the noise rules in scanGmailInvoices so backfilled labels match
// what new scans produce.
const NOISE_RULES = [
  {
    label: 'Material Receipt',
    match: ({ fromEmail, subject }) =>
      /@(?:[\w.-]+\.)?homedepot\.com$/i.test(fromEmail) || /home depot receipt/i.test(subject),
  },
  {
    label: 'Material Receipt',
    match: ({ fromEmail }) => /@(?:[\w.-]+\.)?(lowes|menards)\.com$/i.test(fromEmail),
  },
  {
    label: 'Phone Notification',
    match: ({ fromEmail, subject }) =>
      /voice-noreply@google\.com$/i.test(fromEmail) ||
      /@txt\.voice\.google\.com$/i.test(fromEmail) ||
      /new (text message|voicemail) from/i.test(subject),
  },
];

function classifyNoise(fromEmail, subject) {
  for (const rule of NOISE_RULES) {
    if (rule.match({ fromEmail: fromEmail || '', subject: subject || '' })) {
      return { priority: 'low', ai_label: rule.label };
    }
  }
  return null;
}

const VALID_PRIORITIES = new Set(['high', 'normal', 'low']);

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices', body);
    const { batchSize = 60 } = body;

    const all = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', 500);
    const unlabeled = all.filter(r => !r.priority || !r.ai_label).slice(0, Math.min(Number(batchSize) || 60, 120));

    if (unlabeled.length === 0) {
      return Response.json({ labeled: 0, remaining: 0, total: all.length });
    }

    // Pass 1: deterministic rules (free, instant)
    const needsAi = [];
    const updates = new Map();
    for (const r of unlabeled) {
      const noise = classifyNoise(r.vendor_email, r.email_subject);
      if (noise) {
        updates.set(r.id, noise);
      } else {
        needsAi.push(r);
      }
    }

    // Pass 2: one LLM call classifies the rest in bulk from metadata
    if (needsAi.length > 0) {
      try {
        const lines = needsAi.map((r, i) =>
          `${i}. From: ${r.vendor_name || ''} <${r.vendor_email || ''}> | Subject: ${r.email_subject || ''} | Type: ${r.document_type || ''} | Amount: ${r.amount ?? 'n/a'}`
        ).join('\n');
        const aiData = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are triaging a construction company's invoice inbox. For each email below, rate its importance and give it a short label. Return JSON only.

priority: "low" = automated store receipts (Home Depot etc.), phone/text/voicemail notifications, marketing, system emails; "high" = invoice that is overdue or demands payment now; "normal" = regular vendor invoice, quote, proposal, or bill.
label: short 2-3 word label like "Vendor Invoice", "Material Receipt", "Subcontractor Bill", "Vendor Quote", "Phone Notification".

Emails:
${lines}

Return: {"items": [{"index": number, "priority": "high"|"normal"|"low", "label": string}]}`,
          response_json_schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    priority: { type: "string" },
                    label: { type: "string" }
                  }
                }
              }
            }
          }
        });
        for (const item of aiData?.items || []) {
          const rec = needsAi[item.index];
          if (!rec) continue;
          updates.set(rec.id, {
            priority: VALID_PRIORITIES.has(item.priority) ? item.priority : 'normal',
            ai_label: item.label || null,
          });
        }
      } catch (_) {
        // LLM unavailable — label what the rules caught, leave the rest for next run
      }
    }

    let labeled = 0;
    const entries = [...updates.entries()];
    const CHUNK = 10;
    for (let i = 0; i < entries.length; i += CHUNK) {
      await Promise.all(entries.slice(i, i + CHUNK).map(([id, patch]) =>
        base44.asServiceRole.entities.InvoiceRecord.update(id, patch).then(() => { labeled++; }).catch(() => {})
      ));
    }

    const remaining = all.filter(r => !r.priority || !r.ai_label).length - labeled;
    return Response.json({ labeled, remaining: Math.max(0, remaining), total: all.length });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
