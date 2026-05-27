import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});