import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const GMAIL_CONNECTOR_ID = '69d7f13365faab80a1faef3b';
const CALENDAR_CONNECTOR_ID = '69d7f137c2264bb13d8db588';

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

// ---------------------------------------------------------------------------
// Permissions — same semantics as src/lib/backendNav.js (admin sees all,
// otherwise the boolean can_access_* flag on the AdminUser record decides).
// ---------------------------------------------------------------------------

function hasPerm(user, perm) {
  if (!perm) return true;
  if (user?.role === 'admin') return true;
  return user?.[perm] === true;
}

const ROLE_LABELS = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  assistant_project_manager: 'Assistant Project Manager',
  site_superintendent: 'Site Superintendent',
  operations_manager: 'Operations Manager',
  office_admin: 'Office Admin',
  estimator: 'Estimator',
  viewer: 'Viewer',
};

const PERM_LABELS = {
  can_access_leads: 'Leads',
  can_access_invoices: 'Invoice Inbox',
  can_access_estimates: 'Estimating Suite',
  can_access_blog: 'Blog Posts',
  can_access_cms: 'CMS / Pages',
  can_access_seo: 'SEO Tools',
  can_access_team: 'Team Access',
  can_access_tracking: 'Tracking & Code',
  can_access_field_crew: 'Field Crew & Time Off',
  can_approve_payroll: 'Payroll Approvals',
};

// ---------------------------------------------------------------------------
// App guide — the assistant's map of the backend. KEEP IN SYNC with the nav
// model in src/lib/backendNav.js (groups, paths, permissions) so instructions
// always match what the user's sidebar actually shows.
// ---------------------------------------------------------------------------

