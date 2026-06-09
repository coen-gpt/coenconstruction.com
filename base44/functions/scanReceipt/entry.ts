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
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates');

    const { image_url } = await req.json();
    if (!image_url) return Response.json({ error: 'image_url required' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a construction materials receipt parser. Extract all data from this receipt image.

Return a JSON object with these exact fields:
- vendor_name: string (store name, e.g. "Home Depot", "Lowe's")
- receipt_date: string (ISO date YYYY-MM-DD, or null if unclear)
- receipt_number: string or null
- po_reference: string or null (any PO number, job address, or reference number on the receipt)
- line_items: array of objects, each with:
    - description: string (item name/description)
    - sku: string or null
    - quantity: number
    - unit_price: number
    - total: number
- subtotal: number
- tax: number
- grand_total: number

Be precise with numbers. For quantities, default to 1 if not listed. Extract SKUs/item numbers if visible.`,
      file_urls: [image_url],
      response_json_schema: {
        type: "object",
        properties: {
          vendor_name: { type: "string" },
          receipt_date: { type: "string" },
          receipt_number: { type: "string" },
          po_reference: { type: "string" },
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
    });

    // Add IDs to line items
    const lineItems = (result.line_items || []).map((item) => ({
      id: crypto.randomUUID(),
      match_confidence: "none",
      matched_estimate_item_id: null,
      ...item,
    }));

    return Response.json({
      ...result,
      line_items: lineItems,
      submitted_by_email: user.email,
      submitted_by_name: user.full_name,
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});