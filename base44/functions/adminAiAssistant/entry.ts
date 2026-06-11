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
- When the user asks for DATA (numbers, lists, statuses, "most recent X"), pull it live with a tool and answer here in chat. Only point them to a page when they need to ACT (approve, edit, send) — and then still show the data first, with the page as the place to act.
- When the user asks how to do something, answer with the exact click path from the APP GUIDE (e.g. "Sidebar: Projects, then Kanban Board") followed by short numbered steps. Use the matching WORKFLOWS recipe when one fits.
- ONLY reference pages, buttons, and features that appear in the APP GUIDE or WORKFLOWS. Never invent or guess at UI that is not listed there.${hasDenied ? `
- If what they want lives under OUTSIDE YOUR ACCESS, say so plainly: name the area and the access it needs, and that an Admin can grant it under Employees, then Team Access & Roles. If one of your data tools can answer the underlying question anyway, offer that.` : ''}
- If the user seems new or lost, remind them they can replay the guided tour any time: avatar menu (top right), then App tour. Ctrl+K (Cmd+K on Mac) jumps to any page or project from anywhere.
- On phones the bottom tab bar reaches the key areas, and the Field Tools are built for on-site phone use.
`;
}

const ROLE_SYSTEM_PROMPTS = {
  admin: `You are a world-class AI operations assistant for the admin team at Coen Construction.
