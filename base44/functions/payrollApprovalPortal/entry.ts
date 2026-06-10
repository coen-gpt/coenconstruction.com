import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Token-secured payroll approval portal backend. The PayrollApproval entity
// is RLS-locked (pay data + approval tokens), so the public approval page
// loads and decides through this function. The week's supporting records
// (time entries, receipts, completed tasks) are filtered server-side.

function weekFilter(dateStr, weekStart, weekEnd) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= weekStart && d <= weekEnd;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, approval_id, action } = body;
    if (!token || !approval_id) return Response.json({ error: "Invalid approval link." }, { status: 400 });

    const matches = await base44.asServiceRole.entities.PayrollApproval.filter({ approval_token: String(token).trim() });
    const approval = matches.find((a) => a.id === approval_id);
    if (!approval) return Response.json({ error: "Approval record not found or link expired." }, { status: 404 });

    if (action === "get") {
      const weekStart = new Date(approval.week_start);
      const weekEnd = new Date(approval.week_end);
      weekEnd.setHours(23, 59, 59, 999);

      const [entries, receipts, tasks] = await Promise.all([
        base44.asServiceRole.entities.TimeEntry.filter({ status: "clocked_out" }),
        base44.asServiceRole.entities.FieldReceipt.list("-created_date", 500),
        base44.asServiceRole.entities.FieldTask.filter({ status: "done" }),
      ]);

      return Response.json({
        approval,
        time_entries: entries.filter((e) => weekFilter(e.clock_in, weekStart, weekEnd)),
        receipts: receipts.filter((r) => weekFilter(r.receipt_date, weekStart, weekEnd)),
        tasks: tasks.filter((t) => weekFilter(t.completed_at, weekStart, weekEnd)),
      });
    }

    if (action === "decide") {
      const status = String(body.status || "");
      if (!["approved", "approved_with_remarks"].includes(status)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }
      await base44.asServiceRole.entities.PayrollApproval.update(approval.id, {
        status,
        approved_at: new Date().toISOString(),
        remarks: String(body.remarks || ""),
        employee_remarks: Array.isArray(body.employee_remarks) ? body.employee_remarks : [],
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
