import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
  if (!data.access_token) throw new Error(data.error_description || 'Failed to get Gmail access token');
  return data.access_token;
}

function getAttachments(payload) {
  const attachments = [];
  function scan(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        const ext = part.filename.toLowerCase();
        if (ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx') ||
            ext.endsWith('.xls') || ext.endsWith('.xlsx') || ext.endsWith('.png') ||
            ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
          attachments.push({ name: part.filename, id: part.body?.attachmentId });
        }
      }
      if (part.parts) scan(part.parts);
    }
  }
  scan(payload.parts);
  return attachments;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = await getGmailAccessToken();
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 20;

    // Fetch all records that have attachment_names but empty/missing attachment_urls
    const allRecords = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', 500);
    const needsSync = allRecords.filter(r =>
      r.attachment_names?.length > 0 &&
      (!r.attachment_urls || r.attachment_urls.length === 0 || r.attachment_urls.some(u => !u))
    ).slice(0, batchSize);

    let updated = 0;
    let failed = 0;

    for (const record of needsSync) {
      if (!record.gmail_message_id) { failed++; continue; }

      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${record.gmail_message_id}?format=full`,
          { headers: authHeader }
        );
        if (!msgRes.ok) { failed++; continue; }
        const message = await msgRes.json();

        const attachments = getAttachments(message.payload);
        if (attachments.length === 0) { failed++; continue; }

        const attachmentFileUrls = [];
        for (const att of attachments.slice(0, 3)) {
          if (!att.id) continue;
          try {
            const attRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${record.gmail_message_id}/attachments/${att.id}`,
              { headers: authHeader }
            );
            if (!attRes.ok) continue;
            const attData = await attRes.json();
            if (!attData.data) continue;
            const binary = atob(attData.data.replace(/-/g, '+').replace(/_/g, '/'));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const ext = att.name.toLowerCase();
            const mime = ext.endsWith('.pdf') ? 'application/pdf' : ext.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const file = new File([bytes], att.name, { type: mime });
            const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            if (uploaded?.file_url) attachmentFileUrls.push(uploaded.file_url);
          } catch (_) {}
        }

        if (attachmentFileUrls.length > 0) {
          await base44.asServiceRole.entities.InvoiceRecord.update(record.id, {
            attachment_urls: attachmentFileUrls,
            attachment_names: attachments.slice(0, 3).map(a => a.name),
          });
          updated++;
        } else {
          failed++;
        }
      } catch (_) {
        failed++;
      }
    }

    return Response.json({ total: needsSync.length, updated, failed });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});