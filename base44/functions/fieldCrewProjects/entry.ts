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
      const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: body.id });
      const project = projects[0];
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      if (project.status !== 'in_progress') {
        return Response.json({ error: 'Checklist can only be updated on active projects' }, { status: 403 });
      }

      // Merge ONLY the ordered/received tracking flags onto the existing
      // checklist — the client used to be able to replace (or wipe) the whole
      // list on any project it could name.
      const incoming = new Map(
        body.material_checklist
          .filter((i) => i && typeof i.id === 'string')
          .map((i) => [i.id, i])
      );
      const merged = (project.material_checklist || []).map((item) => {
        const u = incoming.get(item.id);
        if (!u) return item;
        return {
          ...item,
          ordered: !!u.ordered,
          ordered_at: typeof u.ordered_at === 'string' ? u.ordered_at : null,
          ordered_by: typeof u.ordered_by === 'string' ? u.ordered_by.slice(0, 120) : null,
          received: !!u.received,
          received_at: typeof u.received_at === 'string' ? u.received_at : null,
          received_by: typeof u.received_by === 'string' ? u.received_by.slice(0, 120) : null,
        };
      });

      const updated = await base44.asServiceRole.entities.ContractorProject.update(body.id, {
        material_checklist: merged,
      });
      return Response.json({ project: stripProject(updated) });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
