import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns all projects + assignments for a subcontractor identified by their task token.
// Also returns their vendor record (compliance / onboarding status).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    // Scan all projects for any assignment matching this token
    let skip = 0;
    const limit = 100;
    const matchedProjects = [];
    let subEmail = null;
    let subName = null;
    let subPhone = null;

    while (true) {
      const batch = await base44.asServiceRole.entities.ContractorProject.list('-updated_date', limit, skip);
      if (!batch || batch.length === 0) break;

      for (const project of batch) {
        const assignments = project.subcontractor_assignments || [];
        const match = assignments.find(a => a.token === token);
        if (match) {
          // Grab sub identity from the first match
          if (!subEmail) {
            subEmail = match.subcontractor_email;
            subName = match.subcontractor_name;
            subPhone = match.subcontractor_phone;
          }

          const allMilestones = (project.workflow_stages || []).flatMap(s => s.milestones || []);
          const milestone = allMilestones.find(m => m.id === match.milestone_id);

          matchedProjects.push({
            project: {
              id: project.id,
              client_name: project.client_name,
              client_address: project.client_address,
              client_city: project.client_city,
              client_zipcode: project.client_zipcode,
              project_type: project.project_type,
              status: project.status,
            },
            milestone: milestone ? {
              id: milestone.id,
              label: milestone.label,
              done: milestone.done,
              due_date: milestone.due_date,
            } : null,
            assignment: {
              id: match.id,
              token: match.token,
              status: match.status,
              started_at: match.started_at,
              completed_at: match.completed_at,
              notes: match.notes,
              assigned_at: match.assigned_at,
            },
          });
        }
      }

      if (batch.length < limit) break;
      skip += limit;
    }

    if (matchedProjects.length === 0) {
      return Response.json({ error: 'No assignments found for this token' }, { status: 404 });
    }

    // Also now scan all other projects for this sub's email to get their full history
    if (subEmail) {
      let skip2 = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.ContractorProject.list('-updated_date', limit, skip2);
        if (!batch || batch.length === 0) break;

        for (const project of batch) {
          const assignments = project.subcontractor_assignments || [];
          // Find assignments for this sub that aren't already in matchedProjects via token
          for (const a of assignments) {
            if (a.subcontractor_email === subEmail && a.token !== token) {
              const allMilestones = (project.workflow_stages || []).flatMap(s => s.milestones || []);
              const milestone = allMilestones.find(m => m.id === a.milestone_id);
              // Check not already added
              const alreadyAdded = matchedProjects.some(mp => mp.project.id === project.id && mp.assignment.id === a.id);
              if (!alreadyAdded) {
                matchedProjects.push({
                  project: {
                    id: project.id,
                    client_name: project.client_name,
                    client_address: project.client_address,
                    client_city: project.client_city,
                    client_zipcode: project.client_zipcode,
                    project_type: project.project_type,
                    status: project.status,
                  },
                  milestone: milestone ? {
                    id: milestone.id,
                    label: milestone.label,
                    done: milestone.done,
                    due_date: milestone.due_date,
                  } : null,
                  assignment: {
                    id: a.id,
                    token: a.token,
                    status: a.status,
                    started_at: a.started_at,
                    completed_at: a.completed_at,
                    notes: a.notes,
                    assigned_at: a.assigned_at,
                  },
                });
              }
            }
          }
        }

        if (batch.length < limit) break;
        skip2 += limit;
      }
    }

    // Look up vendor record by email
    let vendor = null;
    if (subEmail) {
      const vendors = await base44.asServiceRole.entities.Vendor.filter({ email: subEmail });
      if (vendors && vendors.length > 0) {
        const v = vendors[0];
        vendor = {
          id: v.id,
          company_name: v.company_name,
          contact_name: v.contact_name,
          email: v.email,
          phone: v.phone,
          packet_status: v.packet_status,
          insurance_status: v.insurance_status,
          workers_comp_expiry: v.workers_comp_expiry,
          liability_ins_expiry: v.liability_ins_expiry,
          workers_comp_url: v.workers_comp_url,
          liability_ins_url: v.liability_ins_url,
          w9_url: v.w9_url,
          packet_signed_at: v.packet_signed_at,
        };
      }
    }

    // Sort: active first, then pending, then complete
    const statusOrder = { in_progress: 0, pending: 1, complete: 2 };
    matchedProjects.sort((a, b) => (statusOrder[a.assignment.status] ?? 3) - (statusOrder[b.assignment.status] ?? 3));

    return Response.json({
      sub_name: subName,
      sub_email: subEmail,
      sub_phone: subPhone,
      vendor,
      assignments: matchedProjects,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});