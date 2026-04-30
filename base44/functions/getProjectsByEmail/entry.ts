import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Fetch all projects as service role and filter by email in code
    // (avoids RLS/user-lookup issues with field-level filtering)
    const allProjects = await base44.asServiceRole.entities.Project.list('-created_date', 200);
    const projects = allProjects.filter(p => p.email?.toLowerCase().trim() === normalizedEmail);

    return Response.json({ projects });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});