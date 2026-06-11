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

// Generic admin data proxy for RLS-locked entities. The admin backend
// authenticates with custom AdminUser sessions (not Base44 users), so it
// can't satisfy entity RLS directly — it reads/writes through this function,
// which runs with the service role after verifying the admin session and the
// per-entity permission. Only whitelisted entities/operations are allowed.
const ENTITY_PERMS = {
  Lead: 'can_access_leads',
  CustomerPortal: 'can_access_estimates',
  ContractorProject: 'can_access_estimates',
  Vendor: 'can_access_estimates',
  TimeEntry: 'can_access_field_crew',
  FieldTask: 'can_access_field_crew',
  FieldReceipt: 'can_access_field_crew',
  EquipmentItem: 'can_access_field_crew',
  EquipmentCheckout: 'can_access_field_crew',
  TimeOffRequest: 'can_access_field_crew',
  CrewAssignment: 'can_access_field_crew',
  AdminUser: 'can_access_field_crew',
};

// AdminUser is exposed read-only and trimmed to what the task-assignment
// dropdown needs — never password hashes or reset tokens.
const READ_ONLY_ENTITIES = new Set(['AdminUser']);
const stripUser = (u) => ({ id: u.id, email: u.email, name: u.name, full_name: u.name, role: u.role, active: u.active });

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { entity, op } = body;
    const permission = ENTITY_PERMS[entity];
    if (!permission) return Response.json({ error: `Entity '${entity}' is not available through this proxy` }, { status: 400 });

    const { base44 } = await verifyAdminSession(req, permission, body);
    const repo = base44.asServiceRole.entities[entity];

    if (READ_ONLY_ENTITIES.has(entity) && op !== 'list' && op !== 'filter') {
      return Response.json({ error: `Entity '${entity}' is read-only through this proxy` }, { status: 403 });
    }

    let result;
    if (op === 'list') {
      result = await repo.list(body.sort ?? undefined, body.limit ?? undefined);
    } else if (op === 'filter') {
      result = await repo.filter(body.query || {}, body.sort ?? undefined, body.limit ?? undefined);
    } else if (op === 'create') {
      result = await repo.create(body.data || {});
    } else if (op === 'update') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      result = await repo.update(body.id, body.data || {});
    } else if (op === 'delete') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      result = await repo.delete(body.id);
    } else {
      return Response.json({ error: `Unknown op '${op}'` }, { status: 400 });
    }

    if (entity === 'AdminUser' && Array.isArray(result)) result = result.map(stripUser);

    return Response.json({ result });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
