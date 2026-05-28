import { verifyAdminSession } from '../_shared/adminSession.ts';

// With the refresh token approach, "disconnecting" is not possible from the app.
// This endpoint just returns a message directing the admin to revoke access from Google.
Deno.serve(async (req) => {
  try {
    await verifyAdminSession(req, 'can_access_invoices');

    return Response.json({ 
      success: true, 
      message: 'To fully revoke Gmail access, visit https://myaccount.google.com/permissions and remove the app.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
