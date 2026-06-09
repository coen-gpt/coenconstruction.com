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
  const { project_id, scope, project_type, rooms, estimate_line_items } = body;

  const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
  const profile = profiles[0];
  const systemInstructions = profile?.ai_system_instructions || "You are an expert construction estimator.";

  const estimateSummary = (estimate_line_items || [])
    .filter(i => i.cost_type === 'material' || i.cost_type === 'allowance')
    .map(i => `${i.title}: ${i.quantity} ${i.unit} @ $${i.unit_cost}`)
    .join('\n');

  const prompt = `${systemInstructions}

Generate a detailed material take-off (MTO) for this construction project:

Project Type: ${project_type || 'General Construction'}
Scope: ${scope || 'No scope provided'}
Rooms: ${(rooms || []).map(r => `${r.name || r.type} (${r.dimensions || '?'})`).join(', ')}

Estimate material line items:
${estimateSummary || 'No estimate items available — generate based on scope'}

Create a comprehensive material take-off list organized by trade. For each item include:
- Specific material name and SKU/spec where relevant
- Realistic quantity with correct units
- Accurate unit cost (Boston/MA pricing, 2024-2025)
- Suggested supplier (Home Depot, Lowe's, ABC Supply, Beacon Supply, etc.)

Return ONLY a JSON object:
{
  "items": [
    {
      "trade": "Framing",
      "line_item_ref": "Structural Framing",
      "material_name": "2x6 SPF Stud 96\"",
      "description": "Structural wall framing",
      "quantity": 120,
      "unit": "each",
      "unit_cost": 8.50,
      "total_cost": 1020,
      "suggested_supplier": "ABC Supply",
      "sku": "2X6-96-SPF",
      "notes": ""
    }
  ],
  "total": 0
}

Include 20-40 specific material items. Calculate total accurately.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              trade: { type: "string" },
              line_item_ref: { type: "string" },
              material_name: { type: "string" },
              description: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string" },
              unit_cost: { type: "number" },
              total_cost: { type: "number" },
              suggested_supplier: { type: "string" },
              sku: { type: "string" },
              notes: { type: "string" }
            }
          }
        },
        total: { type: "number" }
      }
    }
  });

  const items = (result.items || []).map(item => ({
    ...item,
    id: crypto.randomUUID(),
    total_cost: item.total_cost || (item.quantity || 0) * (item.unit_cost || 0)
  }));

  const total = items.reduce((s, i) => s + (i.total_cost || 0), 0);

  return Response.json({ items, total });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});