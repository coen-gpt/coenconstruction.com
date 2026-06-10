import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Emails the requester when their time-off request is approved or denied.
 * Accepts only a request_id and emails only the address ON that request with
 * its CURRENT status — no caller-controlled content, so it's safe to expose.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { request_id } = await req.json();
    if (!request_id) return Response.json({ error: 'request_id required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.TimeOffRequest.filter({ id: request_id });
    const request = rows[0];
    if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (!request.user_email || !['approved', 'denied'].includes(request.status)) {
      return Response.json({ skipped: true });
    }

    const approved = request.status === 'approved';
    const range = request.start_date === request.end_date
      ? request.start_date
      : `${request.start_date} – ${request.end_date}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: request.user_email,
      subject: approved
        ? `✅ Time off approved: ${range}`
        : `Time off request update: ${range}`,
      body: [
        `Hi ${request.user_name || 'there'},`,
        '',
        approved
          ? `Your time-off request for ${range} has been APPROVED. Enjoy!`
          : `Your time-off request for ${range} was not approved.`,
        request.admin_notes ? `\nNote from the office: ${request.admin_notes}` : '',
        '',
        'Questions? Reply to this email or call the office.',
        '',
        'Coen Construction LLC',
      ].join('\n'),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
