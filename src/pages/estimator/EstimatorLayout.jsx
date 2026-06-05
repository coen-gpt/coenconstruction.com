import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import AiAssistant from "@/components/admin/AiAssistant";
import { ADMIN_SESSION_KEY, base44 } from "@/api/base44Client";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import SidebarProjectSearch from "@/components/estimator/SidebarProjectSearch";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Briefcase, ClipboardList, Building2,
  Wrench, Menu, X, PackageSearch, Users, Settings,
  Plus, ChevronRight, FileText, HardHat,
  Bell, Receipt, ChevronDown, Ruler, Calculator, BookOpen, TrendingUp, ScanLine, Triangle, BarChart3, Zap, MessageSquare, MessageSquareOff, Globe, Newspaper, Activity, Inbox, CheckSquare
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { label: "Command Center", path: "/estimator", icon: Zap, exact: true },
      { label: "Comms Hub", path: "/estimator/comms", icon: Inbox },
      { label: "Dashboard", path: "/estimator/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Estimating",
    items: [
      { label: "All Projects", path: "/estimator/projects", icon: Briefcase },
      { label: "Calendar", path: "/estimator/calendar", icon: Bell },
      { label: "Customer History", path: "/estimator/customers", icon: Users },
    ],
  },
  {
    label: "Field Tools",
    items: [
      { label: "Quick Measure", path: "/estimator/measure", icon: Ruler },
      { label: "Material Take-Off", path: "/estimator/mto", icon: PackageSearch },
      { label: "Scope of Work", path: "/estimator/sow", icon: FileText },
      { label: "Roof Measurement", path: "/estimator/roof-measure", icon: Triangle },
      { label: "Receipt Scanner", path: "/estimator/receipts", icon: ScanLine },
      { label: "Daily Logs", path: "/estimator/logs", icon: ClipboardList },
      { label: "Trade Calculators", path: "/estimator/calculators", icon: Calculator },
      { label: "Code Lookup", path: "/estimator/codes", icon: BookOpen },
      { label: "Margin Guard", path: "/estimator/margin", icon: TrendingUp },
      { label: "Toolbox", path: "/estimator/toolbox", icon: Wrench },
    ],
  },
  {
    label: "Field Crew",
    items: [
      { label: "Field Crew Admin", path: "/estimator/field-crew", icon: HardHat },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Vendors & Subs", path: "/estimator/vendors", icon: Building2 },
      { label: "Invoices", path: "/admin/invoices", icon: Receipt },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Company Profile", path: "/estimator/company", icon: Settings },
      { label: "Comm. Benchmarks", path: "/estimator/comms-settings", icon: MessageSquare },
      { label: "Comm. Performance", path: "/estimator/comms-performance", icon: BarChart3 },
      { label: "Email Templates", path: "/estimator/email-templates", icon: BookOpen },
      { label: "Project Tasks", path: "/estimator/tasks", icon: CheckSquare },
    ],
  },
];

const ADMIN_LINKS = [
  { label: "Admin Dashboard", icon: BarChart3, href: "/admin" },
  { label: "Leads", icon: Users, href: "/admin/leads" },
  { label: "Blog", icon: Newspaper, href: "/admin/blog" },
  { label: "CMS / Pages", icon: Globe, href: "/admin/cms" },
  { label: "SEO Tools", icon: Activity, href: "/admin/seo" },
  { label: "Team Access", icon: HardHat, href: "/admin/team" },
];

