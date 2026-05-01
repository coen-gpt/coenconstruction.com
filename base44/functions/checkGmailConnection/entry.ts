async function getGmailAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GMAIL_CLIENT_ID'),
      client_secret: Deno.env.get('GMAIL_CLIENT_SECRET'),
      refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || 'Failed to get access token');
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const accessToken = await getGmailAccessToken();
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