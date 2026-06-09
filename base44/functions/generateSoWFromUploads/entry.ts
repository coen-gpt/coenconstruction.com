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
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);

    const { uploads = [], notes = "", projectName = "" } = body;
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
      model: 'claude_sonnet_4_6',
    });

    return Response.json({ sow });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});