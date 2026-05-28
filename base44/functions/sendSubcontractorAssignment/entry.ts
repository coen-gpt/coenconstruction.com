import { Resend } from 'npm:resend@2.1.0';
import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates');

    const { milestone_id, subcontractor_email, project_id, message } = await req.json();

    if (!milestone_id || !subcontractor_email || !project_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch project and milestone data
    const project = await base44.entities.ContractorProject.get(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find the milestone
    const allMilestones = (project.workflow_stages || []).flatMap(s => s.milestones || []);
    const milestone = allMilestones.find(m => m.id === milestone_id);
    if (!milestone) {
      return Response.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Generate secure token for subcontractor access
    const token = `sub_${milestone_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // Save subcontractor assignment
    const assignment = {
      id: `assign_${Date.now()}`,
      milestone_id: milestone_id,
      subcontractor_email,
      subcontractor_name: '',
      token,
      token_expires: expiresAt,
      assigned_at: new Date().toISOString(),
      assigned_by: user.email,
      status: 'pending', // pending, in_progress, complete
      started_at: null,
      completed_at: null,
      notes: '',
    };

    // Update project with subcontractor assignment
    const existingAssignments = project.subcontractor_assignments || [];
    const updatedAssignments = [...existingAssignments, assignment];
    await base44.entities.ContractorProject.update(project_id, {
      subcontractor_assignments: updatedAssignments
    });

    // Get company branding
    const companyProfiles = await base44.entities.CompanyProfile.list();
    const company = companyProfiles[0] || {
      company_name: 'Coen Construction',
      phone: '(781) 999-5400',
      brand_color: '#E35235',
    };

    // Generate portal link
    const portalUrl = `https://your-app.base44.app/subcontractor-portal?token=${token}&project=${project_id}`;

    // Send email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    await resend.emails.send({
      from: `${company.company_name} <noreply@${company.company_name.toLowerCase().replace(/\s+/g, '')}.com>`,
      to: subcontractor_email,
      subject: `Task Assignment: ${milestone.label} - ${project.client_name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1B2B3A; color: white; padding: 30px 20px; border-radius: 12px 12px 0 0; }
              .content { background: #f8f9fa; padding: 30px 20px; border: 1px solid #e9ecef; }
              .button { display: inline-block; background: #E35235; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .button:hover { background: #c94522; }
              .detail { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
              .value { font-size: 16px; font-weight: 600; margin-top: 5px; }
              .footer { background: white; padding: 20px; text-align: center; color: #666; font-size: 14px; border: 1px solid #e9ecef; border-radius: 0 0 12px 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">Task Assignment</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">${company.company_name}</p>
              </div>
              
              <div class="content">
                <p style="margin-top: 0;">Hi there,</p>
                
                <p>You've been assigned to complete the following task:</p>
                
                <div class="detail">
                  <div class="label">Task</div>
                  <div class="value">${milestone.label}</div>
                </div>
                
                <div class="detail">
                  <div class="label">Project</div>
                  <div class="value">${project.client_name}</div>
                  <div class="value" style="font-size: 14px; font-weight: 400; color: #666;">${project.client_address}${project.client_city ? `, ${project.client_city}` : ''}</div>
                </div>
                
                ${message ? `
                  <div class="detail">
                    <div class="label">Message from PM</div>
                    <div class="value" style="font-size: 14px; font-weight: 400;">${message}</div>
                  </div>
                ` : ''}
                
                <div style="text-align: center;">
                  <a href="${portalUrl}" class="button">View & Update Task</a>
                </div>
                
                <p><strong>What's next?</strong></p>
                <ol style="padding-left: 20px;">
                  <li>Click the button above to access your task portal</li>
                  <li>Review the task details</li>
                  <li>Mark as "In Progress" when you start</li>
                  <li>Mark as "Complete" when finished</li>
                </ol>
                
                <p style="margin-bottom: 0;">Questions? Reply to this email or call us at ${company.phone}.</p>
              </div>
              
              <div class="footer">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${company.company_name}. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return Response.json({
      success: true,
      assignment_id: assignment.id,
      portal_url: portalUrl,
    });

  } catch (error) {
    console.error('Error sending assignment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
