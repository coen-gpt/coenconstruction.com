import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_cms', body);
    const { key } = body;
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });
    const records = await base44.asServiceRole.entities.AppSettings.filter({ key });
    const value = records[0]?.value;
    if (value === undefined) return Response.json({ value: null });
    try { return Response.json({ value: JSON.parse(value), id: records[0].id }); }
    catch { return Response.json({ value, id: records[0].id }); }
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error.message }, { status: 500 });
  }
});
