import { verifyAdminSession } from '../_shared/adminSession.ts';

function isValidEmailList(to: string) {
  return String(to || '')
    .split(/[;,]/)
    .map(v => v.trim())
    .filter(Boolean)
    .every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    const { to, subject, body: html, from_email } = body;
    if (!to || !isValidEmailList(to)) return Response.json({ error: 'A valid recipient email is required' }, { status: 400 });
    if (!subject) return Response.json({ error: 'subject is required' }, { status: 400 });
    if (!html) return Response.json({ error: 'body is required' }, { status: 400 });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject,
      body: html,
      from_name: 'Coen Construction',
      reply_to: from_email || 'bids@coenconstruction.com',
    });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error.message }, { status: 500 });
  }
});
