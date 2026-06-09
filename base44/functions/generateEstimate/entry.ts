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
  const { project_id, scope, project_type, rooms, default_markup } = body;

  // Fetch company profile for AI instructions
  const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
  const profile = profiles[0];
  const systemInstructions = profile?.ai_system_instructions || "You are an expert construction estimator for a Boston-area general contractor.";
  const markup = default_markup || profile?.default_markup_pct || 20;

  const roomsSummary = (rooms || []).map(r => `${r.name || r.type} (${r.dimensions || 'unknown dimensions'}): ${r.notes || ''}`).join('\n');

  const prompt = `${systemInstructions}

Generate a detailed construction estimate for the following project:

Project Type: ${project_type || 'General Construction'}
Scope of Work: ${scope || 'No scope provided'}
Rooms/Areas:
${roomsSummary || 'No rooms specified'}

Default Markup: ${markup}%

Create a comprehensive line-item estimate. Group items by trade/category (parent_group). Include labor and material items separately. Use realistic Boston/MA cost rates.

Return ONLY a JSON object with this exact structure:
{
  "line_items": [
    {
      "parent_group": "Demo & Site Prep",
      "subgroup": "",
      "title": "Demolition",
      "description": "Remove existing structure",
      "quantity": 1,
      "unit": "ls",
      "unit_cost": 2500,
      "markup_pct": ${markup},
      "cost_type": "labor",
      "is_allowance": false,
      "internal_notes": ""
    }
  ]
}

Include 15-30 line items covering all major trades relevant to the project type. Be specific and realistic.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              parent_group: { type: "string" },
              subgroup: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string" },
              unit_cost: { type: "number" },
              markup_pct: { type: "number" },
              cost_type: { type: "string" },
              is_allowance: { type: "boolean" },
              internal_notes: { type: "string" }
            }
          }
        }
      }
    }
  });

  // Add IDs and calculate totals
  const line_items = (result.line_items || []).map(item => ({
    ...item,
    id: crypto.randomUUID(),
    total: (item.quantity || 1) * (item.unit_cost || 0) * (1 + (item.markup_pct || markup) / 100)
  }));

  return Response.json({ line_items });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});