You have full visibility into the business: leads, projects, estimates, invoices, payroll and time tracking, sub bids and payables, vendors, receipts, daily logs, reviews, campaigns, team, and content.
Your job is to surface insights, flag issues, teach any part of the backend, and make the admin team faster and smarter.
Always give specific, actionable answers grounded in the live data provided — pull it with your tools rather than telling the user to go look at a page. Be the best assistant they have ever used.`,
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
// Data sources — every readable dataset in the backend, declared once. Each
// entry becomes a get_* tool gated by the same permission flag as the page
// that shows the data, so the assistant can never hand a user data their role
// hides. fields is a strict whitelist: tokens, password hashes, signatures,
// tax forms, ID scans, and raw document URLs never leave the server.
// ---------------------------------------------------------------------------

const DATA_SOURCES = {
  // SALES & CLIENTS
  get_leads: {
    entity: 'Lead', perm: 'can_access_leads', cat: 'SALES & CLIENTS', limit: 50,
    desc: 'Inbound inquiries from the website and phone, incl. transcribed voicemails',
    statusField: 'status', statuses: 'New | Contacted | Won | Lost',
    fields: ['id', 'full_name', 'email', 'phone', 'project_type', 'status', 'source', 'address', 'message', 'notes', 'created_date'],
  },
  get_estimates: {
    entity: 'Estimate', perm: 'can_access_estimates', cat: 'SALES & CLIENTS', limit: 50,
    desc: 'Customer quotes and change orders, incl. engagement (opened/viewed counts) and QuickBooks sync status',
    statusField: 'status', statuses: 'draft | sent | approved | rejected | superseded',
    fields: ['id', 'project_id', 'title', 'type', 'status', 'version', 'subtotal', 'tax_rate', 'grand_total', 'valid_until', 'sent_at', 'opened_at', 'open_count', 'viewed_at', 'view_count', 'approved_date', 'change_order_number', 'quickbooks_sync_status', 'created_date'],
  },
  get_client_communications: {
    entity: 'ClientCommunication', perm: 'can_access_estimates', cat: 'SALES & CLIENTS', limit: 50,
    desc: 'Comms Hub feed: follow-up reminders, inbound calls/voicemails (with transcripts), logged touches',
    statusField: 'status', statuses: 'open | logged | dismissed',
    fields: ['id', 'project_id', 'kind', 'direction', 'channel', 'status', 'urgency', 'title', 'prompt_detail', 'due_at', 'contacted_at', 'assigned_to', 'handled_by', 'log_note', 'response_minutes', 'voicemail_transcript', 'created_date'],
  },
  get_reviews: {
    entity: 'GoogleReview', perm: null, cat: 'SALES & CLIENTS', limit: 30,
    desc: 'Google reviews synced from the business listing (approved = shown on the website)',
    fields: ['id', 'author_name', 'rating', 'text', 'review_time', 'approved', 'featured', 'hidden'],
  },
  get_email_campaigns: {
    entity: 'EmailCampaign', perm: 'can_access_leads', cat: 'SALES & CLIENTS', limit: 20,
    desc: 'Email marketing campaigns with send/fail counts and drip settings',
    statusField: 'status', statuses: 'draft | sending | sent',
    fields: ['id', 'name', 'status', 'created_by', 'sent_at', 'recipient_count', 'sent_count', 'failed_count', 'wave_size', 'drip_enabled', 'created_date'],
  },
  get_sms_log: {
    entity: 'SmsMessageLog', perm: 'can_access_leads', cat: 'SALES & CLIENTS', limit: 50,
    desc: 'Outbound/inbound SMS to customers (reminders, project updates, replies)',
    statusField: 'status', statuses: 'queued | sent | delivered | failed | blocked_opt_out | received',
    fields: ['id', 'phone_number', 'direction', 'trigger_type', 'body', 'status', 'sent_at', 'received_at', 'error_message'],
  },
  get_customer_portals: {
    entity: 'CustomerPortal', perm: 'can_access_estimates', cat: 'SALES & CLIENTS', limit: 50,
    desc: 'Customer portal access per project: notification prefs, customer notes, last viewed',
    fields: ['id', 'project_id', 'client_name', 'client_email', 'portal_sent_at', 'last_viewed_at', 'sms_notifications', 'email_notifications', 'customer_notes'],
  },

  // PROJECTS & FIELD
  get_projects: {
    entity: 'ContractorProject', perm: 'can_access_estimates', cat: 'PROJECTS & FIELD', limit: 50,
    desc: 'Job records from walkthrough to completion',
    statusField: 'status', statuses: 'walkthrough | draft | sent | approved | in_progress | completed | cancelled',
    fields: ['id', 'client_name', 'client_email', 'client_phone', 'client_address', 'project_type', 'status', 'description', 'scope_of_work', 'original_estimate_total', 'adjusted_total', 'assigned_to', 'walkthrough_date', 'created_date'],
  },
  get_walkthroughs: {
    entity: 'WalkthroughSession', perm: 'can_access_estimates', cat: 'PROJECTS & FIELD', limit: 30,
    desc: 'Walkthrough wizard sessions (site visits that start projects)',
    statusField: 'status', statuses: 'in_progress | completed | submitted',
    fields: ['id', 'project_id', 'estimator_email', 'status', 'step', 'gps_address', 'project_type', 'scope_of_work', 'created_date'],
  },
  get_project_tasks: {
    entity: 'ProjectTask', perm: 'can_access_estimates', cat: 'PROJECTS & FIELD', limit: 50,
    desc: 'Office-side task checklists per project stage',
    statusField: 'status', statuses: 'open | in_progress | done | skipped',
    fields: ['id', 'project_id', 'stage_name', 'title', 'description', 'assigned_role', 'assigned_to', 'status', 'priority', 'due_date', 'created_date'],
  },
  get_field_tasks: {
    entity: 'FieldTask', perm: 'can_access_field_crew', cat: 'PROJECTS & FIELD', limit: 50,
    desc: 'Tasks assigned to field crew members on jobsites',
    statusField: 'status', statuses: 'assigned | in_progress | done | blocked',
    fields: ['id', 'project_id', 'project_name', 'assigned_to_name', 'assigned_by', 'title', 'description', 'due_date', 'priority', 'status', 'completion_notes', 'completed_at', 'created_date'],
  },
  get_daily_logs: {
    entity: 'DailyLog', perm: 'can_access_estimates', cat: 'PROJECTS & FIELD', limit: 50,
    desc: 'Per-day jobsite logs: crew count, weather, work notes',
    fields: ['id', 'project_id', 'date', 'notes', 'weather', 'crew_count', 'created_date'],
  },
  get_punchlists: {
    entity: 'Punchlist', perm: 'can_access_estimates', cat: 'PROJECTS & FIELD', limit: 30,
    desc: 'End-of-milestone punch lists submitted by customers',
    statusField: 'status', statuses: 'not_sent | sent | submitted | reviewed',
    fields: ['id', 'project_id', 'client_name', 'status', 'sent_at', 'submitted_at', 'items', 'admin_notes', 'created_date'],
  },
  get_equipment: {
    entity: 'EquipmentItem', perm: 'can_access_field_crew', cat: 'PROJECTS & FIELD', limit: 50,
    desc: 'Equipment inventory and availability',
    statusField: 'status', statuses: 'available | checked_out | maintenance | retired',
    fields: ['id', 'name', 'category', 'serial_number', 'asset_tag', 'status', 'active', 'notes'],
  },
  get_equipment_checkouts: {
    entity: 'EquipmentCheckout', perm: 'can_access_field_crew', cat: 'PROJECTS & FIELD', limit: 50,
    desc: 'Who has what equipment out, on which job, and in what condition',
    statusField: 'status', statuses: 'out | returned',
    fields: ['id', 'equipment_name', 'user_name', 'project_id', 'project_name', 'checked_out_at', 'checked_in_at', 'condition_out', 'condition_in', 'status', 'created_date'],
  },
  get_saved_mtos: {
    entity: 'SavedMTO', perm: 'can_access_estimates', cat: 'PROJECTS & FIELD', limit: 20,
    desc: 'Saved material take-offs with totals and which trades were emailed',
    fields: ['id', 'title', 'notes', 'total_cost', 'total_items', 'emailed_trades', 'created_date'],
  },
  get_saved_sows: {
    entity: 'SavedSoW', perm: 'can_access_estimates', cat: 'PROJECTS & FIELD', limit: 20,
    desc: 'Saved scopes of work and which subs were invited to bid',
    fields: ['id', 'title', 'project_id', 'notes', 'total_trades', 'total_items', 'emailed_trades', 'created_date'],
  },

  // MONEY
  get_invoices: {
    entity: 'InvoiceRecord', perm: 'can_access_invoices', cat: 'MONEY', limit: 100, sort: '-email_received_date',
    desc: 'Vendor invoice inbox synced from email',
    statusField: 'status', statuses: 'pending_review | approved | paid | outstanding | on_hold | rejected',
    fields: ['id', 'vendor_name', 'vendor_email', 'invoice_number', 'invoice_date', 'due_date', 'amount', 'currency', 'document_type', 'status', 'email_subject', 'email_received_date', 'pinned', 'project_id', 'notes', 'ai_extracted'],
  },
  get_purchase_receipts: {
    entity: 'PurchaseReceipt', perm: 'can_access_estimates', cat: 'MONEY', limit: 50,
    desc: 'Scanned material/supply receipts with line items for job costing',
    statusField: 'status', statuses: 'pending_review | reconciled | unmatched | approved',
    fields: ['id', 'project_id', 'source', 'vendor_name', 'receipt_date', 'receipt_number', 'po_reference', 'subtotal', 'tax', 'grand_total', 'status', 'submitted_by_name', 'notes', 'created_date'],
  },
  get_field_receipts: {
    entity: 'FieldReceipt', perm: 'can_access_field_crew', cat: 'MONEY', limit: 50,
    desc: 'Crew expense/reimbursement receipts awaiting review',
    statusField: 'status', statuses: 'pending | in_progress | approved | denied',
    fields: ['id', 'user_name', 'receipt_type', 'project_id', 'project_name', 'reason', 'vendor_name', 'amount', 'receipt_date', 'description', 'status', 'admin_notes', 'reviewed_by', 'created_date'],
  },
  get_sub_payables: {
    entity: 'SubPayable', perm: 'can_access_invoices', cat: 'MONEY', limit: 50,
    desc: 'Subcontractor payment tracking: contract amounts and their invoices',
    fields: ['id', 'project_id', 'vendor_name', 'vendor_company', 'trade', 'contract_amount', 'invoices', 'notes', 'created_date'],
    nested: { invoices: ['id', 'label', 'amount', 'status', 'due_date', 'approved_date', 'paid_date', 'notes', 'approval_notes'] },
  },
  get_payment_schedules: {
    entity: 'PaymentSchedule', perm: 'can_access_invoices', cat: 'MONEY', limit: 30,
    desc: 'Customer payment milestone schedules per project',
    statusField: 'status', statuses: 'draft | active | completed',
    fields: ['id', 'project_id', 'estimate_id', 'status', 'admin_approved', 'total_amount', 'milestones', 'notes', 'created_date'],
  },

  // PEOPLE & PAYROLL
  get_payroll_approvals: {
    entity: 'PayrollApproval', perm: 'can_approve_payroll', cat: 'PEOPLE & PAYROLL', limit: 20,
    desc: 'Weekly payroll submissions: week range, who submitted, approval status and remarks',
    statusField: 'status', statuses: 'pending | approved | approved_with_remarks',
    fields: ['id', 'week_start', 'week_end', 'superintendent_name', 'superintendent_email', 'status', 'approved_at', 'remarks', 'employee_remarks', 'report_sent_at', 'created_date'],
  },
  get_time_entries: {
    entity: 'TimeEntry', perm: 'can_access_field_crew', cat: 'PEOPLE & PAYROLL', limit: 100, sort: '-date',
    desc: 'Crew time clock entries (the cost tracker): who worked, where, and for how long',
    statusField: 'status', statuses: 'clocked_in | on_break | clocked_out',
    fields: ['id', 'user_name', 'user_email', 'project_id', 'project_name', 'date', 'clock_in', 'clock_out', 'total_minutes', 'status', 'notes'],
  },
  get_time_off: {
    entity: 'TimeOffRequest', perm: 'can_access_field_crew', cat: 'PEOPLE & PAYROLL', limit: 30,
    desc: 'Time off and unavailability requests',
    statusField: 'status', statuses: 'pending | approved | denied',
    fields: ['id', 'user_name', 'request_type', 'leave_type', 'start_date', 'end_date', 'dates', 'reason', 'status', 'reviewed_by', 'admin_notes', 'created_date'],
  },
  get_team_members: {
    entity: 'AdminUser', perm: 'can_access_team', cat: 'PEOPLE & PAYROLL', limit: 50,
    desc: 'Backend team accounts: role, active status, and area access flags',
    fields: ['id', 'name', 'email', 'role', 'active', 'can_access_leads', 'can_access_estimates', 'can_access_invoices', 'can_access_blog', 'can_access_cms', 'can_access_seo', 'can_access_team', 'can_access_tracking', 'can_access_field_crew', 'can_approve_payroll', 'notes'],
  },
  get_onboarding_packets: {
    entity: 'EmployeeOnboarding', perm: 'can_access_team', cat: 'PEOPLE & PAYROLL', limit: 30,
    desc: 'Hire packet progress (W-2/1099). Form contents, IDs, and signatures are never exposed here — review those on the Onboarding Packets page',
    statusField: 'status', statuses: 'sent | in_progress | submitted | approved | changes_requested',
    fields: ['id', 'full_name', 'email', 'phone', 'position', 'start_date', 'worker_type', 'status', 'submitted_at', 'reviewed_by', 'review_notes', 'last_sent_at', 'created_date'],
  },

  // SUBS & VENDORS
  get_vendors: {
    entity: 'Vendor', perm: 'can_access_estimates', cat: 'SUBS & VENDORS', limit: 100,
    desc: 'Vendor/sub database: contacts, trade category, insurance compliance status',
    fields: ['id', 'company_name', 'contact_name', 'email', 'phone', 'category', 'active', 'is_subcontractor', 'insurance_status', 'workers_comp_expiry', 'liability_ins_expiry', 'packet_status', 'notes'],
  },
  get_sub_bids: {
    entity: 'SubBid', perm: 'can_access_estimates', cat: 'SUBS & VENDORS', limit: 50,
    desc: 'Subcontractor bid invites and replies with amounts and AI summaries',
    statusField: 'status', statuses: 'invited | viewed | submitted | selected | rejected',
    fields: ['id', 'project_id', 'vendor_company', 'vendor_name', 'vendor_email', 'trade', 'status', 'bid_amount', 'bid_notes', 'payment_terms', 'submitted_at', 'selected_at', 'ai_summary', 'source', 'created_date'],
  },

  // CONTENT
  get_blog_posts: {
    entity: 'BlogPost', perm: 'can_access_blog', cat: 'CONTENT', limit: 20,
    desc: 'Website blog posts',
    fields: ['id', 'title', 'slug', 'category', 'published', 'read_time', 'created_date'],
  },
  get_seo_audits: {
    entity: 'SeoAudit', perm: 'can_access_seo', cat: 'CONTENT', limit: 20,
    desc: 'SEO audit results per website page with scores and suggested titles',
    statusField: 'status', statuses: 'pending | analyzed | applied',
    fields: ['id', 'page', 'page_path', 'score', 'local_score', 'trust_score', 'lead_gen_score', 'status', 'suggested_title', 'created_date'],
  },
};

// Tools with custom logic (cross-entity rollups and external integrations).
const CUSTOM_TOOLS = {
  get_project_financials: {
    perm: 'can_access_estimates', cat: 'MONEY',
    usage: `{"tool": "get_project_financials", "args": {"project_id": "<id>"}}
  - The full money picture for ONE project: estimates and change orders, vendor invoices, sub payables, purchase and field receipts, and labor hours from time entries. Slices outside the user's access are marked excluded. Use get_projects first to find the project_id.`,
  },
  gmail_search: {
    perm: null, cat: 'INTEGRATIONS',
    usage: `{"tool": "gmail_search", "args": {"query": "subject:invoice from:vendor@example.com", "max_results": 5}}
  - query: Gmail search string (e.g. "from:someone@example.com", "subject:urgent", "has:attachment")
  - max_results: number of emails (default 5, max 10)
  - Only available if user has connected Staff AI Gmail`,
  },
  calendar_events: {
    perm: null, cat: 'INTEGRATIONS',
    usage: `{"tool": "calendar_events", "args": {"days_ahead": 7}}
  - days_ahead: show upcoming events for next N days (default 7)
  - Only available if user has connected Staff AI Calendar`,
  },
};

