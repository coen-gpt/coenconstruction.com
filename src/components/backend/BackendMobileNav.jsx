import { NavLink, useLocation } from "react-router-dom";
import { Zap, HardHat, Receipt, Users, ClipboardList, Plus, Menu } from "lucide-react";
import { hasPermission } from "@/lib/backendNav";

/**
 * Mobile bottom tab bar (hidden on lg+). The everyday destinations stay one
 * thumb-tap away; everything else lives behind Menu (the full drawer).
 * Slots are permission-filtered so each role sees only what they can open.
 */
const CANDIDATES = [
  { label: "Home", path: "/estimator", icon: Zap, perm: "can_access_estimates", exact: true },
  { label: "Jobs", path: "/estimator/jobs", icon: HardHat, perm: "can_access_estimates" },
  { label: "Invoices", path: "/admin/invoices", icon: Receipt, perm: "can_access_invoices" },
  { label: "Leads", path: "/admin/leads", icon: Users, perm: "can_access_leads" },
  { label: "Quotes", path: "/admin/estimates", icon: ClipboardList, perm: "can_access_estimates" },
];

function Tab({ to, icon: Icon, label, exact, brandColor }) {
  return (
    <NavLink to={to} end={exact} className="flex-1 min-w-0">
      {({ isActive }) => (
        <span className="flex flex-col items-center justify-center gap-0.5 h-full pt-1.5 pb-1">
          <Icon className="w-5 h-5" style={isActive ? { color: brandColor } : undefined} strokeWidth={isActive ? 2.5 : 2} />
          <span
            className={`text-[10px] leading-none font-semibold truncate max-w-full px-0.5 ${isActive ? "" : "text-gray-400"}`}
            style={isActive ? { color: brandColor } : undefined}
          >
            {label}
          </span>
        </span>
      )}
    </NavLink>
  );
}

export default function BackendMobileNav({ user, brandColor, onOpenMenu }) {
  const location = useLocation();
  const canEstimate = hasPermission(user, "can_access_estimates");
  const tabs = CANDIDATES.filter(c => hasPermission(user, c.perm)).slice(0, canEstimate ? 3 : 4);

  if (tabs.length === 0) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Quick navigation"
    >
      <div className="flex items-stretch h-14 text-gray-500">
        {tabs.slice(0, 2).map(t => (
          <Tab key={t.path} to={t.path} icon={t.icon} label={t.label} exact={t.exact} brandColor={brandColor} />
        ))}

        {/* Center CTA — Start New Job */}
        {canEstimate && (
          <NavLink to="/estimator/walkthrough" className="flex-1 min-w-0 flex flex-col items-center justify-center" aria-label="Start new job">
            <span
              className={`w-11 h-11 -mt-4 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-gray-50 active:scale-95 transition-transform ${
                location.pathname === "/estimator/walkthrough" ? "opacity-90" : ""
              }`}
              style={{ background: brandColor }}
            >
              <Plus className="w-6 h-6" />
            </span>
            <span className="text-[10px] leading-none font-semibold text-gray-400 mt-0.5">New Job</span>
          </NavLink>
        )}

        {tabs.slice(2).map(t => (
          <Tab key={t.path} to={t.path} icon={t.icon} label={t.label} exact={t.exact} brandColor={brandColor} />
        ))}

        <button onClick={onOpenMenu} className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-1" aria-label="Open full menu">
          <Menu className="w-5 h-5" />
          <span className="text-[10px] leading-none font-semibold text-gray-400">Menu</span>
        </button>
      </div>
    </nav>
  );
}
