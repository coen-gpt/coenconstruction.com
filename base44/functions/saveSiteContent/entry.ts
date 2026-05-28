import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_cms', body);
    const { key, value } = body;
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key });
    const record = existing.length
      ? await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { key, value: stringVal })
      : await base44.asServiceRole.entities.AppSettings.create({ key, value: stringVal });
    return Response.json({ success: true, record });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error.message }, { status: 500 });
  }
});
