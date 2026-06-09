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

// Home Depot Pro (Perks) does not have a public OAuth API — we use
// AI-assisted CSV/export parsing as the integration bridge.
// This function accepts a CSV text payload (pasted or uploaded from HD Pro export)
// and parses orders into PurchaseReceipt records, auto-matching to projects by address.

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates');

    const { csv_text, file_url } = await req.json();

    let inputData = csv_text;

    // If file_url provided, fetch the content
    if (!inputData && file_url) {
      const resp = await fetch(file_url);
      inputData = await resp.text();
    }

    if (!inputData) return Response.json({ error: 'csv_text or file_url required' }, { status: 400 });

    // Fetch all projects for matching
    const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 200);

    const projectSummary = projects.map(p => ({
      id: p.id,
      name: p.client_name,
      address: `${p.client_address || ''} ${p.client_city || ''}`.trim(),
    })).filter(p => p.address);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are parsing a Home Depot Pro account order history export (CSV or structured text).

Parse ALL orders/transactions from this data into structured receipts.

Also, for each receipt, try to match it to one of these projects based on PO field, job name, address, or any reference:
${JSON.stringify(projectSummary, null, 2)}

Return a JSON object with:
- receipts: array of objects, each with:
  - receipt_number: string (order number)
  - receipt_date: string (ISO date)
  - po_reference: string or null (PO / job reference on the order)
  - suggested_project_id: string or null (id from the projects list above if confident match)
  - match_reason: string or null (why you matched this project)
  - line_items: array of { description, sku, quantity, unit_price, total }
  - subtotal: number
  - tax: number
  - grand_total: number

Input data:
${inputData.substring(0, 8000)}`,
      response_json_schema: {
        type: "object",
        properties: {
          receipts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                receipt_number: { type: "string" },
                receipt_date: { type: "string" },
                po_reference: { type: "string" },
                suggested_project_id: { type: "string" },
                match_reason: { type: "string" },
                line_items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      sku: { type: "string" },
                      quantity: { type: "number" },
                      unit_price: { type: "number" },
                      total: { type: "number" }
                    }
                  }
                },
                subtotal: { type: "number" },
                tax: { type: "number" },
                grand_total: { type: "number" }
              }
            }
          }
        }
      }
    });

    const receipts = (result.receipts || []).map(r => ({
      ...r,
      line_items: (r.line_items || []).map(i => ({ id: crypto.randomUUID(), match_confidence: 'none', ...i })),
      vendor_name: 'Home Depot',
      source: 'home_depot_pro',
      status: 'pending_review',
      submitted_by_email: user.email,
      submitted_by_name: user.full_name,
    }));

    return Response.json({ receipts, total: receipts.length });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});