const APP_GUIDE = [
  {
    group: 'Overview', perm: 'can_access_estimates',
    items: [
      { label: 'Command Center', path: '/estimator', desc: 'Daily ops hub: communication queue, payment status, items waiting on approval, stalled projects.' },
      { label: 'Dashboard', path: '/estimator/dashboard', desc: 'KPIs: pipeline by stage, financials, overdue customer follow-ups.' },
      { label: 'Comms Hub', path: '/estimator/comms', desc: 'Every client conversation in one feed. Open an item to reply or log it.' },
    ],
  },
  {
    group: 'Sales & Clients',
    items: [
      { label: 'Leads', path: '/admin/leads', perm: 'can_access_leads', desc: 'New inquiries from the website and phone (incl. transcribed voicemails). Review, qualify, update status, convert to a project.' },
      { label: 'Customer Quotes', path: '/admin/estimates', perm: 'can_access_estimates', desc: 'All estimates and quotes. Create new ones, email them to the customer, track approval. New Quote starts from scratch; Create Similar copies a past quote.' },
      { label: 'Customer History', path: '/estimator/customers', perm: 'can_access_estimates', desc: 'Search any customer to see every project and quote ever done for them.' },
      { label: 'Invoices', path: '/admin/invoices', perm: 'can_access_invoices', desc: 'Invoice inbox synced from email. Track owed / paid / overdue, fix project matches, follow up on payments.' },
      { label: 'Reviews', path: '/admin/reviews', desc: 'Google reviews synced automatically; 5-star reviews are auto-approved for the website. Approve or hide what shows publicly.' },
    ],
  },
  {
    group: 'Projects', perm: 'can_access_estimates',
    items: [
      { label: 'Active Projects', path: '/estimator/active-projects', desc: 'Only the jobs currently in progress.' },
      { label: 'All Projects', path: '/estimator/projects', desc: 'Every project, searchable and sortable. Click one for full detail: scope, timeline, budget, documents.' },
      { label: 'Kanban Board', path: '/estimator/kanban', desc: 'Drag projects through stages: walkthrough, quote sent, approved, in progress, completed.' },
      { label: 'Walkthrough Calendar', path: '/admin/calendar', desc: 'Scheduled site walkthroughs on a calendar.' },
      { label: 'Schedule', path: '/estimator/calendar', desc: 'Team schedule, synced with Google Calendar.' },
      { label: 'Project Tasks', path: '/estimator/tasks', desc: 'Checklists and to-dos per project, assignable to teammates.' },
      { label: 'New Walkthrough', path: '/estimator/walkthrough', desc: 'The 4-step wizard that starts a new project: client info, rooms, photos, scope of work. Voice dictation works for the scope; can be prefilled from a Lead.' },
    ],
  },
  {
    group: 'Field Tools', perm: 'can_access_estimates',
    items: [
      { label: 'Quick Measure', path: '/estimator/measure', desc: 'AR measuring with the phone camera.' },
      { label: 'Material Take-Off', path: '/estimator/mto', desc: 'Upload plans or sketches, generate a material list by trade, email it to vendors for pricing.' },
      { label: 'Scope of Work', path: '/estimator/sow', desc: 'Auto-draft a scope of work from project details and photos; send to subs for bids.' },
      { label: 'Bid Replies', path: '/estimator/bid-replies', desc: 'Vendor and sub pricing replies, compared side by side.' },
      { label: 'Roof Measurement', path: '/estimator/roof-measure', desc: 'Roof area, pitch, and squares calculations.' },
      { label: 'Receipt Scanner', path: '/estimator/receipts', desc: 'Snap a receipt photo; line items are extracted for job costing.' },
      { label: 'Daily Logs', path: '/estimator/logs', desc: 'Per-day job-site logs: crew, work done, photos, notes.' },
      { label: 'Trade Calculators', path: '/estimator/calculators', desc: 'Quick lumber, concrete, electrical, plumbing math.' },
      { label: 'Code Lookup', path: '/estimator/codes', desc: 'Building-code quick reference (egress, ledgers, clearances).' },
      { label: 'Margin Guard', path: '/estimator/margin', desc: 'Profitability check; flags jobs drifting below target margin.' },
      { label: 'Toolbox', path: '/estimator/toolbox', desc: 'Permit portals and estimating resource links.' },
    ],
  },
  {
    group: 'Employees',
    items: [
      { label: 'Onboarding Packets', path: '/admin/onboarding', perm: 'can_access_team', desc: 'Send W-2/1099 hire packets, review submitted forms, ID and signature, approve or request changes.' },
      { label: 'Team Access & Roles', path: '/admin/team', perm: 'can_access_team', desc: 'Add team members, assign roles (role defaults auto-apply, toggles fine-tune per person), resend invites, deactivate accounts.' },
      { label: 'Field Crew Admin', path: '/estimator/field-crew', perm: 'can_access_field_crew', desc: 'Crew assignments, dashboards, time tracking.' },
      { label: 'Time Off', path: '/estimator/time-off', perm: 'can_access_field_crew', desc: 'Request and approve time off.' },
      { label: 'Payroll Approvals', path: '/admin/payroll-approvals', perm: 'can_approve_payroll', desc: 'Weekly payroll review and sign-off.' },
    ],
  },
  {
    group: 'Subs & Vendors', perm: 'can_access_estimates',
    items: [
      { label: 'Vendors & Subs', path: '/estimator/vendors', desc: 'Contractor database: contacts, licenses, insurance compliance.' },
      { label: 'Subcontractors', path: '/admin/subcontractors', desc: 'Active subs at a glance: workload, invoice status.' },
      { label: 'Sub Invoice Approvals', path: '/admin/sub-approvals', desc: 'Review and approve subcontractor invoices.' },
      { label: 'Sub Payment Gating', path: '/estimator/payment-gating', perm: 'can_access_invoices', desc: 'Hold or release sub payments based on document compliance.' },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Blog Posts', path: '/admin/blog', perm: 'can_access_blog', desc: 'Write and publish blog posts.' },
      { label: 'CMS / Pages', path: '/admin/cms', perm: 'can_access_cms', desc: 'Edit website pages and content.' },
      { label: 'SEO Tools', path: '/admin/seo', perm: 'can_access_seo', desc: 'SEO audits and keyword recommendations.' },
    ],
  },
  {
    group: 'Settings',
    items: [
      { label: 'Comm Benchmarks', path: '/estimator/comms-settings', perm: 'can_access_estimates', desc: 'Automated follow-up rules, e.g. remind a customer X days after a quote goes out.' },
      { label: 'Comm Performance', path: '/estimator/comms-performance', perm: 'can_access_estimates', desc: 'Response analytics by lead source and channel.' },
      { label: 'Email Templates', path: '/estimator/email-templates', perm: 'can_access_estimates', desc: 'Reusable email templates for customers and crews.' },
      { label: 'Tracking & Code', path: '/admin/tracking', perm: 'can_access_tracking', desc: 'Analytics and tracking scripts on the website.' },
      { label: 'Company Profile', path: '/admin/profile', desc: 'Company info, branding, default markup percent and tax rate (these flow into new quotes).' },
    ],
  },
];

