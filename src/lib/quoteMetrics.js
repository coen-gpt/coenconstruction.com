/**
 * Pure helpers for the Customer Quotes page.
 *
 * SCOPE: customer/lead quotes only. Input is always Estimate records (our priced
 * quotes to clients) joined to ContractorProject (client info) and optionally to
 * Lead (origin/source). No SubBid, InvoiceRecord, or vendor/sub quote data is
 * touched here.
 *
 * Everything in this module is a pure function (no SDK calls, no React) so the
 * join + metric logic can be reasoned about and tested in isolation.
 */

import { ESTIMATE_STATUSES, QUOTE_TABS, RECENT_WINDOW_DAYS } from "@/lib/estimateStatus";

/**
 * Join Estimate records to their ContractorProject (for client info) and, when
 * available, to the originating Lead (for source). Returns enriched rows that
 * carry both the raw estimate fields and flattened display fields.
 */
export function buildQuoteRows(estimates = [], projects = [], leads = []) {
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Lead lookup: prefer the direct ContractorProject link, fall back to the
  // Design Preview (Project) link via ContractorProject.design_preview_id.
  const leadByContractorProject = new Map();
  const leadByDesignPreview = new Map();
  leads.forEach((l) => {
    if (l.contractor_project_id && !leadByContractorProject.has(l.contractor_project_id)) {
      leadByContractorProject.set(l.contractor_project_id, l);
    }
    if (l.project_id && !leadByDesignPreview.has(l.project_id)) {
      leadByDesignPreview.set(l.project_id, l);
    }
  });

  // Imported projects sometimes carry literal placeholder strings instead of
  // real contact data. Treat those as empty so they don't display as clutter.
  const clean = (v) => {
    if (!v) return "";
    const s = String(v).trim();
    return /^needs[\s-]/i.test(s) || s.toUpperCase().includes("NEEDS CONTACT") || s.toUpperCase().includes("NEEDS JOBSITE")
      ? ""
      : v;
  };

  return estimates.map((e) => {
    const project = projectMap.get(e.project_id) || null;
    let lead = null;
    if (project) {
      lead =
        leadByContractorProject.get(project.id) ||
        (project.design_preview_id ? leadByDesignPreview.get(project.design_preview_id) : null);
    }
    const address = [clean(project?.client_address), clean(project?.client_city)].filter(Boolean).join(", ");
    return {
      ...e,
      project,
      projectId: e.project_id,
      clientName: project?.client_name || "",
      address,
      projectType: project?.project_type || "",
      estimator: project?.assigned_to || "",
      leadSource: lead?.source || "",
      // Customer asked for modifications: processApproval keeps the estimate
      // "sent" and flips the project to "modify" while the estimator revises.
      changesRequested: e.status === "sent" && project?.status === "modify",
      grandTotal: e.grand_total || 0,
      qbStatus: e.quickbooks_sync_status || "not_synced",
    };
  });
}

function shiftDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
}

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t < end.getTime();
}

