import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Sparkles, Search, MessageCircle, GraduationCap } from "lucide-react";
import { visibleNav } from "@/lib/backendNav";

/**
 * Role-aware first-use tutorial overlay for the unified backend.
 *
 * Steps are built from visibleNav(user), so every user is only walked through
 * the nav groups + tools their role/permissions actually grant — an admin sees
 * all eight groups, a site superintendent only sees the estimating suite, an
 * office admin only sees Leads/Invoices/Reviews, etc. Shown automatically on a
 * user's first login (per-user localStorage flag) and replayable any time from
 * the account menu ("App tour").
 */

// Bump when tour content changes enough that everyone should see it again.
export const TOUR_VERSION = "v1";
const tourKey = (user) => `coen_backend_tour_${TOUR_VERSION}:${user?.email || user?.id || "anon"}`;

export function hasSeenTour(user) {
  try {
    return localStorage.getItem(tourKey(user)) === "done";
  } catch {
    return true; // storage unavailable — never trap the user in the tour
  }
}

export function markTourSeen(user) {
  try {
    localStorage.setItem(tourKey(user), "done");
  } catch {
    /* ignore */
  }
}

const ROLE_LABELS = {
  admin: "Admin",
  project_manager: "Project Manager",
  assistant_project_manager: "Assistant Project Manager",
  site_superintendent: "Site Superintendent",
  operations_manager: "Operations Manager",
  office_admin: "Office Admin",
  estimator: "Estimator",
  viewer: "Viewer",
};

// One-line "what you do here" intro per nav group.
const GROUP_INTROS = {
  Overview:
    "Your daily starting point. Check what needs attention, how projects are trending, and which customers are waiting on a reply.",
  "Sales & Clients":
    "Everything customer-facing — incoming leads, the quotes you send them, their history with us, and the money side.",
  Projects:
    "Track every job from first walkthrough to completion. Use whichever view fits how you work — list, board, or calendar.",
  "Field Tools":
    "On-site and estimating utilities. Most of these work great from a phone while you're standing in the room you're measuring.",
  Employees:
    "People management — onboarding paperwork, who can access what, crew schedules, time off, and payroll sign-off.",
  "Subs & Vendors":
    "Your subcontractor and vendor network — contacts, compliance, bid invites, and approving what they invoice us.",
  Content:
    "The public website — blog posts, page content, and search visibility.",
  Settings:
    "Tune how the backend works for you — communication automations, email templates, and company-wide defaults.",
};

// Short functional blurb per nav item, keyed by route path.
const ITEM_BLURBS = {
  "/estimator": "Ops hub: communication queue, payments, approvals, and stalled projects in one view.",
  "/estimator/dashboard": "KPIs at a glance — pipeline status, financials, and overdue follow-ups.",
  "/estimator/comms": "Every client conversation in one feed. Reply, log, and clear the queue.",
  "/admin/leads": "New inquiries from the website and phone. Review, qualify, and convert to projects.",
  "/admin/estimates": "All customer quotes — create, send, track approval status.",
  "/estimator/customers": "Search any customer and see every project and quote we've done for them.",
  "/admin/invoices": "Invoice inbox — track what's owed, what's paid, and what needs chasing.",
  "/admin/reviews": "Customer reviews from Google — monitor and approve what shows on the site.",
  "/estimator/active-projects": "Just the jobs currently in progress.",
  "/estimator/projects": "Every project, searchable and sortable.",
  "/estimator/kanban": "Drag projects through workflow stages: walkthrough → quote → approved → in progress → done.",
  "/admin/calendar": "Scheduled site walkthroughs on a calendar.",
  "/estimator/calendar": "Team schedule, synced with Google Calendar.",
  "/estimator/tasks": "Checklists and to-dos per project, assignable to teammates.",
  "/estimator/measure": "AR measuring tool — point your phone camera to capture dimensions.",
  "/estimator/mto": "Upload plans and generate a material take-off list by trade. Email it to vendors for pricing.",
  "/estimator/sow": "Auto-draft a scope of work from project details and photos.",
  "/estimator/bid-replies": "Vendor and sub quotes that came back — compare pricing side by side.",
  "/estimator/roof-measure": "Roof area, pitch, and square calculations.",
  "/estimator/receipts": "Snap a photo of a receipt — line items are extracted for job costing.",
  "/estimator/logs": "Daily job-site logs: crew, work done, photos, notes.",
  "/estimator/calculators": "Quick trade calculators — lumber, concrete, electrical, plumbing.",
  "/estimator/codes": "Building-code quick reference (egress, ledgers, clearances).",
  "/estimator/margin": "Profitability check — flags jobs drifting below target margin.",
  "/estimator/toolbox": "Handy links: permit portals, estimating resources, external tools.",
  "/admin/onboarding": "Send W-2/1099 hire packets and review submitted forms.",
  "/admin/team": "Add teammates, assign roles, and control who can access what.",
  "/estimator/field-crew": "Crew assignments, dashboards, and time tracking.",
  "/estimator/time-off": "Request and approve time off.",
  "/admin/payroll-approvals": "Weekly payroll review and sign-off.",
  "/estimator/vendors": "The vendor & sub database — contacts, licenses, insurance compliance.",
  "/admin/subcontractors": "Active subs at a glance — workload and invoice status.",
  "/admin/sub-approvals": "Review and approve subcontractor invoices.",
  "/estimator/payment-gating": "Hold or release sub payments based on doc compliance.",
  "/admin/blog": "Write and publish blog posts.",
  "/admin/cms": "Edit website pages and content.",
  "/admin/seo": "SEO audits and keyword recommendations.",
  "/estimator/comms-settings": "Set the follow-up rules — e.g. remind a customer X days after a quote goes out.",
  "/estimator/comms-performance": "How well we respond — rates by lead source and channel.",
  "/estimator/email-templates": "Reusable email templates for customers and crews.",
  "/admin/tracking": "Analytics and tracking scripts on the website.",
  "/admin/profile": "Company details, branding, default markup %, and tax rate.",
};