// Step-by-step workflows the assistant can teach, gated by the same flags.
const WORKFLOWS = [
  {
    perm: 'can_access_estimates',
    title: 'CREATE A QUOTE (walkthrough to sent)',
    steps: '1. Start at New Walkthrough: 4 steps - client info, rooms, photos, scope of work. Voice dictation works for the scope; a walkthrough can be prefilled from a Lead. 2. Build the quote via the New Quote button on Customer Quotes: add line items (labor, material, sub, allowance, other); markup pre-fills from Company Profile. Create Similar copies a past quote. 3. Email it to the customer right from the app. 4. Track approval in Customer Quotes and move the project across the Kanban Board.',
  },
  {
    perm: 'can_access_estimates',
    title: 'PRICE MATERIALS WITH VENDORS',
    steps: '1. Open Material Take-Off, upload plans or sketches, generate the material list by trade. 2. Email the list to vendors from the same page. 3. Replies land in Bid Replies for side-by-side comparison. 4. Check Margin Guard before sending the quote.',
  },
  {
    perm: 'can_access_leads',
    title: 'WORK A NEW LEAD',
    steps: '1. Open Leads; newest inquiries are on top (website forms, phone, transcribed voicemails). 2. Review details, confirm contact info, update the status. 3. Respond fast - speed of first contact wins jobs.',
  },
  {
    perm: 'can_access_invoices',
    title: 'CHASE AND MANAGE INVOICES',
    steps: '1. Open Invoices; the inbox syncs from email automatically and flags priority items. 2. Check pending review, outstanding, and overdue. 3. Fix the project match if an invoice landed on the wrong job. 4. For sub payments held on compliance, use Sub Payment Gating.',
  },
  {
    perm: 'can_access_team',
    title: 'ADD A TEAM MEMBER',
    steps: '1. Open Team Access & Roles and add a member: name, email, role. 2. Role defaults apply the right permissions automatically; fine-tune with the toggles. 3. Send the invite or copy the setup link. 4. For hire paperwork, send a W-2/1099 packet from Onboarding Packets.',
  },
  {
    perm: 'can_approve_payroll',
    title: 'APPROVE PAYROLL',
    steps: '1. Open Payroll Approvals weekly. 2. Review hours and amounts per person. 3. Approve or flag discrepancies.',
  },
];

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

function buildInstructionalRules(hasDenied) {
  return `
HOW TO TEACH THE APP:
- When the user asks how to do something, answer with the exact click path from the APP GUIDE (e.g. "Sidebar: Projects, then Kanban Board") followed by short numbered steps. Use the matching WORKFLOWS recipe when one fits.
- ONLY reference pages, buttons, and features that appear in the APP GUIDE or WORKFLOWS. Never invent or guess at UI that is not listed there.${hasDenied ? `
- If what they want lives under OUTSIDE YOUR ACCESS, say so plainly: name the area and the access it needs, and that an Admin can grant it under Employees, then Team Access & Roles. If one of your data tools can answer the underlying question anyway, offer that.` : ''}
- If the user seems new or lost, remind them they can replay the guided tour any time: avatar menu (top right), then App tour. Ctrl+K (Cmd+K on Mac) jumps to any page or project from anywhere.
- On phones the bottom tab bar reaches the key areas, and the Field Tools are built for on-site phone use.
`;
}