function sourceUsage(name, def) {
  const argBits = [`"limit": ${def.limit || 50}`];
  if (def.statusField) argBits.push('"status": null');
  const filterByProject = def.fields.includes('project_id');
  if (filterByProject) argBits.push('"project_id": null');
  let usage = `{"tool": "${name}", "args": {${argBits.join(', ')}}}\n  - ${def.desc}`;
  if (def.statusField) usage += `\n  - status: ${def.statuses} | null (all)`;
  if (filterByProject) usage += `\n  - project_id: limit to one project | null (all)`;
  return usage;
}

function buildToolsDescription(user) {
  const byCat = new Map();
  for (const [name, def] of Object.entries(DATA_SOURCES)) {
    if (!hasPerm(user, def.perm)) continue;
    if (!byCat.has(def.cat)) byCat.set(def.cat, []);
    byCat.get(def.cat).push(sourceUsage(name, def));
  }
  for (const [, def] of Object.entries(CUSTOM_TOOLS)) {
    if (!hasPerm(user, def.perm)) continue;
    if (!byCat.has(def.cat)) byCat.set(def.cat, []);
    byCat.get(def.cat).push(def.usage);
  }
  const sections = [...byCat.entries()].map(([cat, usages]) => `${cat}:\n\n${usages.join('\n\n')}`);
  return `
TOOL CALLING:
You have access to live data tools. When you need fresh or specific data, output ONLY a JSON object on its own line in this exact format:
{"tool": "<tool_name>", "args": {<args>}}

Available tools (these are the ONLY tools this user's access level allows — if a kind of data is not listed here, their role does not include it; explain that instead of attempting a call):

${sections.join('\n\n')}

IMPORTANT: Output the JSON tool call ONLY — nothing else on that line. After receiving tool results, use them to answer the user. You may use up to 5 tool calls per turn, and may repeat a tool with DIFFERENT args (e.g. a different status or project_id), never with the same args. Prefer the one most specific tool over several broad ones.
`;
}

