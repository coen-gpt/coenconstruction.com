import { verifyAdminSession } from '../_shared/adminSession.ts';
import { Resend } from 'npm:resend@3.2.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  try {
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices');

    const today = new Date();
    const allRecords = await base44.asServiceRole.entities.InvoiceRecord.list('-due_date', 500);
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const notifyEmail = profiles[0]?.lead_notification_email || profiles[0]?.email || 'scott@coenconstruction.com';

    const overdue = [];
    const dueSoon = [];

    for (const r of allRecords) {
      if (r.status === 'paid' || r.status === 'rejected') continue;
      if (!r.due_date) continue;

      const due = new Date(r.due_date);
      const daysUntil = Math.round((due - today) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        overdue.push({ ...r, days_overdue: Math.abs(daysUntil) });
      } else if (daysUntil <= 3) {
        dueSoon.push({ ...r, days_until: daysUntil });
      }
    }

    if (overdue.length === 0 && dueSoon.length === 0) {
      return Response.json({ success: true, message: 'No reminders needed today.' });
    }

    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    const overdueRows = overdue.map(r => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">${r.vendor_name || r.vendor_email || '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">${r.invoice_number || '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">${r.amount ? '$' + Number(r.amount).toLocaleString() : '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #dc2626; font-weight: bold;">${fmt(r.due_date)} (${r.days_overdue}d overdue)</td>
      </tr>
    `).join('');

    const dueSoonRows = dueSoon.map(r => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">${r.vendor_name || r.vendor_email || '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">${r.invoice_number || '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">${r.amount ? '$' + Number(r.amount).toLocaleString() : '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #d97706; font-weight: bold;">${fmt(r.due_date)} (${r.days_until === 0 ? 'Today' : `${r.days_until}d`})</td>
      </tr>
    `).join('');

    await resend.emails.send({
      from: 'Coen Construction <info@coenconstruction.com>',
      to: notifyEmail,
      subject: `⚠️ Invoice Payment Reminder: ${overdue.length} Overdue, ${dueSoon.length} Due Soon`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px;">
          <div style="background: #1B2B3A; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 18px;">Invoice Payment Reminders</h1>
            <p style="color: #aaa; margin: 4px 0 0; font-size: 13px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            ${overdue.length > 0 ? `
              <h2 style="color: #dc2626; font-size: 15px; margin: 0 0 12px;">🔴 ${overdue.length} Overdue Invoice${overdue.length > 1 ? 's' : ''}</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
                <thead>
                  <tr style="background: #fef2f2;">
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Vendor</th>
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Invoice #</th>
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Amount</th>
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Due Date</th>
                  </tr>
                </thead>
                <tbody>${overdueRows}</tbody>
              </table>
            ` : ''}
            ${dueSoon.length > 0 ? `
              <h2 style="color: #d97706; font-size: 15px; margin: 0 0 12px;">🟡 ${dueSoon.length} Due Within 3 Days</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #fffbeb;">
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Vendor</th>
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Invoice #</th>
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Amount</th>
                    <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Due Date</th>
                  </tr>
                </thead>
                <tbody>${dueSoonRows}</tbody>
              </table>
            ` : ''}
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
              Manage invoices at your <a href="https://app.base44.com/admin/invoices" style="color: #E35235;">Invoice Inbox →</a>
            </p>
          </div>
        </div>
      `
    });

    return Response.json({ success: true, overdue: overdue.length, due_soon: dueSoon.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
