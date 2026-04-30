import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// With the refresh token approach, "disconnecting" is not possible from the app.
// This endpoint just returns a message directing the admin to revoke access from Google.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    return Response.json({ 
      success: true, 
      message: 'To fully revoke Gmail access, visit https://myaccount.google.com/permissions and remove the app.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});