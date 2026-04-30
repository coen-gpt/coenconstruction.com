import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { id, updates, action_note, gmail_message_id, user_email } = await req.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    // Fetch current record to append history
    const records = await base44.asServiceRole.entities.InvoiceRecord.filter({ id });
    if (!records.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const current = records[0];

    const historyEntry = {
      action: updates.status ? `status_changed_to_${updates.status}` : (updates.pinned !== undefined ? (updates.pinned ? 'pinned' : 'unpinned') : 'updated'),
      by: user_email || 'admin',
      at: new Date().toISOString(),
      note: action_note || ''
    };

    const newHistory = [...(current.history || []), historyEntry];

    await base44.asServiceRole.entities.InvoiceRecord.update(id, {
      ...updates,
      history: newHistory
    });

    // Sync Gmail label when status is paid or approved
    if ((updates.status === 'paid' || updates.status === 'approved') && gmail_message_id) {
      try {
        const CONNECTOR_ID = '69d7eb8b559525f8d2292321';
        const gmailConn = await base44.asServiceRole.connectors.getConnection("gmail");
        const accessToken = gmailConn.accessToken;
        const labelName = updates.status === 'paid' ? 'Processed/Paid' : 'Approved';
        // Get or create label
        const labelsRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const labelsData = await labelsRes.json();
        let label = (labelsData.labels || []).find(l => l.name === labelName);
        if (!label) {
          const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
          });
          label = await createRes.json();
        }
        if (label?.id) {
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ addLabelIds: [label.id], removeLabelIds: ['UNREAD'] })
          });
        }
      } catch (_) { /* label sync failed silently */ }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});