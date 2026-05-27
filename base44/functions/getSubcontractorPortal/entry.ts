import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // No auth required - token-based access
    const { token, project_id } = await req.json();

    if (!token || !project_id) {
      return Response.json({ error: 'Missing token or project_id' }, { status: 400 });
    }

    // Fetch project
    const project = await base44.entities.ContractorProject.get(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find assignment by token
    const assignments = project.subcontractor_assignments || [];
    const assignment = assignments.find(a => a.token === token);
    
    if (!assignment) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 403 });
    }

    // Check expiry
    if (new Date(assignment.token_expires) < new Date()) {
      return Response.json({ error: 'Token expired' }, { status: 403 });
    }

    // Find milestone
    const allMilestones = (project.workflow_stages || []).flatMap(s => s.milestones || []);
    const milestone = allMilestones.find(m => m.id === assignment.milestone_id);
    
    if (!milestone) {
      return Response.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return Response.json({
      project: {
        id: project.id,
        client_name: project.client_name,
        client_address: project.client_address,
        client_city: project.client_city,
        status: project.status,
      },
      milestone: {
        id: milestone.id,
        label: milestone.label,
        done: milestone.done,
        due_date: milestone.due_date,
      },
      assignment: {
        id: assignment.id,
        status: assignment.status,
        started_at: assignment.started_at,
        completed_at: assignment.completed_at,
        notes: assignment.notes,
      },
    });

  } catch (error) {
    console.error('Error fetching subcontractor portal data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});