import { Menu, Search, LogOut, ExternalLink, GraduationCap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function BackendTopbar({ title, user, brandColor, onOpenSidebar, onOpenSearch, onOpenTour, onSignOut }) {
  const displayName = user?.name || user?.full_name || user?.email || "User";

  return (
    <header className="sticky top-0 z-30 h-16 shrink-0 bg-white border-b border-gray-200 flex items-center gap-3 px-3 sm:px-5">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden text-gray-500 hover:text-secondary p-2.5 -ml-2 shrink-0 rounded-lg active:bg-gray-100"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-base sm:text-lg font-bold text-secondary truncate">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Search trigger (opens the ⌘K palette) */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 h-9 transition-colors"
          aria-label="Search pages and projects"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">Search…</span>
          <kbd className="hidden md:inline text-[10px] font-sans font-semibold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-white">
            ⌘K
          </kbd>
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 hover:opacity-90 transition-opacity"
              style={{ background: brandColor }}
              aria-label="Account menu"
            >
              {displayName.charAt(0).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate">{displayName}</span>
              <span className="text-xs font-normal text-muted-foreground truncate">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" /> View website
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenTour}>
              <GraduationCap className="w-4 h-4" /> App tour
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="w-4 h-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
