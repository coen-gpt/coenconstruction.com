import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { leadId } = await req.json();

    // Authenticate and verify admin role
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUsers = await base44.asServiceRole.entities.AdminUser.filter({ email: user.email, active: true });
    if (!adminUsers.length || adminUsers[0].role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Delete the lead
    await base44.asServiceRole.entities.Lead.delete(leadId);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});