const ROLE_SYSTEM_PROMPTS = {
  admin: `You are a world-class AI operations assistant for the admin team at Coen Construction.
You have full visibility into the business: leads, projects, estimates, invoices, blog, and team.
Your job is to surface insights, flag issues, teach any part of the backend, and make the admin team faster and smarter.
Always give specific, actionable answers grounded in the live data provided. Be the best assistant they have ever used.`,
  project_manager: `You are an expert AI assistant for a Project Manager at Coen Construction.
You help them run jobs end to end: working leads, building and sending quotes, tracking active projects, coordinating subs and vendors, and staying on top of invoices and sub payments.
Be practical and jobsite-aware. Surface what needs attention first: stalled projects, overdue follow-ups, unpaid invoices.`,
  assistant_project_manager: `You are an expert AI assistant for an Assistant Project Manager at Coen Construction.
You help them support project delivery: qualifying leads, preparing quotes and walkthroughs, keeping project tasks and daily logs current, and gathering sub and vendor pricing.
Money matters (invoices, payments, payroll) are handled by PMs and the office, so route those questions there.`,
  site_superintendent: `You are an expert AI assistant for a Site Superintendent at Coen Construction.
Their world is the job site: active projects, daily logs, task checklists, measuring and scoping tools, material take-offs, and the subs working their jobs.
Be field-first and phone-friendly: short, concrete answers they can act on while standing on site.`,
  operations_manager: `You are an expert AI operations assistant for the Operations Manager at Coen Construction.
You have the widest non-admin view: the full sales-to-job pipeline, invoices, subs and vendors, plus people management (team access and onboarding packets).
Think in systems: pipeline health, bottlenecks, who needs access to what, and where money is stuck.`,
  office_admin: `You are an expert AI assistant for the front office at Coen Construction.
You help with the three front-office jobs: triaging incoming leads fast, working the invoice inbox (owed, paid, overdue), and keeping an eye on customer reviews.
The estimating and project tools are outside this role, so route those questions to a PM or estimator while still answering what you can from leads and invoice data.`,
  estimator: `You are an expert AI estimating assistant for Coen Construction.
You specialize in reviewing and building estimate line items, generating material takeoffs, qualifying leads, writing scope of work descriptions, and vendor recommendations.
Be precise with numbers. Help the estimator work faster and more accurately.`,
  viewer: `You are a helpful AI assistant for a team member at Coen Construction with view-level access.
You can help them follow incoming leads, keep an eye on customer reviews, draft emails or notes, and understand how the backend works.
If they need to act on something beyond their access, point them to the right teammate or note that an Admin can expand their role.`,
};

// ---------------------------------------------------------------------------
// Tools — each gated by the same permission flag as the page that shows the
// data, so the assistant can never hand a user data their role hides.
// ---------------------------------------------------------------------------

const TOOL_DEFS = {
  get_leads: {
    perm: 'can_access_leads',
    usage: `{"tool": "get_leads", "args": {"limit": 50, "status": "New"}}
  - status: "New" | "Contacted" | "Won" | "Lost" | null (all)
  - limit: number (default 50)`,
  },
  get_projects: {
    perm: 'can_access_estimates',
    usage: `{"tool": "get_projects", "args": {"limit": 50, "status": "walkthrough"}}
  - status: "walkthrough" | "draft" | "sent" | "approved" | "in_progress" | "completed" | "cancelled" | null (all)
  - limit: number (default 50)`,
  },
  get_invoices: {
    perm: 'can_access_invoices',
    usage: `{"tool": "get_invoices", "args": {"limit": 100, "status": "pending_review"}}
  - status: "pending_review" | "approved" | "paid" | "outstanding" | "on_hold" | "rejected" | null (all)
  - limit: number (default 100)`,
  },
  get_estimates: {
    perm: 'can_access_estimates',
    usage: `{"tool": "get_estimates", "args": {"limit": 50, "status": "draft"}}
  - status: "draft" | "sent" | "approved" | "rejected" | "superseded" | null (all)`,
  },
  get_blog_posts: {
    perm: 'can_access_blog',
    usage: `{"tool": "get_blog_posts", "args": {"limit": 20, "published": true}}
  - published: true | false | null (all)`,
  },
  gmail_search: {
    perm: null,
    usage: `{"tool": "gmail_search", "args": {"query": "subject:invoice from:vendor@example.com", "max_results": 5}}
  - query: Gmail search string (e.g. "from:someone@example.com", "subject:urgent", "has:attachment")
  - max_results: number of emails (default 5, max 10)
  - Only available if user has connected Staff AI Gmail`,
  },
  calendar_events: {
    perm: null,
    usage: `{"tool": "calendar_events", "args": {"days_ahead": 7}}
  - days_ahead: show upcoming events for next N days (default 7)
  - Only available if user has connected Staff AI Calendar`,
  },
};

function buildToolsDescription(user) {
  const available = Object.entries(TOOL_DEFS).filter(([, def]) => hasPerm(user, def.perm));
  return `
TOOL CALLING:
You have access to live data tools. When you need fresh or specific data, output ONLY a JSON object on its own line in this exact format:
{"tool": "<tool_name>", "args": {<args>}}

Available tools (these are the ONLY tools this user's access level allows — if a kind of data is not listed here, their role does not include it; explain that instead of attempting a call):

${available.map(([, def]) => def.usage).join('\n\n')}

IMPORTANT: Output the JSON tool call ONLY — nothing else on that line. After receiving tool results, use them to answer the user. Do not call the same tool twice in one turn.
`;
}

