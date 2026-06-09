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
  const body = await req.json().catch(() => ({}));
  const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
  const { file_url, pm_software } = body;

  if (!file_url) return Response.json({ error: 'No file_url provided' }, { status: 400 });

  const prompt = `You are a construction project management software integration expert.

Analyze this ${pm_software || 'PM software'} estimate import file and identify how its column headers/fields map to our standard estimate fields.

Our standard fields are:
- parent_group (trade/category group)
- subgroup (sub-category)
- title (line item name)
- description (detailed description)
- quantity (numeric amount)
- unit (unit of measure: ls, sq ft, lin ft, hr, day, each, etc.)
- unit_cost (cost per unit)
- markup_pct (markup percentage)
- total (line item total)
- cost_type (labor, material, subcontractor, allowance, other)
- internal_notes (internal notes)

Look at the file structure and create a mapping of:
{their_field_name} → {our_field_name}

Return ONLY a JSON object where keys are THEIR field names and values are OUR field names:
{
  "Category": "parent_group",
  "Item Name": "title",
  "Qty": "quantity",
  ...
}

Only include fields you can confidently map. If a field has no match, omit it.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: {
      type: "object",
      properties: {},
      additionalProperties: { type: "string" }
    }
  });

  return Response.json({ mapping: result });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});