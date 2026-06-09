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

const FORMATTING_RULES = `
FORMATTING RULES — STRICTLY FOLLOW:
- Never use markdown syntax: no **, *, #, ##, ###, ---, _underscore_, backticks, or bullet hyphens (-)
- Use clean section headers in ALL CAPS followed by a colon when organizing a response (e.g. SUMMARY: or ACTION ITEMS:)
- Use numbered lists (1. 2. 3.) or plain bullets with a dot (.) for lists
- Separate sections with a blank line
- Numbers and dollar amounts should always be clearly labeled
- Be direct, professional, and data-driven
- Lead with the most important insight first
- Keep responses concise unless detail is explicitly requested
- If showing data tables, use spacing/alignment with plain text
`;

const TOOLS_DESCRIPTION = `
TOOL CALLING:
You have access to live data tools. When you need fresh or specific data, output ONLY a JSON object on its own line in this exact format:
{"tool": "<tool_name>", "args": {<args>}}

Available tools:

{"tool": "get_leads", "args": {"limit": 50, "status": "New"}}
  - status: "New" | "Contacted" | "Won" | "Lost" | null (all)
  - limit: number (default 50)

{"tool": "get_projects", "args": {"limit": 50, "status": "walkthrough"}}
  - status: "walkthrough" | "draft" | "sent" | "approved" | "in_progress" | "completed" | "cancelled" | null (all)
  - limit: number (default 50)

{"tool": "get_invoices", "args": {"limit": 100, "status": "pending_review"}}
  - status: "pending_review" | "approved" | "paid" | "outstanding" | "on_hold" | "rejected" | null (all)
  - limit: number (default 100)

{"tool": "get_estimates", "args": {"limit": 50, "status": "draft"}}
  - status: "draft" | "sent" | "approved" | "rejected" | "superseded" | null (all)

{"tool": "get_blog_posts", "args": {"limit": 20, "published": true}}
  - published: true | false | null (all)

{"tool": "gmail_search", "args": {"query": "subject:invoice from:vendor@example.com", "max_results": 5}}
  - query: Gmail search string (e.g. "from:someone@example.com", "subject:urgent", "has:attachment")
  - max_results: number of emails (default 5, max 10)
  - Only available if user has connected Staff AI Gmail

{"tool": "calendar_events", "args": {"days_ahead": 7}}
  - days_ahead: show upcoming events for next N days (default 7)
  - Only available if user has connected Staff AI Calendar

IMPORTANT: Output the JSON tool call ONLY — nothing else on that line. After receiving tool results, use them to answer the user. Do not call the same tool twice in one turn.
`;

const ROLE_SYSTEM_PROMPTS = {
  admin: `You are a world-class AI operations assistant for the admin team at Coen Construction.
You have full visibility into the business: leads, projects, estimates, invoices, blog, and team.
Your job is to surface insights, flag issues, and make the admin team faster and smarter.
- Leads: statuses, trends, follow-up priorities
- Estimates and Projects: pipeline, cost analysis, scope reviews
- Invoices: pending approvals, overdue items, vendor patterns
- Blog and SEO: content gaps, publishing schedule
- Team: permissions, activity
Always give specific, actionable answers grounded in the live data provided. Be the best assistant they have ever used.`,
  estimator: `You are an expert AI estimating assistant for Coen Construction.
You specialize in reviewing and building estimate line items, generating material takeoffs, qualifying leads, writing scope of work descriptions, and vendor recommendations.
Be precise with numbers. Help the estimator work faster and more accurately.`,
  viewer: `You are a helpful AI assistant for a team member at Coen Construction.
You can help with reviewing data, answering questions about projects and leads, drafting emails or notes, and summarizing the pipeline.`,
};

