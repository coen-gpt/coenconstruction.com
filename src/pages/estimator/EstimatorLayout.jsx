import { NavLink, Outlet, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import AiAssistant from "@/components/admin/AiAssistant";
import { base44 } from "@/api/base44Client";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import SidebarProjectSearch from "@/components/estimator/SidebarProjectSearch";
import {
  LayoutDashboard, Briefcase, ClipboardList, Building2,
  Wrench, Menu, X, PackageSearch, Users, Settings,
  Plus, ChevronRight, FileText, HardHat, DollarSign,
  Bell, Receipt, ChevronDown, ChevronUp, Ruler, Calculator, BookOpen, TrendingUp
} from "lucide-react";

// ── Navigation Sections ────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", path: "/estimator", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Estimating",
    items: [
      { label: "New Walkthrough", path: "/estimator/walkthrough", icon: Plus, highlight: true },
      { label: "All Projects", path: "/estimator/projects", icon: Briefcase },
      { label: "Customer History", path: "/estimator/customers", icon: Users },
    ],
  },
  {
    label: "Field Tools",
    items: [
      { label: "Quick Measure", path: "/estimator/measure", icon: Ruler },
      { label: "Material Take-Off", path: "/estimator/mto", icon: PackageSearch },
      { label: "Scope of Work", path: "/estimator/sow", icon: FileText },
      { label: "Daily Logs", path: "/estimator/logs", icon: ClipboardList },
      { label: "Trade Calculators", path: "/estimator/calculators", icon: Calculator },
      { label: "Code Lookup", path: "/estimator/codes", icon: BookOpen },
      { label: "Margin Guard", path: "/estimator/margin", icon: TrendingUp },
      { label: "Toolbox", path: "/estimator/toolbox", icon: Wrench },
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
    label: "Admin",
    items: [
      { label: "Company Profile", path: "/estimator/company", icon: Settings },
      { label: "Admin Hub", path: "/admin", icon: HardHat, external: true },
    ],
  },
];

export default function EstimatorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const { brandColor, logoUrl, companyName } = useCompanyBrand();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const close = () => setSidebarOpen(false);

  // Inject brand color as CSS variable for dynamic theming
  const sidebarStyle = {
    "--brand": brandColor,
    background: "#1B2B3A",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={close} />
      )}

      {/* ── Sidebar ── */}
      <aside
        style={sidebarStyle}
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200
          md:relative md:translate-x-0 md:shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-9 max-w-[130px] object-contain" />
          ) : (
            <>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                style={{ background: brandColor }}
              >
                {companyName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-sm leading-tight truncate">{companyName}</div>
                <div className="text-white/40 text-xs">Project Management</div>
              </div>
            </>
          )}
          <button onClick={close} className="ml-auto md:hidden text-white/40 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action — New Job */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <NavLink
            to="/estimator/walkthrough"
            onClick={close}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: brandColor }}
          >
            <Plus className="w-4 h-4" />
            Start New Job
          </NavLink>
        </div>

        {/* ── Nav Sections ── */}
        <nav className="shrink-0 px-2 py-1 space-y-0.5 border-b border-white/10 pb-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="px-3 pt-2 pb-1">
                <span className="text-xs font-bold text-white/30 uppercase tracking-widest">{section.label}</span>
              </div>
              {section.items.map(({ label, path, icon: Icon, exact, highlight, external }) => (
                external ? (
                  <a
                    key={path}
                    href={path}
                    onClick={close}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                    <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
                  </a>
                ) : (
                  <NavLink
                    key={path}
                    to={path}
                    end={exact}
                    onClick={close}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "text-white font-semibold"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }`
                    }
                    style={({ isActive }) => isActive ? { background: `${brandColor}33`, borderLeft: `3px solid ${brandColor}` } : {}}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </NavLink>
                )
              ))}
            </div>
          ))}
        </nav>

        {/* ── Quick Project Access ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden mt-1">
          <button
            onClick={() => setProjectsExpanded(v => !v)}
            className="flex items-center justify-between px-4 py-1.5 shrink-0 group"
          >
            <span className="text-xs font-bold text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">Quick Access</span>
            {projectsExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-white/30 group-hover:text-white/50" />
              : <ChevronDown className="w-3.5 h-3.5 text-white/30 group-hover:text-white/50" />
            }
          </button>
          {projectsExpanded && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <SidebarProjectSearch onNavigate={close} brandColor={brandColor} />
            </div>
          )}
        </div>

        {/* ── Footer: User info ── */}
        {currentUser && (
          <div className="shrink-0 px-4 py-3 border-t border-white/10 flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: brandColor }}
            >
              {currentUser.full_name?.charAt(0) || currentUser.email?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-xs font-semibold truncate">{currentUser.full_name || "User"}</div>
              <div className="text-white/40 text-xs capitalize">{currentUser.role || "user"}</div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <header
          className="md:hidden px-4 py-3 flex items-center gap-3 sticky top-0 z-30 border-b border-white/10"
          style={{ background: "#1B2B3A" }}
        >
          <button onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white p-1 shrink-0">
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
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: brandColor }}
            >
              <Plus className="w-4 h-4 text-white" />
            </div>
          </NavLink>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50">
          <Outlet />
        </main>
      </div>

      <AiAssistant adminUser={currentUser} />
    </div>
  );
}