export default function EstimatorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const { brandColor, logoUrl, companyName } = useCompanyBrand();

  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profile-sms-check"],
    queryFn: () => base44.entities.CompanyProfile.list(),
    staleTime: 30_000,
  });
  const smsDisabled = profiles[0]?.sms_enabled === false;

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      try {
        const raw = localStorage.getItem(ADMIN_SESSION_KEY);
        const cached = raw ? JSON.parse(raw) : null;
        if (!cached?.session_token) {
          if (mounted) setAuthError("missing");
          return;
        }
        const res = await base44.functions.invoke("adminAuth", { action: "verifySession" });
        const user = res.data;
        if (user?.error || !(user?.role === "admin" || user?.can_access_estimates)) {
          localStorage.removeItem(ADMIN_SESSION_KEY);
          if (mounted) setAuthError("forbidden");
          return;
        }
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ ...cached, ...user, session_token: cached.session_token }));
        if (mounted) setCurrentUser(user);
      } catch (error) {
        if (mounted) setAuthError("missing");
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    loadSession();
    return () => { mounted = false; };
  }, []);

  const close = () => setSidebarOpen(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError || !currentUser) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={close} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-out
          md:relative md:translate-x-0 md:shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "#1B2B3A" }}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-9 max-w-[130px] object-contain" />
          ) : (
            <>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-inner"
                style={{ background: brandColor }}
              >
                {companyName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-sm leading-tight truncate">{companyName}</div>
                <div className="text-white/35 text-[11px] font-medium">Estimating Suite</div>
              </div>
            </>
          )}
          <button onClick={close} className="ml-auto md:hidden text-white/30 hover:text-white shrink-0 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Job CTA */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <NavLink
            to="/estimator/walkthrough"
            onClick={close}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-lg"
            style={{ background: brandColor }}
          >
            <Plus className="w-4 h-4" />
            Start New Job
          </NavLink>
        </div>

        {/* Nav Sections */}
        <nav className="shrink-0 px-2 py-1 space-y-0.5 border-b border-white/8 pb-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.1em]">{section.label}</span>
              </div>
              {section.items.map(({ label, path, icon: Icon, exact }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={exact}
                  onClick={close}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      isActive
                        ? "text-white"
                        : "text-white/50 hover:text-white/90 hover:bg-white/6"
                    }`
                  }
                  style={({ isActive }) => isActive ? {
                    background: `${brandColor}28`,
                    borderLeft: `3px solid ${brandColor}`,
                    paddingLeft: "9px"
                  } : {}}
                >
                  <Icon className="w-[15px] h-[15px] shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Quick Project Access */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden mt-1">
          <div className="px-4 py-1.5 shrink-0">
            <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.1em]">Quick Access</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <SidebarProjectSearch onNavigate={close} brandColor={brandColor} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3 py-3 border-t border-white/8">
          {currentUser?.role === 'admin' && (
            <div className="mb-2 relative">
              <button
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/8 hover:bg-white/14 text-white text-[13px] font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HardHat className="w-3.5 h-3.5" /> Admin Hub
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/50 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {adminMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#243444] border border-white/12 rounded-xl overflow-hidden z-50 shadow-xl">
                  {ADMIN_LINKS.map(({ label, icon: Icon, href }) => (
                    <a key={href} href={href}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/8 text-[13px] transition-colors">
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/8 transition-colors cursor-default">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: brandColor }}
            >
              {currentUser.full_name?.charAt(0) || currentUser.email?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-[13px] font-semibold truncate leading-tight">{currentUser.full_name || "User"}</div>
              <div className="text-white/35 text-[11px] capitalize">{currentUser.role || "user"}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <header
          className="md:hidden px-4 py-3 flex items-center gap-3 sticky top-0 z-30 border-b border-white/8"
          style={{ background: "#1B2B3A" }}
        >
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white p-1 shrink-0 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-7 max-w-[120px] object-contain" />
            ) : (
              <span className="font-bold text-white text-sm">{companyName}</span>
            )}
          </div>
          <NavLink to="/estimator/walkthrough" className="shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-opacity hover:opacity-90" style={{ background: brandColor }}>
              <Plus className="w-4 h-4 text-white" />
            </div>
          </NavLink>
        </header>

        {smsDisabled && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium shrink-0">
            <MessageSquareOff className="w-3.5 h-3.5 shrink-0" />
            SMS texting is globally disabled — no outbound texts will be sent.
            <a href="/estimator/company" className="ml-auto underline hover:no-underline shrink-0">Manage in Settings →</a>
          </div>
        )}
        <main className="flex-1 overflow-auto bg-[#F7F8FA]">
          <Outlet />
        </main>
      </div>

      <AiAssistant adminUser={currentUser} />
    </div>
  );
}