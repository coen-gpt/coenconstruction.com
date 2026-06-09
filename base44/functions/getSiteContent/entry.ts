import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return Response.json({ value: null });
    }

    const records = await base44.asServiceRole.entities.AppSettings.filter({ key });
    const value = records[0]?.value;

    if (value === undefined) {
      return Response.json({ value: null });
    }

    try {
      return Response.json({ value: JSON.parse(value), id: records[0].id });
    } catch {
      return Response.json({ value, id: records[0].id });
    }
  } catch {
    return Response.json({ value: null });
  }
});