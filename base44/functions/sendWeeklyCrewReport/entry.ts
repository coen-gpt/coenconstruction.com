/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

// Two modes:
// "superintendent" — runs Thursday 6AM ET (11:00 UTC): sends approval link to Site Superintendent, deadline 12PM
// "payroll_final" — runs Thursday 12PM ET (17:00 UTC): sends full payroll PDF to info@coenconstruction.com

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_field_crew', body);
    const mode = body.mode || "superintendent";

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

    const [timeEntries, receipts, tasks] = await Promise.all([
      base44.asServiceRole.entities.TimeEntry.list("-clock_in", 500),
      base44.asServiceRole.entities.FieldReceipt.list("-created_date", 500),
      base44.asServiceRole.entities.FieldTask.filter({ status: "done" }),
    ]);

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
      const adminUsers = await base44.asServiceRole.entities.AdminUser.list();
      const superintendents = adminUsers.filter(u => u.role === "site_superintendent" && u.active !== false);

      if (!superintendents.length) {
        return Response.json({ ok: false, error: "No site superintendent configured. Set role='site_superintendent' in Team Management." });
      }

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

      const appUrl = Deno.env.get("BASE44_APP_URL") || "https://coenconstructionapp.base44.app";
      const approvalUrl = `${appUrl}/payroll-approval?token=${token}&id=${approval.id}`;

      const totalMinsAll = weekEntries.reduce((s, e) => s + (e.total_minutes || 0), 0);
      const totalHoursAll = Math.floor(totalMinsAll / 60);
      const totalMinsRem = totalMinsAll % 60;
      const totalExpensesAll = weekReceipts.reduce((s, r) => s + (r.amount || 0), 0);

      const empRows = employees.map(emp => {
        const totalMins = emp.entries.reduce((s, e) => s + (e.total_minutes || 0), 0);
        const expenses = emp.receipts.reduce((s, r) => s + (r.amount || 0), 0);
        return `<tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 14px;font-weight:600;color:#1B2B3A;">${emp.name || emp.email}</td>
          <td style="padding:10px 14px;text-align:center;">${Math.floor(totalMins / 60)}h ${totalMins % 60}m</td>
          <td style="padding:10px 14px;text-align:center;">${emp.entries.length}</td>
          <td style="padding:10px 14px;text-align:center;">${emp.tasks.length}</td>
          <td style="padding:10px 14px;text-align:right;">${expenses > 0 ? "$" + expenses.toLocaleString() : "—"}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:680px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1B2B3A;padding:28px 32px;">
    <h1 style="color:white;margin:0;font-size:20px;">⏰ Payroll Approval Needed</h1>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">${weekLabel}</p>
  </div>
  <div style="padding:24px 32px;">
    <div style="background:#fff8f0;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:15px;font-weight:700;">Action Required — Deadline 12:00 PM Today</p>
      <p style="margin:8px 0 0;color:#78350f;font-size:13px;">Review the summary below. If any crew member is leaving early Thursday or has uncorrected time, add remarks before approving so payroll is accurate.</p>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;background:#f8f9fa;border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:bold;color:#E35235;">${totalHoursAll}h ${totalMinsRem}m</div>
        <div style="font-size:12px;color:#888;">Total Hours</div>
      </div>
      <div style="flex:1;background:#f8f9fa;border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:bold;color:#E35235;">${employees.length}</div>
        <div style="font-size:12px;color:#888;">Employees</div>
      </div>
      <div style="flex:1;background:#f8f9fa;border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:bold;color:#E35235;">${totalExpensesAll > 0 ? "$" + totalExpensesAll.toLocaleString() : "—"}</div>
        <div style="font-size:12px;color:#888;">Expenses</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:10px 14px;text-align:left;color:#666;font-size:12px;text-transform:uppercase;">Employee</th>
        <th style="padding:10px 14px;text-align:center;color:#666;font-size:12px;text-transform:uppercase;">Hours</th>
        <th style="padding:10px 14px;text-align:center;color:#666;font-size:12px;text-transform:uppercase;">Shifts</th>
        <th style="padding:10px 14px;text-align:center;color:#666;font-size:12px;text-transform:uppercase;">Tasks</th>
        <th style="padding:10px 14px;text-align:right;color:#666;font-size:12px;text-transform:uppercase;">Expenses</th>
      </tr></thead>
      <tbody>${empRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#ccc;">No time entries this week</td></tr>'}</tbody>
    </table>
    <div style="text-align:center;">
      <a href="${approvalUrl}" style="display:inline-block;background:#E35235;color:white;padding:14px 40px;border-radius:10px;font-weight:bold;font-size:16px;text-decoration:none;">Review &amp; Approve Payroll →</a>
      <p style="color:#aaa;font-size:12px;margin-top:12px;">Deadline: 12:00 PM today. Contact info@coenconstruction.com with questions.</p>
    </div>
  </div>
</div></body></html>`;

      for (const sup of superintendents) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: sup.email,
          subject: `⏰ Payroll Approval Needed — ${weekLabel}`,
          html,
        });
      }

      return Response.json({ ok: true, mode: "superintendent", employees: employees.length, weekLabel });
    }

    // MODE: payroll_final — noon Thursday to info@coenconstruction.com
    const approvals = await base44.asServiceRole.entities.PayrollApproval.filter({
      week_start: week.start.toISOString().split("T")[0],
    });
    const thisApproval = approvals[0];

    const empSections = employees.map(emp => {
      const totalMins = emp.entries.reduce((s, e) => s + (e.total_minutes || 0), 0);

      const entryRows = emp.entries.map(e => {
        const bMins = (e.breaks || []).reduce((s, b) => b.start && b.end ? s + Math.round((new Date(b.end) - new Date(b.start)) / 60000) : s, 0);
        const inTime = e.clock_in ? new Date(e.clock_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";
        const outTime = e.clock_out ? new Date(e.clock_out).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";
        const gps = e.gps_clock_in?.lat ? `${e.gps_clock_in.lat.toFixed(4)}, ${e.gps_clock_in.lng.toFixed(4)}` : "—";
        return `<tr><td style="padding:6px 10px;">${e.date}</td><td style="padding:6px 10px;">${e.project_name || "—"}</td>
        <td style="padding:6px 10px;">${inTime}</td><td style="padding:6px 10px;">${outTime}</td>
        <td style="padding:6px 10px;">${bMins}m</td>
        <td style="padding:6px 10px;font-weight:600;">${Math.floor((e.total_minutes || 0) / 60)}h ${(e.total_minutes || 0) % 60}m</td>
        <td style="padding:6px 10px;font-size:11px;color:#999;">${gps}</td></tr>`;
      }).join("");

      const receiptRows = emp.receipts.map(r =>
        `<tr><td style="padding:6px 10px;">${r.receipt_date || "—"}</td><td style="padding:6px 10px;">${r.vendor_name || "—"}</td>
        <td style="padding:6px 10px;">${r.receipt_type === "reimbursement" ? "Reimbursement" : (r.project_name || "Job Expense")}</td>
        <td style="padding:6px 10px;font-weight:600;">$${(r.amount || 0).toLocaleString()}</td>
        <td style="padding:6px 10px;">${r.status}</td></tr>`
      ).join("");

      return `<div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <div style="background:#1B2B3A;padding:12px 20px;display:flex;justify-content:space-between;">
          <span style="color:white;font-weight:700;font-size:15px;">${emp.name || emp.email}</span>
          <span style="color:#E35235;font-weight:700;font-size:15px;">${Math.floor(totalMins / 60)}h ${totalMins % 60}m</span>
        </div>
        <div style="padding:16px 20px;">
          <p style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:8px;">Time Entries</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#333;">
            <thead><tr style="background:#f9f9f9;"><th style="padding:6px 10px;text-align:left;font-size:11px;color:#aaa;">Date</th><th>Project</th><th>In</th><th>Out</th><th>Break</th><th>Total</th><th>GPS Coords</th></tr></thead>
            <tbody>${entryRows || '<tr><td colspan="7" style="padding:8px;color:#ccc;">No entries</td></tr>'}</tbody>
          </table>
          ${emp.receipts.length ? `<p style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;margin:14px 0 8px;">Expenses & Reimbursements</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#333;">
            <thead><tr style="background:#f9f9f9;"><th style="padding:6px 10px;text-align:left;font-size:11px;color:#aaa;">Date</th><th>Vendor</th><th>Type/Project</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>${receiptRows}</tbody>
          </table>` : ""}
        </div>
      </div>`;
    }).join("");

    const totalMinsAll = weekEntries.reduce((s, e) => s + (e.total_minutes || 0), 0);
    const totalExpensesAll = weekReceipts.reduce((s, r) => s + (r.amount || 0), 0);

    let remarksBanner = "";
    if (thisApproval?.employee_remarks?.length > 0) {
      const items = thisApproval.employee_remarks.map(r =>
        `<li style="margin-bottom:8px;"><strong>${r.user_name}</strong> — ${r.remark} <em style="color:#999;">(${(r.remark_type || "").replace("_", " ")})</em></li>`
      ).join("");
      remarksBanner = `<div style="background:#fff8f0;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-weight:700;color:#92400e;">⚠️ Superintendent Remarks — Adjust Hours Accordingly</p>
        <ul style="margin:0;padding-left:20px;color:#78350f;font-size:14px;">${items}</ul>
        ${thisApproval.remarks ? `<p style="margin:10px 0 0;font-style:italic;color:#92400e;">"${thisApproval.remarks}"</p>` : ""}
      </div>`;
    }

    const approvedStatus = thisApproval?.status || "pending";
    const approvedBy = thisApproval?.superintendent_name || "Superintendent";
    const approvedAt = thisApproval?.approved_at ? new Date(thisApproval.approved_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "⚠️ NOT YET APPROVED";

    const finalHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:800px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1B2B3A;padding:28px 32px;">
    <h1 style="color:white;margin:0;font-size:22px;">📋 Weekly Payroll Report</h1>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;">${weekLabel} · ${employees.length} employees</p>
    <div style="display:flex;gap:20px;margin-top:16px;flex-wrap:wrap;">
      <div><span style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;">Total Hours</span><br><span style="color:#E35235;font-size:20px;font-weight:bold;">${Math.floor(totalMinsAll / 60)}h ${totalMinsAll % 60}m</span></div>
      <div><span style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;">Expenses</span><br><span style="color:#E35235;font-size:20px;font-weight:bold;">$${totalExpensesAll.toLocaleString()}</span></div>
      <div><span style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;">Approved By</span><br><span style="color:white;font-size:14px;font-weight:600;">${approvedBy} · ${approvedAt}</span></div>
      <div><span style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;">Status</span><br><span style="color:${approvedStatus === "pending" ? "#fbbf24" : "#4ade80"};font-size:14px;font-weight:600;">${approvedStatus.replace("_", " ").toUpperCase()}</span></div>
    </div>
  </div>
  <div style="padding:28px 32px;">
    ${remarksBanner}
    ${empSections || '<p style="color:#ccc;text-align:center;">No employee data for this week.</p>'}
  </div>
</div></body></html>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: "info@coenconstruction.com",
      subject: `📋 Weekly Payroll — ${weekLabel} (${employees.length} Employees, ${Math.floor(totalMinsAll / 60)}h ${totalMinsAll % 60}m)`,
      html: finalHtml,
    });

    return Response.json({ ok: true, mode: "payroll_final", employees: employees.length, weekLabel });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});