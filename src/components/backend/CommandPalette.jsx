import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Briefcase, CornerDownLeft } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { searchableDestinations, hasPermission } from "@/lib/backendNav";

/**
 * Global ⌘K palette: jump to any permitted page, or open a project by name.
 * Replaces the old always-on sidebar project list — same search power, less chrome.
 */
export default function CommandPalette({ open, onOpenChange, user }) {
  const navigate = useNavigate();
  const canEstimate = hasPermission(user, "can_access_estimates");

  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 300),
    staleTime: 30000,
    enabled: open && canEstimate,
  });

  const destinations = searchableDestinations(user);

  const go = (path) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and projects…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Go to">
          {destinations.map((d) => {
            const Icon = d.icon;
            return (
              <CommandItem
                key={d.path}
                value={`${d.label} ${d.group}`}
                onSelect={() => go(d.path)}
              >
                {Icon ? <Icon className="text-muted-foreground" /> : null}
                <span>{d.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{d.group}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {canEstimate && projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={p.id}
                value={`project ${p.client_name || ""} ${p.client_city || ""} ${p.client_address || ""} ${p.project_type || ""}`}
                onSelect={() => go(`/estimator/projects/${p.id}`)}
              >
                <Briefcase className="text-muted-foreground" />
                <span className="truncate">{p.client_name || "Untitled project"}</span>
                <span className="ml-auto text-xs text-muted-foreground truncate max-w-[40%]">
                  {p.project_type || p.client_city || ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center justify-end gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
        <CornerDownLeft className="w-3 h-3" aria-hidden="true" /> to open
      </div>
    </CommandDialog>
  );
}
