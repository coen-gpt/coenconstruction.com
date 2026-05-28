import { verifyAdminSession } from '../_shared/adminSession.ts';

async function getAccessToken() {
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
  if (!data.access_token) throw new Error('Failed to get Gmail access token');
  return data.access_token;
}

function extractAttachmentMeta(payload, result = []) {
  if (!payload) return result;
  if (payload.filename && payload.filename.trim().length > 0 && payload.body?.attachmentId) {
    result.push({
      name: payload.filename,
      attachmentId: payload.body.attachmentId,
      mimeType: payload.mimeType || 'application/octet-stream',
      size: payload.body.size || 0,
    });
  }
  if (payload.parts) {
    for (const p of payload.parts) extractAttachmentMeta(p, result);
  }
  return result;
}

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_invoices');

    const body = await req.json().catch(() => ({}));
    const { messageId, attachmentIndex } = body;

    if (!messageId) return Response.json({ error: 'messageId required' }, { status: 400 });

    const accessToken = await getAccessToken();
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Fetch message to get attachment list
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: authHeader }
    );
    if (!msgRes.ok) return Response.json({ error: 'Failed to fetch message' }, { status: 500 });
    const message = await msgRes.json();

    const attachments = extractAttachmentMeta(message.payload);
    if (attachments.length === 0) return Response.json({ error: 'No attachments found' }, { status: 404 });

    const idx = attachmentIndex ?? 0;
    const att = attachments[idx];
    if (!att) return Response.json({ error: 'Attachment index out of range' }, { status: 404 });

    // Fetch attachment data
    const attRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${att.attachmentId}`,
      { headers: authHeader }
    );
    if (!attRes.ok) return Response.json({ error: 'Failed to fetch attachment' }, { status: 500 });
    const attData = await attRes.json();

    return Response.json({
      name: att.name,
      mimeType: att.mimeType,
      size: att.size,
      data: attData.data, // base64url encoded
      totalAttachments: attachments.length,
      attachmentList: attachments.map((a, i) => ({ index: i, name: a.name, mimeType: a.mimeType, size: a.size })),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