// Strict field projection + payload trimming so tool results stay small enough
// for the model and never include unlisted (sensitive) fields.
function trimVal(value, depth = 0) {
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 297)}...` : value;
  if (Array.isArray(value)) return value.slice(0, 10).map(v => trimVal(v, depth + 1));
  if (value && typeof value === 'object') {
    if (depth >= 3) return '[object]';
    const out = {};
    for (const key of Object.keys(value).slice(0, 20)) out[key] = trimVal(value[key], depth + 1);
    return out;
  }
  return value;
}

function projectFields(record, fields, nested) {
  const out = {};
  for (const field of fields) {
    const value = record?.[field];
    if (value === undefined || value === null || value === '') continue;
    const subFields = nested?.[field];
    if (subFields && Array.isArray(value)) {
      out[field] = value.slice(0, 10).map(item => projectFields(item, subFields));
    } else {
      out[field] = trimVal(value);
    }
  }
  return out;
}

async function runDataSource(base44, def, args) {
  const limit = Math.min(Math.max(Number(args.limit) || def.limit || 50, 1), 200);
  const where = {};
  if (args.status && def.statusField) where[def.statusField] = String(args.status);
  if (args.project_id && def.fields.includes('project_id')) where.project_id = String(args.project_id);
  const entity = base44.asServiceRole.entities[def.entity];
  const rows = Object.keys(where).length
    ? await entity.filter(where, def.sort || '-created_date', limit)
    : await entity.list(def.sort || '-created_date', limit);
  const result = { count: rows.length, records: rows.map(r => projectFields(r, def.fields, def.nested)) };
  if (rows.length === limit) {
    result.note = `Result hit the limit of ${limit} — more records may exist. Call again with a higher limit if completeness matters.`;
  }
  return result;
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
  const def = DATA_SOURCES[toolName] || CUSTOM_TOOLS[toolName];
  if (!def) return { error: `Unknown tool: ${toolName}` };
  if (!hasPerm(user, def.perm)) {
    return {
      error: `Access denied: this user's role (${ROLE_LABELS[user?.role] || user?.role}) does not include ${PERM_LABELS[def.perm] || def.perm}. Do not retry. Explain that this data is outside their access level and that an Admin can grant it under Employees, then Team Access & Roles.`,
    };
  }
  if (DATA_SOURCES[toolName]) {
    try {
      return await runDataSource(base44, DATA_SOURCES[toolName], args || {});
    } catch (err) {
      return { error: `Data fetch failed: ${err.message}` };
    }
  }
  switch (toolName) {
    case 'get_project_financials': {
      const pid = String(args.project_id || '').trim();
      if (!pid) return { error: 'project_id is required. Use get_projects to find the project first.' };
      const sr = base44.asServiceRole.entities;
      const out = { project_id: pid };
      const project = (await sr.ContractorProject.filter({ id: pid }).catch(() => []))[0];
      if (!project) return { error: `No project found with id ${pid}. Use get_projects to find the right id.` };
      out.project = projectFields(project, DATA_SOURCES.get_projects.fields);
      const estimates = await sr.Estimate.filter({ project_id: pid }).catch(() => []);
      out.estimates = estimates.map(e => projectFields(e, DATA_SOURCES.get_estimates.fields));
      out.approved_estimate_total = estimates.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.grand_total || 0), 0);
      const purchases = await sr.PurchaseReceipt.filter({ project_id: pid }).catch(() => []);
      out.purchase_receipts = purchases.map(p => projectFields(p, DATA_SOURCES.get_purchase_receipts.fields));
      out.purchase_receipt_total = purchases.reduce((s, p) => s + Number(p.grand_total || 0), 0);
      if (hasPerm(user, 'can_access_invoices')) {
        const invoices = await sr.InvoiceRecord.filter({ project_id: pid }).catch(() => []);
        out.vendor_invoices = invoices.map(i => projectFields(i, DATA_SOURCES.get_invoices.fields));
        out.vendor_invoice_total = invoices.filter(i => i.status !== 'rejected').reduce((s, i) => s + Number(i.amount || 0), 0);
        const payables = await sr.SubPayable.filter({ project_id: pid }).catch(() => []);
        out.sub_payables = payables.map(p => projectFields(p, DATA_SOURCES.get_sub_payables.fields, DATA_SOURCES.get_sub_payables.nested));
        out.sub_contract_total = payables.reduce((s, p) => s + Number(p.contract_amount || 0), 0);
      } else {
        out.vendor_invoices = 'excluded (needs Invoice Inbox access)';
        out.sub_payables = 'excluded (needs Invoice Inbox access)';
      }
      if (hasPerm(user, 'can_access_field_crew')) {
        const entries = await sr.TimeEntry.filter({ project_id: pid }).catch(() => []);
        const minutes = entries.reduce((s, t) => s + Number(t.total_minutes || 0), 0);
        out.labor = { entries: entries.length, total_hours: Math.round(minutes / 6) / 10 };
        const fieldReceipts = await sr.FieldReceipt.filter({ project_id: pid }).catch(() => []);
        out.field_receipts = fieldReceipts.map(r => projectFields(r, DATA_SOURCES.get_field_receipts.fields));
        out.field_receipt_total = fieldReceipts.reduce((s, r) => s + Number(r.amount || 0), 0);
      } else {
        out.labor = 'excluded (needs Field Crew access)';
        out.field_receipts = 'excluded (needs Field Crew access)';
      }
      return out;
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
  if (hasPerm(user, 'can_approve_payroll')) {
    try {
      const payroll = await base44.asServiceRole.entities.PayrollApproval.list('-created_date', 10);
      context.payroll_snapshot = {
        recent_submissions: payroll.length,
        pending_approval: payroll.filter(p => p.status === 'pending').length,
      };
    } catch (_) {}
  }
  if (hasPerm(user, 'can_access_field_crew')) {
    try {
      const timeOff = await base44.asServiceRole.entities.TimeOffRequest.filter({ status: 'pending' });
      context.pending_time_off_requests = timeOff.length;
    } catch (_) {}
  }
  return context;
}