function getSystemPrompt(user) {
  const base = ROLE_SYSTEM_PROMPTS[user.role] || ROLE_SYSTEM_PROMPTS.viewer;
  return `${base}
${FORMATTING_RULES}
${TOOLS_DESCRIPTION}
USER CONTEXT:
- Name: ${user.name}
- Role: ${user.role}
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

async function executeTool(base44, toolName, args, userEmail, gmailConnected, calendarConnected) {
  switch (toolName) {
    case 'get_leads': {
      const filter = {};
      if (args.status) filter.status = args.status;
      const records = await base44.asServiceRole.entities.Lead.list('-created_date', args.limit || 50);
      const filtered = args.status ? records.filter(r => r.status === args.status) : records;
      return filtered.map(l => ({
        id: l.id,
        name: l.full_name,
        email: l.email,
        phone: l.phone,
        project_type: l.project_type,
        status: l.status,
        source: l.source,
        address: l.address,
        message: l.message,
        notes: l.notes,
        created: l.created_date?.slice(0, 10),
      }));
    }
    case 'get_projects': {
      const records = await base44.asServiceRole.entities.ContractorProject.list('-created_date', args.limit || 50);
      const filtered = args.status ? records.filter(r => r.status === args.status) : records;
      return filtered.map(p => ({
        id: p.id,
        client: p.client_name,
        email: p.client_email,
        phone: p.client_phone,
        address: p.client_address,
        type: p.project_type,
        status: p.status,
        description: p.description,
        scope: p.scope_of_work,
        original_total: p.original_estimate_total,
        adjusted_total: p.adjusted_total,
        assigned_to: p.assigned_to,
        walkthrough_date: p.walkthrough_date,
        created: p.created_date?.slice(0, 10),
      }));
    }
    case 'get_invoices': {
      const records = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', args.limit || 100);
      const filtered = args.status ? records.filter(r => r.status === args.status) : records;
      return filtered.map(i => ({
        id: i.id,
        vendor: i.vendor_name,
        vendor_email: i.vendor_email,
        invoice_number: i.invoice_number,
        invoice_date: i.invoice_date,
        due_date: i.due_date,
        amount: i.amount,
        currency: i.currency,
        document_type: i.document_type,
        status: i.status,
        email_subject: i.email_subject,
        received: i.email_received_date?.slice(0, 10),
        pinned: i.pinned,
        project_id: i.project_id,
        notes: i.notes,
        ai_extracted: i.ai_extracted,
      }));
    }
    case 'get_estimates': {
      const records = await base44.asServiceRole.entities.Estimate.list('-created_date', args.limit || 50);
      const filtered = args.status ? records.filter(r => r.status === args.status) : records;
      return filtered.map(e => ({
        id: e.id,
        project_id: e.project_id,
        title: e.title,
        type: e.type,
        status: e.status,
        version: e.version,
        subtotal: e.subtotal,
        grand_total: e.grand_total,
        tax_rate: e.tax_rate,
        valid_until: e.valid_until,
        created: e.created_date?.slice(0, 10),
      }));
    }
    case 'get_blog_posts': {
      const records = await base44.asServiceRole.entities.BlogPost.list('-created_date', args.limit || 20);
      const filtered = args.published === true ? records.filter(r => r.published) :
                       args.published === false ? records.filter(r => !r.published) : records;
      return filtered.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        published: p.published,
        read_time: p.read_time,
        created: p.created_date?.slice(0, 10),
      }));
    }
    case 'gmail_search': {
      if (!gmailConnected) return { error: 'Gmail not connected. User must connect Staff AI Gmail in integrations settings.' };
      try {
        const GMAIL_CONNECTOR_ID = '69d7f13365faab80a1faef3b';
        const gmailConn = await base44.asServiceRole.connectors.getConnection("gmail");
        const token = gmailConn.accessToken;
        const q = encodeURIComponent(args.query || '');
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${Math.min(args.max_results || 5, 10)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const msgs = data.messages || [];
        const results = [];
        for (const msg of msgs.slice(0, 5)) {
          try {
            const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const m = await mRes.json();
            const headers = m.payload?.headers || [];
            results.push({
              id: msg.id,
              subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
              from: headers.find(h => h.name === 'From')?.value || '',
              date: headers.find(h => h.name === 'Date')?.value || '',
              snippet: m.snippet?.slice(0, 200) || ''
            });
          } catch (_) {}
        }
        return { emails: results, query: args.query };
      } catch (err) {
        return { error: `Gmail search failed: ${err.message}` };
      }
    }
    case 'calendar_events': {
      if (!calendarConnected) return { error: 'Calendar not connected. User must connect Staff AI Calendar in integrations settings.' };
      try {
        const CALENDAR_CONNECTOR_ID = '69d7f137c2264bb13d8db588';
        const calendarConn = await base44.asServiceRole.connectors.getConnection("googlecalendar");
        const token = calendarConn.accessToken;
        const now = new Date().toISOString();
        const later = new Date(Date.now() + (args.days_ahead || 7) * 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(later)}&singleEvents=true&orderBy=startTime&maxResults=10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const events = data.items || [];
        return { events: events.map(e => ({ summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date })) };
      } catch (err) {
        return { error: `Calendar fetch failed: ${err.message}` };
      }
    }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function parseToolCall(text) {
  // Look for a JSON tool call line anywhere in the response
  const lines = text.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{"tool":')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.tool) return parsed;
      } catch (_) {}
    }
  }
  return null;
}

async function getBaseContext(base44, user) {
  // Lightweight summary context always injected
  const context = {};
  try {
    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 10);
    context.leads_snapshot = {
      total_recent: leads.length,
      new: leads.filter(l => l.status === 'New').length,
      contacted: leads.filter(l => l.status === 'Contacted').length,
      won: leads.filter(l => l.status === 'Won').length,
      lost: leads.filter(l => l.status === 'Lost').length,
    };
  } catch (_) {}
  try {
    const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 10);
    context.projects_snapshot = {
      total_recent: projects.length,
      walkthrough: projects.filter(p => p.status === 'walkthrough').length,
      in_progress: projects.filter(p => p.status === 'in_progress').length,
      completed: projects.filter(p => p.status === 'completed').length,
    };
  } catch (_) {}
  try {
    const invoices = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', 50);
    const totalAmount = invoices.filter(i => i.amount && i.status !== 'rejected').reduce((s, i) => s + Number(i.amount), 0);
    context.invoices_snapshot = {
      total: invoices.length,
      pending_review: invoices.filter(i => i.status === 'pending_review').length,
      outstanding: invoices.filter(i => i.status === 'outstanding').length,
      paid: invoices.filter(i => i.status === 'paid').length,
      total_value: `$${totalAmount.toLocaleString()}`,
    };
  } catch (_) {}
  return context;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, undefined, body);
    const { messages, includeContext, gmailConnected, calendarConnected } = body;

    // Load persistent memory
    let memoryRecord = null;
    let memoryContext = '';
    try {
      const records = await base44.asServiceRole.entities.AiMemory.filter({ user_email: user.email });
      if (records.length > 0) {
        memoryRecord = records[0];
        memoryContext = `\n\nPERSISTENT MEMORY:\nSummary: ${memoryRecord.summary || '(none yet)'}\nKey notes: ${(memoryRecord.memories || []).slice(-5).map(m => m.content).join(', ') || '(none yet)'}`;
      }
    } catch (_) {}

    const systemPrompt = getSystemPrompt(user) + memoryContext;

    let contextBlock = '';
    if (includeContext) {
      const ctx = await getBaseContext(base44, user);
      contextBlock = `\n\nBASELINE DATA SNAPSHOT (use tools to get full records):\n${JSON.stringify(ctx, null, 2)}`;
    }

    const fullSystem = systemPrompt + contextBlock;

    const buildConversationText = (msgs, toolResults) => {
      let conv = msgs.map(m => `${m.role === 'user' ? user.name : 'Assistant'}: ${m.content}`).join('\n');
      if (toolResults.length > 0) {
        conv += '\n\n' + toolResults.map(tr => `[TOOL RESULT: ${tr.tool}]\n${JSON.stringify(tr.data, null, 2)}\n[/TOOL RESULT]`).join('\n');
        conv += '\n\nNow answer the user using the tool results above.';
      }
      return conv;
    };

    // Tool-calling loop (max 3 tool calls per turn)
    const toolResults = [];
    const calledTools = new Set();
    let finalReply = '';
    let toolsUsed = [];

    for (let i = 0; i < 4; i++) {
      const conversationText = buildConversationText(messages, toolResults);
      const prompt = `${fullSystem}\n\n---\nCONVERSATION:\n${conversationText}\n\nAssistant:`;

      const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
      });

      const toolCall = parseToolCall(response);

      if (toolCall && !calledTools.has(toolCall.tool)) {
        calledTools.add(toolCall.tool);
        const data = await executeTool(base44, toolCall.tool, toolCall.args || {}, user.email, gmailConnected, calendarConnected);
        toolResults.push({ tool: toolCall.tool, args: toolCall.args, data });
        toolsUsed.push(toolCall.tool);
        continue;
      }

      // No tool call — this is the final answer
      finalReply = response;
      break;
    }

    if (!finalReply) {
      // Fallback: ask for final answer after tool calls
      const conversationText = buildConversationText(messages, toolResults);
      const prompt = `${fullSystem}\n\n---\nCONVERSATION:\n${conversationText}\n\nAssistant:`;
      finalReply = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: 'claude_sonnet_4_6' });
    }

    // Extract and save persistent memory
    try {
      const memoryExtractPrompt = `Extract 1-2 key facts or preferences to remember from this conversation for future reference. Return as a JSON array of objects with {"content": "...", "category": "..."}. Categories: preference, fact, contact, project_note, todo. Return empty array if nothing to remember.`;
      const fullConv = messages.map(m => `${m.role}: ${m.content}`).join('\n') + `\n\nAssistant: ${finalReply}`;
      const memoryJson = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${memoryExtractPrompt}\n\nConversation:\n${fullConv}\n\nJSON array:`,
        response_json_schema: { type: 'array', items: { type: 'object' } }
      });
      const newMemories = memoryJson || [];
      if (newMemories.length > 0) {
        const memoriesWithDate = newMemories.map(m => ({ ...m, created_at: new Date().toISOString() }));
        if (memoryRecord) {
          const updated = { memories: [...(memoryRecord.memories || []), ...memoriesWithDate].slice(-20) };
          await base44.asServiceRole.entities.AiMemory.update(memoryRecord.id, updated);
        } else {
          await base44.asServiceRole.entities.AiMemory.create({
            user_email: user.email,
            memories: memoriesWithDate,
            conversation_count: 1
          });
        }
      }
    } catch (_) {}

    return Response.json({ reply: finalReply, tools_used: toolsUsed });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});