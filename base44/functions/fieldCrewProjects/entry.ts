import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Field-crew access to projects. ContractorProject is RLS-locked, and the
// field crew app authenticates as a Base44 user (base44.auth.me) — not an
// AdminUser session — so it reads in-progress projects and updates the
// material checklist through this function with the service role.

function stripProject(p) {
  if (!p) return p;
  // Field crew don't need the customer's signed-approval token
  const { approval_token, ...rest } = p;
  return rest;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'list') {
      const projects = await base44.asServiceRole.entities.ContractorProject.filter({ status: 'in_progress' });
      return Response.json({ projects: projects.map(stripProject) });
    }

    if (action === 'get') {
      if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
      const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: body.id });
      return Response.json({ project: stripProject(projects[0] || null) });
    }

    if (action === 'updateChecklist') {
      if (!body.id || !Array.isArray(body.material_checklist)) {
        return Response.json({ error: 'id and material_checklist required' }, { status: 400 });
      }
      const updated = await base44.asServiceRole.entities.ContractorProject.update(body.id, {
        material_checklist: body.material_checklist,
      });
      return Response.json({ project: stripProject(updated) });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