// Chat history is owner-scoped: the AiChat entity is RLS-locked, so all
// reads/writes come through here with user_email forced from the verified
// session — one user can never see or touch another's chats.
function sanitizeChatMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map(m => ({
    role: m?.role === 'user' ? 'user' : 'assistant',
    content: String(m?.content || '').slice(0, 20000),
    ...(Array.isArray(m?.tools_used) && m.tools_used.length
      ? { tools_used: m.tools_used.slice(0, 20).map(t => String(t).slice(0, 60)) }
      : {}),
  }));
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, undefined, body);

    if (body.action === 'listChats') {
      const chats = await base44.asServiceRole.entities.AiChat.filter(
        { user_email: user.email, is_archived: false }, '-created_date', 20,
      );
      return Response.json({
        chats: chats.map(c => ({ id: c.id, title: c.title, messages: c.messages || [], created_date: c.created_date })),
      });
    }

    if (body.action === 'saveChat') {
      const title = String(body.title || '').slice(0, 80) || `Chat ${new Date().toLocaleDateString('en-US')}`;
      const messages = sanitizeChatMessages(body.messages);
      if (body.chat_id) {
        const existing = (await base44.asServiceRole.entities.AiChat.filter({ id: String(body.chat_id) }))[0];
        if (!existing || existing.user_email !== user.email) throw new Error('Forbidden');
        await base44.asServiceRole.entities.AiChat.update(existing.id, { messages, title });
        return Response.json({ chat_id: existing.id });
      }
      const chat = await base44.asServiceRole.entities.AiChat.create({ user_email: user.email, title, messages });
      return Response.json({ chat_id: chat.id });
    }

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

    // Tool-calling loop (max 5 tool calls per turn; same tool may repeat with
    // different args, e.g. another status or project_id)
    const toolResults = [];
    const calledTools = new Set();
    let finalReply = '';
    let toolsUsed = [];

    for (let i = 0; i < 6; i++) {
      const conversationText = buildConversationText(messages, toolResults);
      const prompt = `${fullSystem}\n\n---\nCONVERSATION:\n${conversationText}\n\nAssistant:`;

      const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
      });

      const toolCall = parseToolCall(response);

      if (toolCall) {
        const callKey = `${toolCall.tool}:${JSON.stringify(toolCall.args || {})}`;
        // Out of tool budget or exact repeat — fall through to the forced
        // final answer below instead of letting raw tool JSON reach the user.
        if (calledTools.has(callKey) || toolResults.length >= 5) break;
        calledTools.add(callKey);
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
      // Fallback: force a final answer after the tool budget is spent
      const conversationText = buildConversationText(messages, toolResults);
      const prompt = `${fullSystem}\n\n---\nCONVERSATION:\n${conversationText}\n\n(You have used all available tool calls for this turn. Answer the user now using the tool results above — do NOT output another tool call.)\n\nAssistant:`;
      const forced = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: 'claude_sonnet_4_6' });
      // Last-resort guard: never ship a raw tool-call line to the user
      finalReply = String(forced).split('\n').filter(l => !l.trim().startsWith('{"tool":')).join('\n').trim()
        || 'I pulled the data but hit my tool limit for this message — ask me again and I will summarize it.';
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
