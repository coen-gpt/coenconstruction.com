import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import AiAssistant from "@/components/admin/AiAssistant";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Briefcase, ClipboardList, Building2,
  Settings, Wrench, Menu, X, ChevronRight, PackageSearch
} from "lucide-react";



const NAV = [
  { label: "Dashboard", path: "/estimator", icon: LayoutDashboard, exact: true },
  { label: "Projects", path: "/estimator/projects", icon: Briefcase },
  { label: "New Walkthrough", path: "/estimator/walkthrough", icon: ClipboardList },
  { label: "Toolbox", path: "/estimator/toolbox", icon: Wrench },
  { label: "MTO Generator", path: "/estimator/mto", icon: PackageSearch },
  { label: "SoW Generator", path: "/estimator/sow", icon: ClipboardList },
  { label: "Vendors", path: "/estimator/vendors", icon: Building2 },
];

export default function EstimatorLayout() {
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => base44.entities.CompanyProfile.list(),
  });
  const logoUrl = profiles[0]?.logo_url || null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, sticky column on desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-secondary text-white flex flex-col transition-transform duration-200
        md:relative md:translate-x-0 md:shrink-0
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-9 max-w-[120px] object-contain" />
          ) : (
            <>
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">C</div>
              <div>
                <div className="font-bold text-white text-sm leading-tight">Coen Construction</div>
                <div className="text-white/50 text-xs">Estimating Suite</div>
              </div>
            </>
          )}
          <button onClick={() => setOpen(false)} className="ml-auto md:hidden text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {NAV.map(({ label, path, icon: Icon, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <NavLink to="/admin" className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" /> Admin Hub
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-secondary px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="md:hidden text-white/70 hover:text-white p-1 touch-manipulation shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center justify-center md:justify-start">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 max-w-[140px] object-contain" />
            ) : (
              <span className="font-semibold text-white">Estimating Suite</span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50">
          <Outlet />
        </main>
      </div>

      <AiAssistant adminUser={currentUser} />
    </div>
  );
}