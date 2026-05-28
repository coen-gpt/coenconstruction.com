import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  const { base44, user } = await verifyAdminSession(req, 'can_access_estimates');

  const body = await req.json().catch(() => ({}));
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
});
