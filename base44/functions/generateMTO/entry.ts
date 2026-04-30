import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json().catch(() => ({}));
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
});