export default function FirstUseTour({ user, brandColor, open, onClose }) {
  const [step, setStep] = useState(0);

  const steps = useMemo(() => {
    const groups = visibleNav(user);
    const roleLabel = ROLE_LABELS[user?.role] || "Team Member";
    return [
      { type: "welcome", roleLabel, groupCount: groups.length },
      ...groups.map((g) => ({ type: "group", group: g })),
      { type: "finish" },
    ];
  }, [user]);

  // Restart from the beginning each time the tour is opened.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, steps.length, onClose]);

  if (!open) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: brandColor }}
          >
            {current.type === "welcome" ? (
              <GraduationCap className="w-5 h-5" />
            ) : current.type === "finish" ? (
              <Sparkles className="w-5 h-5" />
            ) : (
              (() => {
                const Icon = current.group.items[0]?.icon;
                return Icon ? <Icon className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />;
              })()
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-secondary p-2 -m-2 rounded-lg"
            aria-label="Close tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto">
          {current.type === "welcome" && (
            <div>
              <h2 className="text-xl font-bold text-secondary mb-1">
                Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                This is the Coen Construction backend. You're signed in as{" "}
                <span
                  className="inline-block text-xs font-semibold text-white rounded-full px-2 py-0.5 align-middle"
                  style={{ background: brandColor }}
                >
                  {current.roleLabel}
                </span>{" "}
                — this quick tour covers the {current.groupCount} areas your access level unlocks.
              </p>
              <p className="text-sm text-gray-500">
                Everything lives in the sidebar on the left (bottom tabs on your phone). Use{" "}
                <span className="font-semibold text-secondary">Back</span> and{" "}
                <span className="font-semibold text-secondary">Next</span> to step through — about a minute total.
              </p>
            </div>
          )}

          {current.type === "group" && (
            <div>
              <h2 className="text-xl font-bold text-secondary mb-1">{current.group.label}</h2>
              <p className="text-sm text-gray-500 mb-4">{GROUP_INTROS[current.group.label]}</p>
              <ul className="space-y-2.5">
                {current.group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path} className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-secondary">{item.label}</div>
                        {ITEM_BLURBS[item.path] && (
                          <div className="text-xs text-gray-500">{ITEM_BLURBS[item.path]}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {current.type === "finish" && (
            <div>
              <h2 className="text-xl font-bold text-secondary mb-1">You're all set 🎉</h2>
              <p className="text-sm text-gray-500 mb-4">Three things that make everything faster:</p>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-secondary">Search anything</span> — press{" "}
                    <kbd className="text-[10px] font-sans font-semibold border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50">
                      ⌘K
                    </kbd>{" "}
                    (or the search bar up top) to jump to any page or project.
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-secondary">Ask the AI assistant</span> — the chat bubble in the
                    corner can answer questions and pull up project info.
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-secondary">Replay this tour</span> any time from your account
                    menu (top-right avatar) → <span className="font-semibold text-secondary">App tour</span>.
                  </div>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="w-2 h-2 rounded-full transition-colors"
                style={{ background: i === step ? brandColor : "#e5e7eb" }}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-secondary px-3 h-9 rounded-lg hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setStep(step + 1))}
              className="flex items-center gap-1 text-sm font-semibold text-white px-4 h-9 rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: brandColor }}
            >
              {isLast ? "Get started" : "Next"} {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
