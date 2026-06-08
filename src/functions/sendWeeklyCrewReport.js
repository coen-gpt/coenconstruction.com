/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Runs every Thursday at 6 AM ET = 11:00 UTC
// 1. Sends payroll summary to Site Superintendent with approval link (deadline: 12PM)
// 2. Sends final payroll PDF to info@coenconstruction.com at 12PM (handled by separate automation)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "superintendent"; // "superintendent" | "payroll_final"

    // Compute pay week (Fri–Thu)
    function getPayWeek() {
      const today = new Date();
      const day = today.getDay();
      const fridayOffset = day >= 5 ? day - 5 : day + 2;
      const friday = new Date(today);
      friday.setDate(today.getDate() - fridayOffset);
      friday.setHours(0, 0, 0, 0);
      const thursday = new Date(friday);
      thursday.setDate(friday.getDate() + 6);
      thursday.setHours(23, 59, 59, 999);
      return { start: friday, end: thursday };
    }

    const week = getPayWeek();
    const weekLabel = `${week.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${week.end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

    // Fetch data
    const [timeEntries, receipts, tasks, profiles] = await Promise.all([
      base44.asServiceRole.entities.TimeEntry.list("-clock_in", 500),
      base44.asServiceRole.entities.FieldReceipt.list("-created_date", 500),
      base44.asServiceRole.entities.FieldTask.filter({ status: "done" }),
      base44.asServiceRole.entities.CompanyProfile.list(),
    ]);

    const profile = profiles[0] || {};

    // Filter to this week
    const weekEntries = timeEntries.filter(e => {
      if (!e.clock_in || e.status !== "clocked_out") return false;
      const d = new Date(e.clock_in);
      return d >= week.start && d <= week.end;
    });
    const weekReceipts = receipts.filter(r => {
      if (!r.receipt_date) return false;
      const d = new Date(r.receipt_date);
      return d >= week.start && d <= week.end;
    });
    const weekTasks = tasks.filter(t => {
      if (!t.completed_at) return false;
      const d = new Date(t.completed_at);
      return d >= week.start && d <= week.end;
    });

    // Group by employee
    const byEmployee = {};
    weekEntries.forEach(e => {
      const key = e.user_email || e.user_name;
      if (!byEmployee[key]) byEmployee[key] = { name: e.user_name, email: e.user_email, entries: [], receipts: [], tasks: [] };
      byEmployee[key].entries.push(e);
    });
    weekReceipts.forEach(r => {
      const key = r.user_email;
      if (!byEmployee[key]) byEmployee[key] = { name: r.user_name, email: r.user_email, entries: [], receipts: [], tasks: [] };
      byEmployee[key].receipts.push(r);
    });
    weekTasks.forEach(t => {
      const key = t.assigned_to_email;
      if (byEmployee[key]) byEmployee[key].tasks.push(t);
    });

    const employees = Object.values(byEmployee);

    if (mode === "superintendent") {
      // Find site superintendent(s)
      const adminUsers = await base44.asServiceRole.entities.AdminUser.list();
      const superintendents = adminUsers.filter(u => u.role === "site_superintendent" && u.active !== false);

      if (!superintendents.length) {
        return Response.json({ ok: false, error: "No site superintendent found" });
      }

      // Create payroll approval record
      const token = crypto.randomUUID();
      const approval = await base44.asServiceRole.entities.PayrollApproval.create({
        week_start: week.start.toISOString().split("T")[0],
        week_end: week.end.toISOString().split("T")[0],
        superintendent_email: superintendents[0].email,
        superintendent_name: superintendents[0].name,
        status: "pending",
        approval_token: token,
        report_sent_at: new Date().toISOString(),
      });

      const approvalUrl = `${Deno.env.get("BASE44_APP_URL") || "https://app.base44.com"}/payroll-approval?token=${token}&id=${approval.id}`;

      // Build employee summary table rows
      let empRows = employees.map(emp => {
        const totalMins = emp.entries.reduce((s, e) => s + (e.total_minutes || 0), 0);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const expenses = emp.receipts.reduce((s, r) => s + (r.amount || 0), 0);
        const taskCount = emp.tasks.length;
        return `<tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 12px;font-weight:600;color:#1B2B3A;">${emp.name || emp.email}</td>
          <td style="padding:10px 12px;text-align:center;color:#333;">${hrs}h ${mins}m</td>
          <td style="padding:10px 12px;text-align:center;color:#333;">${emp.entries.length}</td>
          <td style="padding:10px 12px;text-align:center;color:#333;">${taskCount}</td>
          <td style="padding:10px 12px;text-align:right;color:#333;">${expenses > 0 ? "$" + expenses.toLocaleString() : "—"}</td>
        </tr>`;
      }).join("");

      const totalHours = employees.reduce((s, e) => s + e.entries.reduce((ss, en) => ss + (en.total_minutes || 0), 0), 0);
      const totalExpenses = employees.reduce((s, e) => s + e.receipts.reduce((ss, r) => ss + (r.amount || 0), 0), 0);

      const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:700px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1B2B3A;padding:28px 32px;">
    <h1 style="color:white;margin:0;font-size:20px;">Weekly Payroll Report</h1>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">${weekLabel}</p>
  </div>
  <div style="padding:24px 32px;">
    <div style="background:#fff8f0;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">⏰ Action Required by 12:00 PM Today</p>
      <p style="margin:8px 0 0;color:#78350f;font-size:13px;">Please review the hours below and approve payroll. If any crew member is leaving early or has uncorrected hours, add remarks before approving.</p>
    </div>

    <h2 style="color:#1B2B3A;font-size:16px;margin-bottom:12px;">Employee Summary</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="padding:10px 12px;text-align:left;color:#666;font-size:12px;text-transform:uppercase;">Employee</th>
          <th style="padding:10px 12px;text-align:center;color:#666;font-size:12px;text-transform:uppercase;">Hours</th>
          <th style="padding:10px 12px;text-align:center;color:#666;font-size:12px;text-transform:uppercase;">Shifts</th>
          <th style="padding:10px 12px;text-align:center;color:#666;font-size:12px;text-transform:uppercase;">Tasks Done</th>
          <th style="padding:10px 12px;text-align:right;color:#666;font-size:12px;text-transform:uppercase;">Expenses</th>
        </tr>
      </thead>
      <tbody>${empRows}</tbody>
      <tfoot>
        <tr style="background:#1B2B3A;color:white;">
          <td style="padding:10px 12px;font-weight:bold;" colspan="2">TOTAL: ${Math.floor(totalHours / 60)}h ${totalHours % 60}m</td>
          <td colspan="2"></td>
          <td style="padding:10px 12px;text-align:right;font-weight:bold;">${totalExpenses > 0 ? "$" + totalExpenses.toLocaleString() : "—"}</td>
        </tr>
      </tfoot>
    </table>

    <div style="text-align:center;margin-top:24px;">
      <a href="${approvalUrl}" style="display:inline-block;background:#E35235;color:white;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;">
        Review &amp; Approve Payroll →
      </a>
      <p style="color:#999;font-size:12px;margin-top:12px;">This link expires at 12:00 PM. Contact the office if you need assistance.</p>
    </div>
  </div>
</div>
</body></html>`;

      for (const super_ of superintendents) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: super_.email,
          subject: `⏰ Payroll Approval Needed — Week of ${weekLabel}`,
          html,
        });
      }

      return Response.json({ ok: true, mode: "superintendent", employees: employees.length, weekLabel, approvalId: approval.id });
    }

    // MODE: payroll_final — send full breakdown to info@coenconstruction.com at noon
    let fullReport = employees.map(emp => {
      const totalMins = emp.entries.reduce((s, e) => s + (e.total_minutes || 0), 0);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;

      let entryRows = emp.entries.map(e => {
        const bMins = (e.breaks || []).reduce((s, b) => b.start && b.end ? s + Math.round((new Date(b.end) - new Date(b.start)) / 60000) : s, 0);
        return `<tr><td style="padding:6px 10px;color:#555;">${e.date}</td><td style="padding:6px 10px;color:#555;">${e.project_name || "—"}</td>
        <td style="padding:6px 10px;color:#555;">${e.clock_in ? new Date(e.clock_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
        <td style="padding:6px 10px;color:#555;">${e.clock_out ? new Date(e.clock_out).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
        <td style="padding:6px 10px;color:#555;">${bMins}m</td>
        <td style="padding:6px 10px;font-weight:600;color:#1B2B3A;">${Math.floor((e.total_minutes || 0) / 60)}h ${(e.total_minutes || 0) % 60}m</td>
        <td style="padding:6px 10px;color:#555;">${e.gps_clock_in?.lat ? `${e.gps_clock_in.lat.toFixed(4)},${e.gps_clock_in.lng.toFixed(4)}` : "—"}</td>
        </tr>`;
      }).join("");

      let receiptRows = emp.receipts.map(r =>
        `<tr><td style="padding:6px 10px;color:#555;">${r.receipt_date || "—"}</td><td style="padding:6px 10px;color:#555;">${r.vendor_name || "Receipt"}</td>
        <td style="padding:6px 10px;color:#555;">${r.receipt_type === "job_expense" ? r.project_name || "Job" : "Reimbursement"}</td>
        <td style="padding:6px 10px;font-weight:600;color:#1B2B3A;">$${(r.amount || 0).toLocaleString()}</td>
        <td style="padding:6px 10px;color:#555;">${r.status}</td></tr>`
      ).join("");

      return `
      <div style="margin-bottom:32px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <div style="background:#1B2B3A;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:white;font-weight:bold;font-size:15px;">${emp.name || emp.email}</span>
          <span style="color:#E35235;font-weight:bold;font-size:15px;">${hrs}h ${mins}m</span>
        </div>
        <div style="padding:16px 20px;">
          <p style="font-weight:bold;color:#555;font-size:12px;text-transform:uppercase;margin-bottom:8px;">Time Entries</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f9f9f9;">
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Date</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Project</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">In</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Out</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Break</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Total</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">GPS</th>
            </tr></thead>
            <tbody>${entryRows || '<tr><td colspan="7" style="padding:8px 10px;color:#ccc;">No entries</td></tr>'}</tbody>
          </table>
          ${emp.receipts.length > 0 ? `
          <p style="font-weight:bold;color:#555;font-size:12px;text-transform:uppercase;margin:16px 0 8px;">Expenses & Reimbursements</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f9f9f9;">
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Date</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Vendor</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Type/Project</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Amount</th>
              <th style="padding:6px 10px;text-align:left;color:#888;font-size:11px;">Status</th>
            </tr></thead>
            <tbody>${receiptRows}</tbody>
          </table>` : ""}
        </div>
      </div>`;
    }).join("");

    // Check if superintendent approved with remarks
    const approvals = await base44.asServiceRole.entities.PayrollApproval.filter({
      week_start: week.start.toISOString().split("T")[0],
    });
    const thisApproval = approvals[0];

    let remarksBanner = "";
    if (thisApproval?.employee_remarks?.length > 0) {
      const remarkItems = thisApproval.employee_remarks.map(r =>
        `<li style="margin-bottom:8px;"><strong>${r.user_name}</strong>: ${r.remark} <em style="color:#999;">(${r.remark_type?.replace("_", " ")})</em></li>`
      ).join("");
      remarksBanner = `
      <div style="background:#fff8f0;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-weight:bold;color:#92400e;">⚠️ Superintendent Remarks — Adjust Accordingly</p>
        <ul style="margin:0;padding-left:20px;color:#78350f;font-size:14px;">${remarkItems}</ul>
        ${thisApproval.remarks ? `<p style="margin:10px 0 0;color:#78350f;font-size:13px;"><em>${thisApproval.remarks}</em></p>` : ""}
      </div>`;
    }

    const totalHours = employees.reduce((s, e) => s + e.entries.reduce((ss, en) => ss + (en.total_minutes || 0), 0), 0);
    const totalExpenses = employees.reduce((s, e) => s + e.receipts.reduce((ss, r) => ss + (r.amount || 0), 0), 0);
    const approvedBy = thisApproval?.superintendent_name || "Superintendent";
    const approvedAt = thisApproval?.approved_at ? new Date(thisApproval.approved_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "Pending";

    const finalHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:800px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1B2B3A;padding:28px 32px;">
    <h1 style="color:white;margin:0;font-size:22px;">Weekly Payroll Report</h1>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">${weekLabel} · ${employees.length} employees</p>
    <div style="display:flex;gap:24px;margin-top:16px;">
      <div><span style="color:rgba(255,255,255,0.5);font-size:12px;">TOTAL HOURS</span><br><span style="color:#E35235;font-size:20px;font-weight:bold;">${Math.floor(totalHours / 60)}h ${totalHours % 60}m</span></div>
      <div><span style="color:rgba(255,255,255,0.5);font-size:12px;">TOTAL EXPENSES</span><br><span style="color:#E35235;font-size:20px;font-weight:bold;">$${totalExpenses.toLocaleString()}</span></div>
      <div><span style="color:rgba(255,255,255,0.5);font-size:12px;">APPROVED BY</span><br><span style="color:white;font-size:14px;font-weight:bold;">${approvedBy} at ${approvedAt}</span></div>
    </div>
  </div>
  <div style="padding:28px 32px;">
    ${remarksBanner}
    ${fullReport}
  </div>
</div>
</body></html>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: "info@coenconstruction.com",
      subject: `📋 Payroll Report — ${weekLabel} (${employees.length} Employees)`,
      html: finalHtml,
    });

    return Response.json({ ok: true, mode: "payroll_final", employees: employees.length, weekLabel });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});