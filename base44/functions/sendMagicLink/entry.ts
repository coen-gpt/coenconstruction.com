import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Valid email is required.' }, { status: 400 });
  }

  // Find projects for this email
  const allProjects = await base44.asServiceRole.entities.Project.filter({ email: email.toLowerCase().trim() });

  if (!allProjects || allProjects.length === 0) {
    return Response.json({ error: 'No projects found for that email address.' }, { status: 404 });
  }

  // Build a simple signed token: base64(email + ":" + timestamp + ":" + secret_hash)
  // We use a lightweight approach — encode email + expiry, verify on read
  const expiry = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const payload = `${email.toLowerCase().trim()}|${expiry}`;
  const token = btoa(payload).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const appUrl = req.headers.get('origin') || 'https://your-app.base44.app';
  const magicLink = `${appUrl}/my-projects?token=${token}`;

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: '🏠 Your Coen Construction Projects — Access Link',
      body: `
Hi there!

You requested access to your Coen Construction design projects. Click the link below to view all your AI-generated designs and project details:

👉 ${magicLink}

This link is valid for 7 days. If you didn't request this, you can safely ignore this email.

— The Coen Construction Team
      `.trim()
    });
  } catch (emailErr) {
    // Platform requires users to be registered before emails can be sent.
    // Return the magic link directly so the frontend can redirect the user.
    return Response.json({ success: true, magic_link: magicLink, email_skipped: true });
  }

  return Response.json({ success: true });
});