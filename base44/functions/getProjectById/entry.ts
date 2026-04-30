import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

    const project = await base44.asServiceRole.entities.Project.get(id);
    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});