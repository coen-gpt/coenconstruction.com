import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
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