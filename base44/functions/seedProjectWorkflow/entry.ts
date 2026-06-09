/* eslint-disable */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
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

const COEN_STAGES = [
  { id: "lead",           name: "Lead",                color: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "walkthrough",    name: "Walkthrough",          color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { id: "approved_quote", name: "Approved Quote",       color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "new_project",    name: "New Project",          color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "pm_walkthrough", name: "PM Walkthrough",       color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "pre_construction","name": "Pre-Construction",  color: "bg-orange-100 text-orange-800 border-orange-200" },
  { id: "precon_checklist","name": "Pre-Con Checklist", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "scheduled",      name: "Scheduled",            color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "active",         name: "Active",               color: "bg-green-100 text-green-800 border-green-200" },
  { id: "work_progress",  name: "Work Progress",        color: "bg-teal-100 text-teal-800 border-teal-200" },
  { id: "completed",      name: "Completed",            color: "bg-gray-100 text-gray-800 border-gray-200" },
];

// Per job-type default precon checklists
const PRECON_DEFAULTS = {
  "Home Addition": {
    materials: [
      { id: "mat_lumber", label: "Lumber & framing materials ordered", done: false, notes: "" },
      { id: "mat_foundation", label: "Foundation materials (concrete, rebar)", done: false, notes: "" },
      { id: "mat_windows", label: "Windows & exterior doors ordered", done: false, notes: "" },
      { id: "mat_roofing", label: "Roofing shingles & underlayment", done: false, notes: "" },
      { id: "mat_insulation", label: "Insulation", done: false, notes: "" },
      { id: "mat_drywall", label: "Drywall", done: false, notes: "" },
      { id: "mat_electrical", label: "Electrical rough-in materials", done: false, notes: "" },
      { id: "mat_plumbing", label: "Plumbing rough-in materials", done: false, notes: "" },
    ],
    subs: [
      { id: "sub_excavation", label: "Excavation/foundation sub scheduled", done: false, notes: "", trade: "Foundation" },
      { id: "sub_electrical", label: "Electrical sub scheduled", done: false, notes: "", trade: "Electrical" },
      { id: "sub_plumbing", label: "Plumbing sub scheduled", done: false, notes: "", trade: "Plumbing" },
      { id: "sub_hvac", label: "HVAC sub scheduled", done: false, notes: "", trade: "HVAC" },
    ],
    general: [
      { id: "gen_permits", label: "Building permit pulled", done: false, notes: "" },
      { id: "gen_deposit", label: "Deposit received from client", done: false, notes: "" },
      { id: "gen_digsafe", label: "Dig Safe / utility locates called", done: false, notes: "" },
      { id: "gen_dumpster", label: "Dumpster arranged", done: false, notes: "" },
      { id: "gen_survey", label: "Property survey / setbacks verified", done: false, notes: "" },
      { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    ],
  },
  "Kitchen Remodel": {
    materials: [
      { id: "mat_cabinets", label: "Cabinets ordered (lead time!)", done: false, notes: "" },
      { id: "mat_counters", label: "Countertops templated & ordered", done: false, notes: "" },
      { id: "mat_flooring", label: "Flooring ordered", done: false, notes: "" },
      { id: "mat_tile", label: "Backsplash tile ordered", done: false, notes: "" },
      { id: "mat_fixtures", label: "Plumbing fixtures (sink, faucet)", done: false, notes: "" },
      { id: "mat_appliances", label: "Appliances ordered / delivery confirmed", done: false, notes: "" },
      { id: "mat_lighting", label: "Lighting fixtures selected", done: false, notes: "" },
    ],
    subs: [
      { id: "sub_electrical", label: "Electrician scheduled (panel, circuits)", done: false, notes: "", trade: "Electrical" },
      { id: "sub_plumbing", label: "Plumber scheduled", done: false, notes: "", trade: "Plumbing" },
      { id: "sub_counters", label: "Counter installer confirmed", done: false, notes: "", trade: "Countertops" },
    ],
    general: [
      { id: "gen_permits", label: "Permits pulled (elec/plumbing)", done: false, notes: "" },
      { id: "gen_deposit", label: "Deposit received", done: false, notes: "" },
      { id: "gen_demo_plan", label: "Demo scope confirmed with client", done: false, notes: "" },
      { id: "gen_storage", label: "Temporary kitchen / storage plan", done: false, notes: "" },
      { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    ],
  },
  "Bathroom Remodel": {
    materials: [
      { id: "mat_tile", label: "Floor & wall tile ordered", done: false, notes: "" },
      { id: "mat_vanity", label: "Vanity ordered", done: false, notes: "" },
      { id: "mat_fixtures", label: "Plumbing fixtures (toilet, faucet, shower)", done: false, notes: "" },
      { id: "mat_shower", label: "Shower pan / enclosure ordered", done: false, notes: "" },
      { id: "mat_lighting", label: "Lighting & exhaust fan", done: false, notes: "" },
      { id: "mat_drywall", label: "Cement board / moisture-resistant drywall", done: false, notes: "" },
    ],
    subs: [
      { id: "sub_plumbing", label: "Plumber scheduled", done: false, notes: "", trade: "Plumbing" },
      { id: "sub_electrical", label: "Electrician scheduled (GFCI, exhaust)", done: false, notes: "", trade: "Electrical" },
      { id: "sub_tile", label: "Tile setter confirmed (if sub)", done: false, notes: "", trade: "Tile" },
    ],
    general: [
      { id: "gen_permits", label: "Permits pulled", done: false, notes: "" },
      { id: "gen_deposit", label: "Deposit received", done: false, notes: "" },
      { id: "gen_demo_plan", label: "Demo scope confirmed", done: false, notes: "" },
      { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    ],
  },
  "Deck / Porch / Pergola": {
    materials: [
      { id: "mat_lumber", label: "Deck lumber / composite ordered", done: false, notes: "" },
      { id: "mat_hardware", label: "Structural hardware (joist hangers, bolts)", done: false, notes: "" },
      { id: "mat_footings", label: "Concrete / footings materials", done: false, notes: "" },
      { id: "mat_railing", label: "Railing system ordered", done: false, notes: "" },
      { id: "mat_ledger", label: "Ledger / flashing materials", done: false, notes: "" },
    ],
    subs: [
      { id: "sub_electrical", label: "Electrician scheduled (if lighting)", done: false, notes: "", trade: "Electrical" },
    ],
    general: [
      { id: "gen_permits", label: "Building permit pulled", done: false, notes: "" },
      { id: "gen_deposit", label: "Deposit received", done: false, notes: "" },
      { id: "gen_digsafe", label: "Dig Safe called", done: false, notes: "" },
      { id: "gen_setbacks", label: "Setbacks / HOA approval confirmed", done: false, notes: "" },
      { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    ],
  },
  "Siding": {
    materials: [
      { id: "mat_siding", label: "Siding materials ordered (style/color confirmed)", done: false, notes: "" },
      { id: "mat_wrap", label: "House wrap / moisture barrier", done: false, notes: "" },
      { id: "mat_trim", label: "Trim boards & corner pieces", done: false, notes: "" },
      { id: "mat_caulk", label: "Caulk, nails, flashing", done: false, notes: "" },
    ],
    subs: [],
    general: [
      { id: "gen_permits", label: "Permits (if required by town)", done: false, notes: "" },
      { id: "gen_deposit", label: "Deposit received", done: false, notes: "" },
      { id: "gen_dumpster", label: "Dumpster arranged (for old siding)", done: false, notes: "" },
      { id: "gen_color_approval", label: "Color selection signed off by client", done: false, notes: "" },
      { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    ],
  },
  "Roofing": {
    materials: [
      { id: "mat_shingles", label: "Shingles ordered (style/color confirmed)", done: false, notes: "" },
      { id: "mat_underlayment", label: "Underlayment & ice & water shield", done: false, notes: "" },
      { id: "mat_decking", label: "Decking replacement boards (if needed)", done: false, notes: "" },
      { id: "mat_flashing", label: "Flashing, drip edge, ridge cap", done: false, notes: "" },
      { id: "mat_ventilation", label: "Ridge / soffit ventilation", done: false, notes: "" },
    ],
    subs: [],
    general: [
      { id: "gen_permits", label: "Roofing permit pulled", done: false, notes: "" },
      { id: "gen_deposit", label: "Deposit received", done: false, notes: "" },
      { id: "gen_dumpster", label: "Dumpster / shingle disposal arranged", done: false, notes: "" },
      { id: "gen_weather", label: "Weather window confirmed", done: false, notes: "" },
      { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    ],
  },
  "Full Home Renovation": {
    materials: [
      { id: "mat_lumber", label: "Structural lumber", done: false, notes: "" },
      { id: "mat_windows", label: "Windows & exterior doors", done: false, notes: "" },
      { id: "mat_roofing", label: "Roofing materials", done: false, notes: "" },
      { id: "mat_siding", label: "Siding / exterior finishes", done: false, notes: "" },
      { id: "mat_insulation", label: "Insulation", done: false, notes: "" },
      { id: "mat_drywall", label: "Drywall", done: false, notes: "" },
      { id: "mat_flooring", label: "Flooring", done: false, notes: "" },
      { id: "mat_cabinets", label: "Cabinets & millwork", done: false, notes: "" },
      { id: "mat_counters", label: "Countertops", done: false, notes: "" },
    ],
    subs: [
      { id: "sub_electrical", label: "Electrical sub scheduled", done: false, notes: "", trade: "Electrical" },
      { id: "sub_plumbing", label: "Plumbing sub scheduled", done: false, notes: "", trade: "Plumbing" },
      { id: "sub_hvac", label: "HVAC sub scheduled", done: false, notes: "", trade: "HVAC" },
      { id: "sub_roofing", label: "Roofing crew confirmed", done: false, notes: "", trade: "Roofing" },
    ],
    general: [
      { id: "gen_permits", label: "All permits pulled (building, elec, plumbing, HVAC)", done: false, notes: "" },
      { id: "gen_deposit", label: "Deposit received", done: false, notes: "" },
      { id: "gen_digsafe", label: "Dig Safe called", done: false, notes: "" },
      { id: "gen_dumpster", label: "Dumpsters arranged (phased)", done: false, notes: "" },
      { id: "gen_temporary_living", label: "Client temporary living arrangements confirmed", done: false, notes: "" },
      { id: "gen_utility_shutoffs", label: "Utility shutoffs planned", done: false, notes: "" },
      { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    ],
  },
};

// Default fallback
const DEFAULT_CHECKLIST = {
  materials: [
    { id: "mat_lumber", label: "Lumber / framing materials", done: false, notes: "" },
    { id: "mat_windows", label: "Windows & doors ordered", done: false, notes: "" },
    { id: "mat_drywall", label: "Drywall", done: false, notes: "" },
    { id: "mat_flooring", label: "Flooring", done: false, notes: "" },
    { id: "mat_paint", label: "Paint & finishes", done: false, notes: "" },
  ],
  subs: [
    { id: "sub_electrical", label: "Electrical sub scheduled", done: false, notes: "", trade: "Electrical" },
    { id: "sub_plumbing", label: "Plumbing sub scheduled", done: false, notes: "", trade: "Plumbing" },
  ],
  general: [
    { id: "gen_permits", label: "Permits applied / pulled", done: false, notes: "" },
    { id: "gen_deposit", label: "Deposit received from client", done: false, notes: "" },
    { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    { id: "gen_digsafe", label: "Dig Safe / utility locates called", done: false, notes: "" },
    { id: "gen_dumpster", label: "Dumpster / debris removal arranged", done: false, notes: "" },
  ],
};

function getChecklistForType(projectType) {
  return PRECON_DEFAULTS[projectType] || DEFAULT_CHECKLIST;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    // Support both direct invocation (project_id) and entity automation event (event.entity_id)
    const project_id = body.project_id || body.event?.entity_id || body.data?.id;
    const force = body.force || false;

    if (!project_id) {
      return Response.json({ error: "project_id required" }, { status: 400 });
    }

    // Load project
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    const updates = {};

    // Seed workflow_stages if empty or force
    if (!project.workflow_stages?.length || force) {
      updates.workflow_stages = COEN_STAGES.map(s => ({ ...s, milestones: [] }));
    }

    // Seed precon_checklist if null or force
    if (!project.precon_checklist || force) {
      updates.precon_checklist = getChecklistForType(project.project_type);
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: true, message: "Already seeded — no changes needed" });
    }

    await base44.asServiceRole.entities.ContractorProject.update(project_id, updates);

    return Response.json({ ok: true, seeded: Object.keys(updates), projectType: project.project_type });
  } catch (err) {
    const status = err.message === 'Forbidden' ? 403 : err.message.includes('Unauthorized') || err.message.includes('expired') ? 401 : 500;
    return Response.json({ error: err.message }, { status });
  }
});