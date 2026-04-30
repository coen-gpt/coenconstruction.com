import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SOW_SCHEMA = {
  type: "object",
  properties: {
    project_summary: { type: "string" },
    trades: {
      type: "array",
      items: {
        type: "object",
        properties: {
          trade: { type: "string" },
          scope_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task: { type: "string" },
                description: { type: "string" },
                specification: { type: "string" },
                exclusions: { type: "string" },
                notes: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
};

const SYSTEM_PROMPT = `You are an expert construction project manager generating detailed Scopes of Work (SOW) for residential construction projects in Greater Boston.

Analyze project documents and generate a comprehensive, professional Scope of Work broken down by trade.

RULES:
1. Read ALL documents carefully and extract every scope item needed.
2. Organize by standard construction trades: General Conditions, Demolition & Removal, Site Work & Excavation, Concrete & Foundation, Framing & Rough Carpentry, Roofing, Exterior Siding & Envelope, Windows & Doors, Plumbing, HVAC & Mechanical, Electrical, Insulation, Drywall & Plaster, Tile & Flooring, Interior Trim & Finish Carpentry, Painting & Coatings, Cabinetry & Millwork, Decking & Outdoor, Cleaning & Closeout
3. For each scope item provide:
   - task: clear actionable task name
   - description: full details of work to be performed
   - specification: material specs, standards, tolerances, codes
   - exclusions: what is NOT included in this trade scope
   - notes: allowances, owner selections, lead times, assumptions
4. Be thorough — contractors must be able to price from this document.
5. Do NOT include pricing or quantities.
6. Output valid JSON matching the schema exactly.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { uploads = [], notes = "", projectName = "" } = await req.json();
    if (uploads.length === 0 && !notes.trim()) {
      return Response.json({ error: 'No uploads or notes provided' }, { status: 400 });
    }

    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const imageUploads = uploads.filter(u => imageTypes.includes(u.type));
    const docUploads = uploads.filter(u => !imageTypes.includes(u.type));

    const extractedTexts = [];
    for (const doc of docUploads) {
      try {
        const result = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
          file_url: doc.url,
          json_schema: { type: "object", properties: { content: { type: "string" }, line_items: { type: "array", items: { type: "string" } } } }
        });
        if (result.status === 'success' && result.output) {
          extractedTexts.push(`--- Document: ${doc.name} ---\n${JSON.stringify(result.output)}`);
        }
      } catch (_) {}
    }

    const imageUrls = imageUploads.map(u => u.url);
    const userPrompt = `Project Name: ${projectName || "Not specified"}
${notes ? `\nSCOPE / NOTES:\n${notes}\n` : ""}
${extractedTexts.length > 0 ? `\nDOCUMENT CONTENT:\n${extractedTexts.join('\n\n')}` : ""}
${imageUploads.length > 0 ? `\n${imageUploads.length} drawing/image file(s) attached.` : ""}
Generate a comprehensive Scope of Work organized by trade. Be thorough — every task needed from start to finish.`;

    const sow = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      file_urls: imageUrls.length > 0 ? imageUrls : undefined,
      response_json_schema: SOW_SCHEMA,
      model: 'gpt_5_mini',
    });

    return Response.json({ sow });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});