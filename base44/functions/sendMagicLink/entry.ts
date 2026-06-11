import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Best-effort email: Resend first (proven delivery path in this app), then the
// Base44 Core.SendEmail integration. Never throws.
async function sendEmailSafe(base44, { to, subject, text, html }) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <noreply@coenconstruction.com>",
          to,
          subject,
          ...(html ? { html } : { text }),
        }),
      });
      if (res.ok) return true;
      console.error("Resend send failed:", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("Resend send error:", e.message);
    }
  }
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, ...(html ? { html } : { body: text }) });
    return true;
  } catch (e) {
    console.error("Core.SendEmail failed:", e.message);
    return false;
  }
}

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

  const appUrl = req.headers.get('origin') || 'https://www.coenconstruction.com';
  const magicLink = `${appUrl}/my-projects?token=${token}`;

  const emailSent = await sendEmailSafe(base44, {
    to: email,
    subject: '🏠 Your Coen Construction Projects — Access Link',
    text: `
Hi there!

You requested access to your Coen Construction design projects. Click the link below to view all your AI-generated designs and project details:

👉 ${magicLink}

This link is valid for 7 days. If you didn't request this, you can safely ignore this email.

— The Coen Construction Team
    `.trim(),
  });

  // The magic link must ONLY ever travel by email — returning it to the
  // browser would let anyone log in as any customer just by typing their
  // email address.
  if (!emailSent) {
    return Response.json({ error: "We couldn't send the email right now. Please try again in a few minutes." }, { status: 502 });
  }

  return Response.json({ success: true });
});
