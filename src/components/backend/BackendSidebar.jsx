import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Plus, ChevronDown, LogOut, ExternalLink, X } from "lucide-react";

const COLLAPSE_KEY = "backend_nav_collapsed";

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : { "Field Tools": true };
  } catch {
    return { "Field Tools": true };
  }
}

function NavItem({ item, brandColor, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.path} end={item.exact} onClick={onNavigate} className="block">
      {({ isActive }) => (
        <span
          className={`group flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
            isActive
              ? "text-white shadow-lg"
              : "text-white/55 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5"
          }`}
          style={isActive ? { background: `linear-gradient(90deg, ${brandColor} 0%, ${brandColor}cc 100%)`, boxShadow: `0 4px 14px ${brandColor}40` } : undefined}
        >
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              isActive ? "bg-white/20" : "bg-white/[0.06] group-hover:bg-white/10"
            }`}
          >
            {Icon ? <Icon className="w-4 h-4" /> : null}
          </span>
          <span className="truncate">{item.label}</span>
        </span>
      )}
    </NavLink>
  );
}

export default function BackendSidebar({
  user,
  groups,
  brandColor,
  logoUrl,
  companyName,
  canEstimate,
  onNavigate,
  onSignOut,
}) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggleGroup = (label) => {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const displayName = user?.name || user?.full_name || user?.email || "User";

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-secondary via-secondary to-[#14202c]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/10">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="h-9 max-w-[150px] object-contain" />
        ) : (
          <>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white text-sm shrink-0"
              style={{ background: brandColor }}
            >
              {companyName?.charAt(0) || "C"}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-sm leading-tight truncate">{companyName}</div>
              <div className="text-white/40 text-[11px] uppercase tracking-widest">Backend</div>
            </div>
          </>
        )}
        <button onClick={onNavigate} className="ml-auto lg:hidden text-white/40 hover:text-white shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary action */}
      {canEstimate && (
        <div className="px-3 pt-3 shrink-0">
          <NavLink
            to="/estimator/walkthrough"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: brandColor }}
          >
            <Plus className="w-4 h-4" /> Start New Job
          </NavLink>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {groups.map((group) => {
          const isCollapsible = group.collapsible;
          const isCollapsed = isCollapsible && collapsed[group.label];
          return (
            <div key={group.label}>
              {isCollapsible ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center gap-2 px-2 pb-2 group"
                  aria-expanded={!isCollapsed}
                >
                  <span className="text-[10px] font-bold text-white/35 uppercase tracking-[0.18em] group-hover:text-white/60 transition-colors whitespace-nowrap">
                    {group.label}
                  </span>
                  <span className="flex-1 h-px bg-white/[0.07]" />
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-white/35 group-hover:text-white/60 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <div className="flex items-center gap-2 px-2 pb-2">
                  <span className="text-[10px] font-bold text-white/35 uppercase tracking-[0.18em] whitespace-nowrap">{group.label}</span>
                  <span className="flex-1 h-px bg-white/[0.07]" />
                </div>
              )}
              {!isCollapsed && (
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavItem key={item.path} item={item} brandColor={brandColor} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: user + actions */}
      <div className="shrink-0 border-t border-white/10 p-3 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: brandColor }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-xs font-semibold truncate">{displayName}</div>
            <div className="text-white/40 text-[11px] capitalize">{user?.role || "user"}</div>
          </div>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" /> View website
        </a>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" /> Sign out
        </button>
      </div>
    </div>
  );
}
