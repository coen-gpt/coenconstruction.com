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

// --- Project matching helpers — duplicated in scanGmailInvoices/entry.ts, keep in sync ---

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const STREET_SUFFIXES = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'ln', 'lane', 'dr', 'drive',
  'ct', 'court', 'cir', 'circle', 'blvd', 'boulevard', 'way', 'pl', 'place',
  'ter', 'terrace', 'trl', 'trail', 'hwy', 'highway', 'n', 's', 'e', 'w',
  'north', 'south', 'east', 'west'
]);

const ACTIVE_PROJECT_STATUSES = new Set([
  'walkthrough', 'draft', 'sent', 'pending_review', 'approved', 'modify',
  'in_progress', 'on_hold', 'completed', 'imported'
]);

function buildProjectMatchers(projects) {
  return projects
    .filter(p => !p.status || ACTIVE_PROJECT_STATUSES.has(p.status))
    .map(p => {
      const addr = normalizeText(p.client_address);
      const m = addr.match(/^(\d+)\s+(.+)$/);
      let streetNum = null, streetWords = [];
      if (m) {
        streetNum = m[1];
        streetWords = m[2].split(' ').filter(w => w.length >= 3 && !STREET_SUFFIXES.has(w));
      }
      const nameWords = normalizeText(p.client_name).split(' ').filter(w => w.length >= 4);
      const lastName = nameWords.length > 0 ? nameWords[nameWords.length - 1] : null;
      return { project: p, streetNum, streetWords, lastName };
    })
    .filter(x => (x.streetNum && x.streetWords.length > 0) || x.lastName);
}

function matchProject(matchers, { poText, broadText }) {
  const po = ' ' + normalizeText(poText) + ' ';
  const broad = ' ' + normalizeText(broadText) + ' ' + po;
  for (const m of matchers) {
    if (m.streetNum && m.streetWords.length > 0 &&
        broad.includes(` ${m.streetNum} `) &&
        m.streetWords.some(w => broad.includes(` ${w} `))) {
      return {
        project: m.project,
        reason: `Address "${m.streetNum} ${m.streetWords[0]}…" matched ${m.project.client_name}'s project`
      };
    }
  }
  for (const m of matchers) {
    if (m.lastName && po.includes(` ${m.lastName} `)) {
      return {
        project: m.project,
        reason: `PO/job name contains "${m.lastName}" → ${m.project.client_name}'s project`
      };
    }
  }
  return null;
}

async function applyMatch(base44, record, match, extracted) {
  const patch = {
    ...(extracted?.po_name && !record.po_name ? { po_name: extracted.po_name } : {}),
    ...(extracted?.delivery_address && !record.delivery_address ? { delivery_address: extracted.delivery_address } : {}),
  };
  if (match) {
    patch.project_id = match.project.id;
    patch.project_match_status = 'suggested';
    patch.project_match_reason = match.reason;
    patch.history = [...(record.history || []), {
      action: 'project_auto_matched',
      by: 'system',
      at: new Date().toISOString(),
      note: match.reason
    }];
  } else {
    patch.project_match_status = 'none';
  }
  await base44.asServiceRole.entities.InvoiceRecord.update(record.id, patch);
  return !!match;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices', body);
    const { batchSize = 6 } = body;

    const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 200);
    const matchers = buildProjectMatchers(projects);
    if (matchers.length === 0) {
      return Response.json({ checked: 0, matched: 0, remaining: 0, note: 'No matchable projects (need client_address or client_name).' });
    }

    const all = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', 500);
    // Candidates: never matched/reviewed and not already assigned to a project
    const candidates = all.filter(r => !r.project_id && !r.project_match_status);

    const startedAt = Date.now();
    const MAX_RUNTIME_MS = 45000;
    let checked = 0;
    let matched = 0;
    let aiUsed = 0;
    const safeBatch = Math.max(1, Math.min(Number(batchSize) || 6, 10));

    for (const record of candidates) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) break;

      // Pass 1: cheap text match on what we already have
      const cheapMatch = matchProject(matchers, {
        poText: `${record.po_name || ''} ${record.delivery_address || ''}`,
        broadText: `${record.email_subject || ''} ${record.email_snippet || ''}`
      });
      if (cheapMatch) {
        await applyMatch(base44, record, cheapMatch, null);
        checked++; matched++;
        continue;
      }

      // Pass 2: read the attachment with AI to pull PO / job name / delivery address
      const fileUrls = (record.attachment_urls || []).slice(0, 2);
      if (fileUrls.length === 0 || aiUsed >= safeBatch) {
        // Nothing more to extract from (or AI budget spent) — only finalize
        // attachment-less records; leave the rest for the next run.
        if (fileUrls.length === 0) {
          await applyMatch(base44, record, null, null);
          checked++;
        }
        continue;
      }

      let extracted = null;
      try {
        extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Read this receipt/invoice document. Extract the PO reference and any job-site address. Return JSON only.

Return:
{
  "po_name": string or null (the PO, "PO Name", "PO/Job Name", job name, or job reference printed on the document — Home Depot Pro receipts show this near the top; copy it exactly),
  "delivery_address": string or null (job-site or delivery address if one is shown — NOT the store or vendor address)
}`,
          response_json_schema: {
            type: "object",
            properties: {
              po_name: { type: "string" },
              delivery_address: { type: "string" }
            }
          },
          file_urls: fileUrls
        });
        aiUsed++;
      } catch (_) {
        // LLM failure — leave the record unmarked so a future run retries
        continue;
      }

      const aiMatch = matchProject(matchers, {
        poText: `${extracted?.po_name || ''} ${extracted?.delivery_address || ''}`,
        broadText: `${record.email_subject || ''} ${record.email_snippet || ''}`
      });
      const ok = await applyMatch(base44, record, aiMatch, extracted);
      checked++;
      if (ok) matched++;
    }

    const remaining = candidates.length - checked;
    return Response.json({ checked, matched, aiUsed, remaining: Math.max(0, remaining), projects: matchers.length });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
