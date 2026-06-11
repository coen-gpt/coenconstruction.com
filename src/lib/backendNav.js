/**
 * Unified backend navigation model.
 *
 * One permission-filtered nav for the whole backend — the former /admin
 * (AdminHub) and /estimator (EstimatorLayout) areas now share a single shell.
 * Every item points at an EXISTING live route (nothing is renamed), so all deep
 * links keep working. Access is gated by AdminUser.role ("admin" sees
 * everything) + the can_access_* flags. Groups with a `perm` are hidden whole
 * when the user lacks it; otherwise items are filtered individually.
 */
import {
  Zap, LayoutDashboard, Inbox, BarChart3, Users, ClipboardList, BookUser,
  Receipt, Star, Briefcase, CalendarDays, CalendarClock, CheckSquare, Ruler,
  PackageSearch, FileText, Triangle, ScanLine, ClipboardCheck, Calculator,
  BookOpen, TrendingUp, Wrench, HardHat, CalendarOff, Building2, FileCheck,
  DollarSign, Newspaper, Globe, Search, MessageSquare, Mail, Settings, Tag,
  Kanban, CreditCard,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    // The live app already consolidated dashboards: /admin redirects to
    // /estimator/dashboard. Point straight at it (one "Dashboard"), keep the
    // Command Center (the /estimator ops hub) and Comms Hub.
    label: "Overview",
    perm: "can_access_estimates",
    items: [
      { label: "Command Center", path: "/estimator", icon: Zap, exact: true },
      { label: "Dashboard", path: "/estimator/dashboard", icon: LayoutDashboard },
      { label: "Comms Hub", path: "/estimator/comms", icon: Inbox },
    ],
  },
  {
    label: "Sales & Clients",
    items: [
      { label: "Leads", path: "/admin/leads", icon: Users, perm: "can_access_leads" },
      { label: "Email Campaigns", path: "/admin/email-campaigns", icon: Mail, perm: "can_access_leads" },
      { label: "Customer Quotes", path: "/admin/estimates", icon: ClipboardList, perm: "can_access_estimates" },
      { label: "Signed Contracts", path: "/admin/contracts", icon: FileCheck, perm: "can_access_estimates" },
      { label: "Customer History", path: "/estimator/customers", icon: BookUser, perm: "can_access_estimates" },
      { label: "Invoices", path: "/admin/invoices", icon: Receipt, perm: "can_access_invoices" },
      { label: "Reviews", path: "/admin/reviews", icon: Star },
    ],
  },
  {
    label: "Projects",
    perm: "can_access_estimates",
    items: [
      { label: "Active Projects", path: "/estimator/active-projects", icon: HardHat },
      { label: "All Projects", path: "/estimator/projects", icon: Briefcase },
      { label: "Kanban Board", path: "/estimator/kanban", icon: Kanban },
      { label: "Walkthrough Calendar", path: "/admin/calendar", icon: CalendarDays },
      { label: "Schedule", path: "/estimator/calendar", icon: CalendarClock },
      { label: "Project Tasks", path: "/estimator/tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Field Tools",
    perm: "can_access_estimates",
    collapsible: true,
    items: [
      { label: "Quick Measure", path: "/estimator/measure", icon: Ruler },
      { label: "Material Take-Off", path: "/estimator/mto", icon: PackageSearch },
      { label: "Scope of Work", path: "/estimator/sow", icon: FileText },
      { label: "Bid Replies", path: "/estimator/bid-replies", icon: Mail },
      { label: "Roof Measurement", path: "/estimator/roof-measure", icon: Triangle },
      { label: "Receipt Scanner", path: "/estimator/receipts", icon: ScanLine },
      { label: "Daily Logs", path: "/estimator/logs", icon: ClipboardCheck },
      { label: "Trade Calculators", path: "/estimator/calculators", icon: Calculator },
      { label: "Code Lookup", path: "/estimator/codes", icon: BookOpen },
      { label: "Margin Guard", path: "/estimator/margin", icon: TrendingUp },
      { label: "Toolbox", path: "/estimator/toolbox", icon: Wrench },
    ],
  },
  {
    // The employee hub: people management in one place — access/roles, the
    // crew dashboard's admin side, time off, and payroll.
    label: "Employees",
    collapsible: true,
    items: [
      { label: "Onboarding Packets", path: "/admin/onboarding", icon: ClipboardCheck, perm: "can_access_team" },
      { label: "Team Access & Roles", path: "/admin/team", icon: Users, perm: "can_access_team" },
      { label: "Field Crew Admin", path: "/estimator/field-crew", icon: HardHat, perm: "can_access_field_crew" },
      { label: "Time Off", path: "/estimator/time-off", icon: CalendarOff, perm: "can_access_field_crew" },
      { label: "Payroll Approvals", path: "/admin/payroll-approvals", icon: DollarSign, perm: "can_approve_payroll" },
    ],
  },
  {
    label: "Subs & Vendors",
    perm: "can_access_estimates",
    collapsible: true,
    items: [
      { label: "Vendors & Subs", path: "/estimator/vendors", icon: Building2 },
      { label: "Subcontractors", path: "/admin/subcontractors", icon: Users },
      { label: "Sub Invoice Approvals", path: "/admin/sub-approvals", icon: FileCheck },
      { label: "Sub Payment Gating", path: "/estimator/payment-gating", icon: CreditCard, perm: "can_access_invoices" },
    ],
  },
  {
    label: "Content",
    collapsible: true,
    items: [
      { label: "Blog Posts", path: "/admin/blog", icon: Newspaper, perm: "can_access_blog" },
      { label: "CMS / Pages", path: "/admin/cms", icon: Globe, perm: "can_access_cms" },
      { label: "SEO Tools", path: "/admin/seo", icon: Search, perm: "can_access_seo" },
    ],
  },
  {
    // Settings-type pages live in one collapsible group — fewer top-level
    // groups keeps the everyday nav (Overview / Sales / Projects) scannable.
    label: "Settings",
    collapsible: true,
    items: [
      { label: "Comm Benchmarks", path: "/estimator/comms-settings", icon: MessageSquare, perm: "can_access_estimates" },
      { label: "Comm Performance", path: "/estimator/comms-performance", icon: BarChart3, perm: "can_access_estimates" },
      { label: "Email Templates", path: "/estimator/email-templates", icon: Mail, perm: "can_access_estimates" },
      { label: "Tracking & Code", path: "/admin/tracking", icon: Tag, perm: "can_access_tracking" },
      { label: "Company Profile", path: "/admin/profile", icon: Building2 },
    ],
  },
];

export function hasPermission(user, perm) {
  if (!perm) return true;
  if (user?.role === "admin") return true;
  return user?.[perm] === true;
}

function effectivePerm(group, item) {
  return item.perm !== undefined ? item.perm : group.perm ?? null;
}

export function visibleNav(user) {
  return NAV_GROUPS.map((group) => {
    if (group.perm && !hasPermission(user, group.perm)) return null;
    const items = group.items.filter((item) => hasPermission(user, effectivePerm(group, item)));
    if (!items.length) return null;
    return { ...group, items };
  }).filter(Boolean);
}

const FLAT = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, perm: effectivePerm(group, item) }))
);

export function matchNavItem(pathname) {
  return (
    [...FLAT]
      .sort((a, b) => b.path.length - a.path.length)
      .find((it) =>
        it.exact ? pathname === it.path : pathname === it.path || pathname.startsWith(`${it.path}/`)
      ) || null
  );
}

export function canAccessPath(user, pathname) {
  const item = matchNavItem(pathname);
  if (!item) return true; // unlisted routes (e.g. detail pages, profile alias) are allowed
  return hasPermission(user, item.perm);
}

export function pageTitle(pathname) {
  return matchNavItem(pathname)?.label || "Backend";
}

export function searchableDestinations(user) {
  return visibleNav(user).flatMap((group) =>
    group.items.map((item) => ({ label: item.label, path: item.path, group: group.label, icon: item.icon }))
  );
}