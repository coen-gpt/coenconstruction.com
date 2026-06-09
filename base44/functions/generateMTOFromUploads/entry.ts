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

const MTO_SCHEMA = {
  type: "object",
  properties: {
    project_summary: { type: "string" },
    trades: {
      type: "array",
      items: {
        type: "object",
        properties: {
          trade: { type: "string" },
          supplier_type: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
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
          }
        }
      }
    }
  }
};

const SYSTEM_PROMPT = `You are an expert construction estimator and material takeoff specialist with 20+ years experience in the Greater Boston area.

Your job is to analyze uploaded construction documents (drawings, scope of work, estimates, proposals, hand drawings) and generate a comprehensive, realistic Material Take-Off (MTO).

RULES:
1. Read ALL uploaded files/content carefully and extract every material needed to complete the project.
2. Break materials down by trade or supply house type. Use these standard trade categories:
   - Lumber & Framing
   - Concrete & Masonry
   - Electrical
   - Plumbing
   - HVAC
   - Roofing
   - Flooring
   - Insulation
   - Drywall & Finishes
   - Hardware & Fasteners
   - Paint & Coatings
   - Doors & Windows
   - Cabinetry & Millwork
   - Deck & Outdoor
   - General Supply
3. For each material item, provide:
   - material_name: specific material name (e.g. "2x6x16 KD Lumber", "1/2\" Type X Drywall")
   - description: detailed spec or notes
   - quantity: realistic quantity based on scope (be specific and accurate)
   - unit: EA, LF, SF, CY, LB, GAL, etc.
   - unit_cost: realistic current market cost in dollars (Greater Boston pricing)
   - total_cost: quantity * unit_cost
   - suggested_supplier: best local supplier type (e.g. "Home Depot", "Wentworth Lumber", "Graybar Electric", "Ferguson Plumbing")
   - sku: SKU or product code if well-known
   - notes: any important notes (lead time, special order, etc.)
4. Include waste factor (typically 10-15%) for cut materials (lumber, drywall, flooring, etc.)
5. Be thorough — include consumables, fasteners, adhesives, backing materials, etc.
6. Do NOT include labor — materials only.
7. Output valid JSON matching the schema exactly.`;

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);

    const { uploads = [], notes = "", projectName = "" } = body;

    if (uploads.length === 0 && !notes.trim()) {
      return Response.json({ error: 'No uploads or notes provided' }, { status: 400 });
    }

    // Separate image files (supported by vision models) from documents
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const imageUploads = uploads.filter(u => imageTypes.includes(u.type));
    const docUploads = uploads.filter(u => !imageTypes.includes(u.type));

    // Extract text from non-image documents
    const extractedTexts = [];
    for (const doc of docUploads) {
      try {
        const result = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
          file_url: doc.url,
          json_schema: {
            type: "object",
            properties: {
              content: { type: "string", description: "All text content from the document" },
              line_items: { type: "array", items: { type: "string" }, description: "Any line items, materials, or quantities listed" }
            }
          }
        });
        if (result.status === 'success' && result.output) {
          extractedTexts.push(`--- Document: ${doc.name} ---\n${JSON.stringify(result.output)}`);
        }
      } catch (_) {
        // Skip unreadable files
      }
    }

    const imageUrls = imageUploads.map(u => u.url);

    const userPrompt = `
Project Name: ${projectName || "Not specified"}

${notes ? `SCOPE / ADDITIONAL DETAILS:\n${notes}\n` : ""}
${extractedTexts.length > 0 ? `\nEXTRACTED DOCUMENT CONTENT:\n${extractedTexts.join('\n\n')}` : ""}
${imageUploads.length > 0 ? `\n${imageUploads.length} drawing/image file(s) attached — analyze them for dimensions, layout, and materials.` : ""}

Generate a realistic, thorough material list organized by trade. Include every material needed to complete this project from start to finish.`;

    const mto = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      file_urls: imageUrls.length > 0 ? imageUrls : undefined,
      response_json_schema: MTO_SCHEMA,
      model: 'gpt_5_mini',
    });

    return Response.json({ mto });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});