function effectivePerm(group, item) {
  return item.perm !== undefined ? item.perm : group.perm ?? null;
}

function buildAccessProfile(user) {
  const accessible = [];
  const denied = [];
  for (const group of APP_GUIDE) {
    const inItems = [];
    const outItems = [];
    for (const item of group.items) {
      const perm = effectivePerm(group, item);
      if (hasPerm(user, perm)) {
        inItems.push(`. ${item.label} (${item.path}) — ${item.desc}`);
      } else {
        outItems.push(`. ${item.label} — needs ${PERM_LABELS[perm] || perm} access`);
      }
    }
    if (inItems.length) accessible.push(`${group.group.toUpperCase()}:\n${inItems.join('\n')}`);
    if (outItems.length) denied.push(...outItems);
  }

  const workflows = WORKFLOWS.filter(w => hasPerm(user, w.perm))
    .map(w => `${w.title}:\n${w.steps}`)
    .join('\n\n');

  let text = `
APP GUIDE (every page this user can see in their sidebar, grouped exactly like the sidebar, with what each does):

${accessible.join('\n\n')}
`;
  if (workflows) {
    text += `
WORKFLOWS (step-by-step recipes you can teach):

${workflows}
`;
  }
  if (denied.length) {
    text += `
OUTSIDE YOUR ACCESS (these exist in the backend but this user's role does not include them — never pretend they can open these; an Admin can grant access under Employees, then Team Access & Roles):
${denied.join('\n')}
`;
  }
  return { text, hasDenied: denied.length > 0 };
}

function getSystemPrompt(user) {
  const base = ROLE_SYSTEM_PROMPTS[user.role] || ROLE_SYSTEM_PROMPTS.viewer;
  const profile = buildAccessProfile(user);
  return `${base}
${FORMATTING_RULES}
${profile.text}
${buildInstructionalRules(profile.hasDenied)}
${buildToolsDescription(user)}
USER CONTEXT:
- Name: ${user.name}
- Role: ${ROLE_LABELS[user.role] || user.role} (${user.role})
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

async function executeTool(base44, toolName, args, userEmail, gmailConnected, calendarConnected, user) {
  const def = TOOL_DEFS[toolName];
  if (!def) return { error: `Unknown tool: ${toolName}` };
  if (!hasPerm(user, def.perm)) {
    return {
      error: `Access denied: this user's role (${ROLE_LABELS[user?.role] || user?.role}) does not include ${PERM_LABELS[def.perm] || def.perm}. Do not retry. Explain that this data is outside their access level and that an Admin can grant it under Employees, then Team Access & Roles.`,
    };
  }
  switch (toolName) {
    case 'get_leads': {
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
        const gmailConn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID);
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
        const calendarConn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CALENDAR_CONNECTOR_ID);
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
  // Lightweight summary context always injected — but only the slices the
  // user's role can see in the app.
  const context = {};
  if (hasPerm(user, 'can_access_leads')) {
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
  }
  if (hasPerm(user, 'can_access_estimates')) {
    try {
      const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 10);
      context.projects_snapshot = {
        total_recent: projects.length,
        walkthrough: projects.filter(p => p.status === 'walkthrough').length,
        in_progress: projects.filter(p => p.status === 'in_progress').length,
        completed: projects.filter(p => p.status === 'completed').length,
      };
    } catch (_) {}
  }
  if (hasPerm(user, 'can_access_invoices')) {
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
  }
  return context;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, undefined, body);

    if (body.action === 'checkConnections') {
      const [gmailConnected, calendarConnected] = await Promise.all([
        base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID).then(() => true).catch(() => false),
        base44.asServiceRole.connectors.getCurrentAppUserConnection(CALENDAR_CONNECTOR_ID).then(() => true).catch(() => false),
      ]);
      return Response.json({ gmailConnected, calendarConnected });
    }

    const { messages = [], includeContext, gmailConnected, calendarConnected } = body;

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
        const data = await executeTool(base44, toolCall.tool, toolCall.args || {}, user.email, gmailConnected, calendarConnected, user);
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
        prompt: `${memoryExtractPrompt}\n\nConversation:\n${fullConv}\n\nReturn JSON with a memories array:`,
        response_json_schema: {
          type: 'object',
          properties: {
            memories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  category: { type: 'string' }
                }
              }
            }
          }
        }
      });
      const newMemories = memoryJson?.memories || [];
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
