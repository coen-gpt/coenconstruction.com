import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import AdminLogin from "@/pages/admin/AdminLogin";
import AiAssistant from "@/components/admin/AiAssistant";
import BackendSidebar from "@/components/backend/BackendSidebar";
import BackendTopbar from "@/components/backend/BackendTopbar";
import BackendMobileNav from "@/components/backend/BackendMobileNav";
import CommandPalette from "@/components/backend/CommandPalette";
import FirstUseTour, { hasSeenTour, markTourSeen } from "@/components/backend/FirstUseTour";
import { visibleNav, hasPermission, canAccessPath, pageTitle } from "@/lib/backendNav";

function getSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
const saveSession = (u) => localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(u));
const clearSession = () => localStorage.removeItem(ADMIN_SESSION_KEY);

function NotAuthorized() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md text-center">
        <div className="text-3xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-secondary mb-2">Not authorized</h1>
        <p className="text-sm text-gray-500">
          Your account doesn’t have permission to view this section. Ask an administrator to update your team access if
          this is unexpected.
        </p>
      </div>
    </div>
  );
}

/**
 * Unified backend shell. One layout for the whole backend — the former /admin and
 * /estimator areas now share this chrome, with a single permission-filtered nav.
 * Auth is the existing custom admin session (coen_admin_session + adminAuth).
 */
export default function BackendLayout() {
  const location = useLocation();
  const { brandColor, logoUrl, companyName } = useCompanyBrand();
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Verify the existing session on mount (picks up permission/role changes).
  useEffect(() => {
    const session = getSession();
    if (!session?.session_token) {
      setAuthLoading(false);
      return;
    }
    base44.functions
      .invoke("adminAuth", { action: "verifySession" })
      .then((res) => {
        if (res.data?.error) {
          clearSession();
          setAdminUser(null);
        } else {
          const fresh = { ...session, ...res.data, session_token: session.session_token };
          saveSession(fresh);
          setAdminUser(fresh);
        }
      })
      .catch(() => {
        clearSession();
        setAdminUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // Background Office Calendar sync: while anyone with estimates access has
  // the backend open, walkthroughs added or moved on the shared Google
  // calendar flow into the app every ~20 minutes. The function throttles via
  // SyncState, so extra tabs/users only cost a cheap skipped call.
  useEffect(() => {
    if (!adminUser) return;
    if (adminUser.role !== "admin" && !adminUser.can_access_estimates) return;
    const run = () => {
      base44.functions.invoke("syncWalkthroughCalendar", { auto: true }).catch(() => { /* best-effort */ });
    };
    run();
    const id = setInterval(run, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [adminUser]);

  // ⌘K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Browser-tab title follows the active backend page.
  useEffect(() => {
    document.title = `${adminUser ? pageTitle(location.pathname) : "Sign In"} | Coen Construction`;
  }, [adminUser, location.pathname]);

  // First sign-in on this device → open the training tour for this user.
  useEffect(() => {
    if (adminUser && !hasSeenTour(adminUser)) setTourOpen(true);
  }, [adminUser]);

  const closeTour = () => {
    markTourSeen(adminUser);
    setTourOpen(false);
  };

  const handleLogin = (user) => {
    saveSession(user);
    setAdminUser(user);
  };
  const handleSignOut = () => {
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

  // Field crew share the same login but work in the crew app, not the office shell
  if (adminUser.role === "field_crew") {
    window.location.replace("/field");
    return null;
  }

  const groups = visibleNav(adminUser);
  const canEstimate = hasPermission(adminUser, "can_access_estimates");
  const allowed = canAccessPath(adminUser, location.pathname);
  const title = pageTitle(location.pathname);

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-secondary transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <BackendSidebar
          user={adminUser}
          groups={groups}
          brandColor={brandColor}
          logoUrl={logoUrl}
          companyName={companyName}
          canEstimate={canEstimate}
          onNavigate={() => setSidebarOpen(false)}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <BackendTopbar
          title={title}
          user={adminUser}
          brandColor={brandColor}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenTour={() => setTourOpen(true)}
          onSignOut={handleSignOut}
        />
        {/* pb keeps content clear of the mobile bottom tab bar */}
        <main className="flex-1 overflow-auto bg-gray-50 pb-20 lg:pb-0">
          {allowed ? <Outlet context={{ adminUser }} /> : <NotAuthorized />}
        </main>
      </div>

      <BackendMobileNav user={adminUser} brandColor={brandColor} onOpenMenu={() => setSidebarOpen(true)} />
      <AiAssistant adminUser={adminUser} notAuthorized={!allowed} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} user={adminUser} />
      <FirstUseTour user={adminUser} brandColor={brandColor} open={tourOpen} onClose={closeTour} />
    </div>
  );
}
