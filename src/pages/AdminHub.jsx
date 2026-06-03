import { useState, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, BookOpen, Search, Calculator,
  Menu, X, ChevronRight, Bell, Settings, LogOut, Tag, Receipt, Star
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminLogin from "@/pages/admin/AdminLogin";
import AiAssistant from "@/components/admin/AiAssistant";
import { useQuery } from "@tanstack/react-query";

const NAV_GROUPS = [
  {
    label: "Core",
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
    label: "Content",
    items: [
      { label: "Blog Posts", icon: BookOpen, path: "/admin/blog", permKey: "can_access_blog" },
      { label: "CMS / Pages", icon: FileText, path: "/admin/cms", permKey: "can_access_cms" },
      { label: "SEO Tools", icon: Search, path: "/admin/seo", permKey: "can_access_seo" },
      { label: "Reviews", icon: Star, path: "/admin/reviews", permKey: null },
    ],
  },
  {
    label: "Estimating Suite",
    items: [
      { label: "Projects & Estimates", icon: Calculator, path: "/admin/projects", permKey: "can_access_estimates" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Team Access", icon: Settings, path: "/admin/team", permKey: "can_access_team" },
      { label: "Tracking & Code", icon: Tag, path: "/admin/tracking", permKey: "can_access_tracking" },
      { label: "Company Profile", icon: Settings, path: "/admin/profile", permKey: null },
    ],
  },
];

const SESSION_KEY = "coen_admin_session";

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function hasPermission(adminRecord, permKey) {
  if (!permKey) return true;
  if (adminRecord?.role === "admin") return true;
  return adminRecord?.[permKey] === true;
}

export default function AdminHub() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => base44.entities.CompanyProfile.list(),
  });
  const logoUrl = profiles[0]?.logo_url || null;

  const isNavItemActive = (path) => {
    return location.pathname === path || (path !== "/admin" && location.pathname.startsWith(path));
  };

  const currentNavItem = NAV_GROUPS.flatMap(g => g.items)
    .filter(item => item.path.startsWith("/admin"))
    .sort((a, b) => b.path.length - a.path.length)
    .find(item => location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path)));
  const canAccessCurrentRoute = currentNavItem ? hasPermission(adminUser, currentNavItem.permKey) : true;

  useEffect(() => {
    const session = getSession();
    if (!session?.id) {
      setAuthLoading(false);
      return;
    }
    // Re-verify session against server (picks up permission changes, deactivations)
    base44.functions.invoke("adminAuth", { action: "verifySession" })
      .then(res => {
        if (res.data?.error) {
          clearSession();
        } else {
          const freshUser = { ...session, ...res.data, session_token: session.session_token };
          saveSession(freshUser);
          setAdminUser(freshUser);
          if (freshUser.role === "estimator") {
            navigate("/admin");
          }
        }
      })
      .catch(() => {
        clearSession();
        setAdminUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogin = (user) => {
    saveSession(user);
    setAdminUser(user);
    if (user.role === "estimator") {
      navigate("/admin");
    }
  };

  const handleLogout = () => {
    clearSession();
    setAdminUser(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-secondary flex flex-col transform transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:w-64 lg:flex lg:z-auto`}>
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" className="h-10 max-w-[120px] object-contain" />
            ) : (
              <div>
                <div className="text-white font-bold text-xl leading-tight">Coen</div>
                <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Admin Panel</div>
              </div>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-white/60 hover:text-white p-2 -mr-2 touch-manipulation">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="text-white text-sm font-semibold truncate">{adminUser.name}</div>
          <div className="text-white/50 text-xs truncate">{adminUser.email}</div>
          <span className={`inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded capitalize ${
            adminUser.role === "admin" ? "bg-red-500/30 text-red-200" :
            adminUser.role === "estimator" ? "bg-blue-500/30 text-blue-200" :
            "bg-white/10 text-white/60"
          }`}>{adminUser.role}</span>
        </div>

        <nav className="flex-1 py-6 overflow-y-auto space-y-8">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => hasPermission(adminUser, item.permKey));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className="px-3">
                <div className="text-white/40 text-xs font-bold uppercase tracking-widest px-4 mb-3">{group.label}</div>
                <div className="space-y-1">
                  {visibleItems.map(({ label, icon: Icon, path }) => (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                        isNavItemActive(path)
                          ? "bg-primary text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{label}</span>
                      {isNavItemActive(path) && <ChevronRight className="w-4 h-4 ml-auto shrink-0" />}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <a href="/" target="_blank" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation">
            <Bell className="w-4 h-4 shrink-0" /> View Website ↗
          </a>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation">
            <LogOut className="w-4 h-4 shrink-0" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-secondary px-4 py-3 lg:px-6 flex items-center gap-4 sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="lg:hidden text-white/70 hover:text-white p-2 -ml-2 touch-manipulation shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          {/* Logo centered on mobile, left-aligned label on desktop */}
          <div className="flex-1 flex items-center justify-center lg:justify-start">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 max-w-[140px] object-contain" />
            ) : (
              <span className="text-sm font-semibold text-white">
                {NAV_GROUPS.flatMap(g => g.items).find(n => isNavItemActive(n.path))?.label || "Admin Dashboard"}
              </span>
            )}
          </div>
          <a href="/" className="text-xs text-white/60 hover:text-white transition-colors shrink-0">← Site</a>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50">
          {canAccessCurrentRoute ? (
            <Outlet context={{ adminUser }} />
          ) : (
            <div className="min-h-[60vh] flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md text-center">
                <div className="text-3xl mb-3">🔒</div>
                <h1 className="text-xl font-bold text-secondary mb-2">Not authorized</h1>
                <p className="text-sm text-gray-500">Your admin account does not have permission to access this section. Ask an administrator to update your team access if this is unexpected.</p>
              </div>
            </div>
          )}
        </main>
      </div>
      <AiAssistant adminUser={adminUser} />
    </div>
  );
}