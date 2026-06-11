import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Public endpoint for the /shared-design page. Possession of the project id
// (a capability URL the owner chose to share) is the credential, mirroring
// getProjectsByEmail. Returns only display-safe fields — never the owner's
// email/phone/name, since share links are forwarded to friends and family.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { id } = await req.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

    const project = await base44.asServiceRole.entities.Project.get(id).catch(() => null);
    if (!project) return Response.json({ project: null }, { status: 404 });

    const { id: projectId, project_type, project_description, address, ai_designs, before_photos, created_date } = project;
    return Response.json({
      project: { id: projectId, project_type, project_description, address, ai_designs, before_photos, created_date },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
