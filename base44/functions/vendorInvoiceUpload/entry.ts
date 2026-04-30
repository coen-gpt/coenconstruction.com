import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, token, file_url, file_name } = body;

    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    // Find invoice by token
    const records = await base44.asServiceRole.entities.InvoiceRecord.filter({ vendor_token: token });
    if (!records.length) return Response.json({ error: 'Invalid or expired link' }, { status: 404 });
    const invoice = records[0];

    // Check expiry
    if (invoice.vendor_token_expires_at) {
      const expires = new Date(invoice.vendor_token_expires_at);
      if (new Date() > expires) {
        return Response.json({ error: 'This link has expired. Please contact Coen Construction for a new link.' }, { status: 410 });
      }
    }

    // GET action — return invoice details for display
    if (action === 'get') {
      return Response.json({
        success: true,
        invoice: {
          id: invoice.id,
          vendor_name: invoice.vendor_name,
          invoice_number: invoice.invoice_number,
          payment_stage: invoice.payment_stage || 'Invoice',
          amount: invoice.amount,
          due_date: invoice.due_date,
          all_attachment_versions: invoice.all_attachment_versions || [],
          status: invoice.status,
        }
      });
    }

    // UPLOAD action — vendor submitting new document
    if (action === 'upload') {
      if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

      const newVersion = {
        stage: invoice.payment_stage || 'Invoice',
        url: file_url,
        file_name: file_name || 'invoice.pdf',
        uploaded_at: new Date().toISOString(),
        uploaded_by_vendor: true
      };

      const versions = [...(invoice.all_attachment_versions || []), newVersion];
      const history = [...(invoice.history || []), {
        action: 'vendor_uploaded_document',
        by: invoice.vendor_email || 'vendor',
        at: new Date().toISOString(),
        note: `${invoice.payment_stage || 'Invoice'} uploaded by vendor`
      }];

      await base44.asServiceRole.entities.InvoiceRecord.update(invoice.id, {
        all_attachment_versions: versions,
        status: 'pending_review',
        history,
        // Clear token after successful upload
        vendor_token: null,
        vendor_token_expires_at: null,
      });

      return Response.json({ success: true, message: 'Invoice uploaded successfully. We\'ll review it shortly.' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});