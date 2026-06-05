import { useState, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, BookOpen, Search, Calculator,
  Menu, X, ChevronRight, Bell, Settings, LogOut, Tag, Receipt, Star,
  Globe, ChevronDown, Calendar, Building2
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminLogin from "@/pages/admin/AdminLogin";
import AiAssistant from "@/components/admin/AiAssistant";
import { useQuery } from "@tanstack/react-query";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/admin", permKey: null },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Leads", icon: Users, path: "/admin/leads", permKey: "can_access_leads" },
      { label: "Invoice Inbox", icon: Receipt, path: "/admin/invoices", permKey: "can_access_invoices" },
    ],
  },
  {
    label: "Content & SEO",
    items: [
      { label: "Blog Posts", icon: BookOpen, path: "/admin/blog", permKey: "can_access_blog" },
      { label: "CMS / Pages", icon: FileText, path: "/admin/cms", permKey: "can_access_cms" },
      { label: "SEO Tools", icon: Search, path: "/admin/seo", permKey: "can_access_seo" },
      { label: "Reviews", icon: Star, path: "/admin/reviews", permKey: null },
    ],
  },
  {
    label: "Estimating",
    items: [
      { label: "Projects & Estimates", icon: Calculator, path: "/admin/estimates", permKey: "can_access_estimates" },
      { label: "Project Calendar", icon: Calendar, path: "/admin/calendar", permKey: "can_access_estimates" },
      { label: "Subcontractors", icon: Building2, path: "/admin/subcontractors", permKey: "can_access_estimates" },
      { label: "Sub Invoice Approvals", icon: Receipt, path: "/admin/sub-approvals", permKey: "can_access_estimates" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Team Access", icon: Settings, path: "/admin/team", permKey: "can_access_team" },
      { label: "Tracking & Code", icon: Tag, path: "/admin/tracking", permKey: "can_access_tracking" },
      { label: "Company Profile", icon: Globe, path: "/admin/profile", permKey: null },
    ],
  },
];

const SESSION_KEY = "coen_admin_session";

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function hasPermission(adminRecord, permKey) {
  if (!permKey) return true;
  if (adminRecord?.role === "admin") return true;
  return adminRecord?.[permKey] === true;
}

function NavItem({ label, icon: Icon, path, isActive, onClick }) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group ${
        isActive
          ? "bg-white/12 text-white shadow-sm"
          : "text-white/50 hover:text-white/90 hover:bg-white/6"
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-white" : "text-white/40 group-hover:text-white/70"}`} />
      <span className="truncate flex-1">{label}</span>
      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
    </Link>
  );
}

export default function AdminHub() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({ "Overview": true, "Business": true, "Content & SEO": true, "Estimating": true, "System": false });

  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => base44.entities.CompanyProfile.list(),
  });
  const logoUrl = profiles[0]?.logo_url || null;

  const isNavItemActive = (path) =>
    location.pathname === path || (path !== "/admin" && location.pathname.startsWith(path));

  const currentNavItem = NAV_GROUPS.flatMap(g => g.items)
    .filter(item => item.path.startsWith("/admin"))
    .sort((a, b) => b.path.length - a.path.length)
    .find(item => location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path)));
  const canAccessCurrentRoute = currentNavItem ? hasPermission(adminUser, currentNavItem.permKey) : true;

  useEffect(() => {
    const session = getSession();
    if (!session?.id) { setAuthLoading(false); return; }
    base44.functions.invoke("adminAuth", { action: "verifySession" })
      .then(res => {
        if (res.data?.error) {
          clearSession();
        } else {
          const freshUser = { ...session, ...res.data, session_token: session.session_token };
          saveSession(freshUser);
          setAdminUser(freshUser);
          if (freshUser.role === "estimator") navigate("/admin");
        }
      })
      .catch(() => { clearSession(); setAdminUser(null); })
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogin = (user) => {
    saveSession(user);
    setAdminUser(user);
    if (user.role === "estimator") navigate("/admin");
  };

  const handleLogout = () => { clearSession(); setAdminUser(null); };

  const toggleGroup = (label) => setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1B2B3A" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!adminUser) return <AdminLogin onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-out
        lg:relative lg:translate-x-0 lg:shrink-0
        ${open ? "translate-x-0" : "-translate-x-full"}
      `} style={{ background: "#1B2B3A" }}>

        {/* Logo / Brand */}
        <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-9 max-w-[120px] object-contain" />
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-bold text-white text-sm shrink-0">
                  {profiles[0]?.company_name?.charAt(0) || "C"}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm leading-tight truncate">
                    {profiles[0]?.company_name || "Admin"}
                  </div>
                  <div className="text-white/35 text-[11px] font-medium">Control Panel</div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-white/30 hover:text-white p-1.5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Badge */}
        <div className="px-4 py-3 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/6">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${adminUser.role === 'admin' ? 'bg-primary' : 'bg-blue-500'}`}>
              {adminUser.name?.charAt(0) || adminUser.email?.charAt(0) || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-[13px] font-semibold truncate leading-tight">{adminUser.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                  adminUser.role === "admin" ? "bg-primary/30 text-primary" : "bg-blue-500/20 text-blue-300"
                }`}>{adminUser.role}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => hasPermission(adminUser, item.permKey));
            if (visibleItems.length === 0) return null;
            const isExpanded = expandedGroups[group.label] !== false;
            return (
              <div key={group.label} className="px-2 mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 group mb-0.5"
                >
                  <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.1em] group-hover:text-white/40 transition-colors">
                    {group.label}
                  </span>
                  <ChevronRight className={`w-3 h-3 text-white/20 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="space-y-0.5">
                    {visibleItems.map(({ label, icon, path }) => (
                      <NavItem
                        key={path}
                        label={label}
                        icon={icon}
                        path={path}
                        isActive={isNavItemActive(path)}
                        onClick={() => setOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/8 space-y-1 shrink-0">
          {adminUser.role === "admin" && (
            <Link
              to="/estimator"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-white hover:bg-white/6 transition-all"
            >
              <Calculator className="w-4 h-4" />
              <span>Estimating Suite →</span>
            </Link>
          )}
          <a
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-white hover:bg-white/6 transition-all"
          >
            <Bell className="w-4 h-4" />
            View Website ↗
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/8 px-4 py-3 lg:px-6 flex items-center gap-4" style={{ background: "#1B2B3A" }}>
          <button onClick={() => setOpen(true)} className="lg:hidden text-white/60 hover:text-white p-1.5 -ml-1.5 transition-colors shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 max-w-[140px] object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs hidden lg:block">Admin Hub</span>
                <span className="text-white/25 hidden lg:block">/</span>
                <span className="text-sm font-semibold text-white">
                  {NAV_GROUPS.flatMap(g => g.items).find(n => isNavItemActive(n.path))?.label || "Dashboard"}
                </span>
              </div>
            )}
          </div>
          <a href="/" className="text-xs text-white/40 hover:text-white transition-colors shrink-0">← Website</a>
        </header>

        <main className="flex-1 overflow-auto bg-[#F7F8FA]">
          {canAccessCurrentRoute ? (
            <Outlet context={{ adminUser }} />
          ) : (
            <div className="min-h-[60vh] flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h1 className="text-lg font-bold text-slate-800 mb-2">Access Restricted</h1>
                <p className="text-sm text-slate-500 leading-relaxed">Your account doesn't have permission to access this section. Contact an administrator to update your access.</p>
              </div>
            </div>
          )}
        </main>
      </div>
      <AiAssistant adminUser={adminUser} />
    </div>
  );
}