function pctChange(current, prior) {
  if (!prior) return current ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

const sumTotals = (rows) => rows.reduce((s, r) => s + (r.grandTotal || 0), 0);

/**
 * Compute the four overview metrics from customer Estimate rows.
 * `referenceDate` is injectable for testing; defaults to now.
 */
export function computeQuoteMetrics(rows = [], referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const windowStart = shiftDays(now, RECENT_WINDOW_DAYS);
  const priorStart = shiftDays(now, RECENT_WINDOW_DAYS * 2);

  // Pipeline: all-time counts by status.
  const pipeline = ESTIMATE_STATUSES.reduce((acc, s) => {
    acc[s] = rows.filter((r) => r.status === s).length;
    return acc;
  }, {});

  // Approval rate: approved / (sent + approved + rejected), by created_date in window.
  const DECISION = ["sent", "approved", "rejected"];
  const decisionCohort = (start, end) =>
    rows.filter((r) => DECISION.includes(r.status) && inRange(r.created_date, start, end));
  const curDecisions = decisionCohort(windowStart, now);
  const priorDecisions = decisionCohort(priorStart, windowStart);
  const rateOf = (cohort) =>
    cohort.length ? (cohort.filter((r) => r.status === "approved").length / cohort.length) * 100 : 0;
  const approvalRate = rateOf(curDecisions);
  const priorApprovalRate = rateOf(priorDecisions);

  // Sent: status === sent, created_date in window.
  const sentCur = rows.filter((r) => r.status === "sent" && inRange(r.created_date, windowStart, now));
  const sentPrior = rows.filter((r) => r.status === "sent" && inRange(r.created_date, priorStart, windowStart));

  // Approved: status === approved, by approved_date in window.
  const apprCur = rows.filter((r) => r.status === "approved" && inRange(r.approved_date, windowStart, now));
  const apprPrior = rows.filter((r) => r.status === "approved" && inRange(r.approved_date, priorStart, windowStart));

  return {
    total: rows.length,
    pipeline,
    approvalRate: {
      value: approvalRate,
      deltaPp: approvalRate - priorApprovalRate, // percentage points vs prior 30d
      sampleSize: curDecisions.length,
    },
    sent: {
      count: sentCur.length,
      total: sumTotals(sentCur),
      deltaCount: sentCur.length - sentPrior.length,
      deltaPct: pctChange(sentCur.length, sentPrior.length),
    },
    approved: {
      count: apprCur.length,
      total: sumTotals(apprCur),
      deltaCount: apprCur.length - apprPrior.length,
      deltaPct: pctChange(apprCur.length, apprPrior.length),
    },
  };
}

/**
 * Resolve a tab key to its QUOTE_TABS definition ("all" when unknown/unset).
 */
export function getQuoteTab(key) {
  return QUOTE_TABS.find((t) => t.key === key) || QUOTE_TABS[0];
}

/**
 * Per-tab row counts for the tab bar. Pass rows already filtered by every
 * control EXCEPT the tab itself, so the counts answer "how many quotes would
 * each tab show right now".
 */
export function countQuoteTabs(rows = []) {
  return QUOTE_TABS.reduce((acc, t) => {
    acc[t.key] = rows.filter(t.match).length;
    return acc;
  }, {});
}

/**
 * AND-logic filter across all controls. Empty/unset controls are ignored.
 */
export function filterQuotes(rows = [], filters = {}) {
  const {
    tab = "",
    statuses = [],
    type = "",
    from = "",
    to = "",
    estimator = "",
    source = "",
    qb = "",
    search = "",
  } = filters;
  const q = (search || "").trim().toLowerCase();
  const fromT = from ? new Date(from).getTime() : null;
  const toT = to ? new Date(`${to}T23:59:59`).getTime() : null;

  const tabMatch = tab && tab !== "all" ? getQuoteTab(tab).match : null;

  return rows.filter((r) => {
    if (tabMatch && !tabMatch(r)) return false;
    if (statuses.length && !statuses.includes(r.status)) return false;
    if (type && r.type !== type) return false;
    if (estimator && r.estimator !== estimator) return false;
    if (source && r.leadSource !== source) return false;
    if (qb && (r.quickbooks_sync_status || "not_synced") !== qb) return false;
    if (fromT != null || toT != null) {
      const t = r.created_date ? new Date(r.created_date).getTime() : null;
      if (t == null || Number.isNaN(t)) return false;
      if (fromT != null && t < fromT) return false;
      if (toT != null && t > toT) return false;
    }
    if (q) {
      const hay = `${r.clientName} ${r.title || ""} ${r.address}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

const STATUS_ORDER = ESTIMATE_STATUSES.reduce((acc, s, i) => {
  acc[s] = i;
  return acc;
}, {});

export const SORT_KEYS = ["client", "created", "status", "grand_total"];

/**
 * Stable sort by one of SORT_KEYS in the given direction ("asc" | "desc").
 */
export function sortQuotes(rows = [], sortKey = "created", dir = "desc") {
  const sign = dir === "asc" ? 1 : -1;
  const valueFor = (r) => {
    switch (sortKey) {
      case "client":
        return (r.clientName || "").toLowerCase();
      case "status":
        return STATUS_ORDER[r.status] ?? 99;
      case "grand_total":
        return r.grandTotal || 0;
      case "created":
      default:
        return r.created_date ? new Date(r.created_date).getTime() : 0;
    }
  };
  return [...rows].sort((a, b) => {
    const av = valueFor(a);
    const bv = valueFor(b);
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  });
}

/**
 * Serialize quote rows to CSV (customer-facing fields only).
 */
export function quotesToCsv(rows = []) {
  const headers = [
    "Client",
    "Quote",
    "Version",
    "Type",
    "Project Type",
    "Created",
    "Status",
    "Opened",
    "Viewed",
    "Nudges",
    "QB Sync",
    "Grand Total",
    "Address",
    "Estimator",
    "Lead Source",
  ];
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.clientName,
        r.title || "Estimate",
        r.version ?? "",
        r.type || "original",
        r.projectType,
        r.created_date ? new Date(r.created_date).toISOString().slice(0, 10) : "",
        r.status,
        r.opened_at ? new Date(r.opened_at).toISOString().slice(0, 10) : "",
        r.viewed_at ? new Date(r.viewed_at).toISOString().slice(0, 10) : "",
        r.nudge_count || 0,
        r.quickbooks_sync_status || "not_synced",
        (r.grandTotal || 0).toFixed(2),
        r.address,
        r.estimator,
        r.leadSource,
      ]
        .map(escape)
        .join(",")
    );
  });
  return lines.join("\n");
}

/**
 * Trigger a client-side CSV download. Mirrors the Blob + object-URL pattern used
 * elsewhere in the app (see invoices/AttachmentViewerModal).
 */
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}