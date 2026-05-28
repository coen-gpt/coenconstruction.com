import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices');
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = await profileRes.json();

    if (profile.emailAddress) {
      return Response.json({ connected: true, email: profile.emailAddress });
    }
    return Response.json({ connected: false });
  } catch (error) {
    return Response.json({ connected: false, error: error.message });
  }
});
