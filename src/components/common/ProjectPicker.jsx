import { useEffect, useMemo, useRef, useState } from "react";
import adminEntities from "@/api/adminEntities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { MapPin, Briefcase } from "lucide-react";

const ACTIVE_STATUSES = new Set([
  "walkthrough", "draft", "sent", "pending_review", "approved", "modify",
  "in_progress", "on_hold", "completed", "imported",
]);

const isPickable = (p) => !p.status || ACTIVE_STATUSES.has(p.status);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Searchable project picker that scales to thousands of projects: shows the
 * most recent ones by default, and when the user types it searches the SERVER
 * (client name / address / city) instead of relying on whatever happens to be
 * loaded client-side. Falls back to filtering the preloaded list if the
 * server query fails.
 *
 * Props:
 *  - projects: preloaded recent projects (instant results, no spinner)
 *  - onSelect(project)
 *  - trigger: the element that opens the picker (rendered as PopoverTrigger)
 *  - align: popover alignment (default "end")
 */
export default function ProjectPicker({ projects = [], onSelect, trigger, align = "end" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [serverResults, setServerResults] = useState(null); // null = not searched
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const latestQuery = useRef("");

  const recent = useMemo(
    () => projects.filter(isPickable).slice(0, 20),
    [projects]
  );

  // Debounced server-side search — works no matter how many projects exist
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    latestQuery.current = term;
    if (term.length < 2) {
      setServerResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const rx = { $regex: escapeRegex(term), $options: "i" };
      try {
        const rows = await adminEntities.ContractorProject.filter(
          { $or: [{ client_name: rx }, { client_address: rx }, { client_city: rx }] },
          "-updated_date",
          30
        );
        if (latestQuery.current !== term) return; // stale response
        setServerResults((rows || []).filter(isPickable));
      } catch {
        // Server query unsupported/failed — filter what we have locally
        if (latestQuery.current !== term) return;
        const ql = term.toLowerCase();
        setServerResults(projects.filter(p => isPickable(p) &&
          [p.client_name, p.client_address, p.client_city, p.project_type]
            .join(" ").toLowerCase().includes(ql)
        ).slice(0, 30));
      }
      setSearching(false);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [q, open, projects]);

  const results = q.trim().length >= 2 ? (serverResults || []) : recent;

  const pick = (project) => {
    setOpen(false);
    setQ("");
    setServerResults(null);
    onSelect?.(project);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQ(""); setServerResults(null); } }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="p-0 w-80" align={align}>
        <Command shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Search customer, address, or city…"
          />
          <CommandList className="max-h-64">
            <CommandEmpty>
              {searching ? "Searching all projects…" : q.trim().length >= 2 ? "No matching projects" : "No recent projects"}
            </CommandEmpty>
            <CommandGroup heading={q.trim().length >= 2 ? (searching ? "Searching…" : "Matches") : "Recent projects"}>
              {results.map(p => (
                <CommandItem key={p.id} value={p.id} onSelect={() => pick(p)} className="flex flex-col items-start gap-0.5 py-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {p.client_name || "Untitled project"}
                    {p.project_type && <span className="text-xs font-normal text-gray-400">· {p.project_type}</span>}
                  </span>
                  {(p.client_address || p.client_city) && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 pl-5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {[p.client_address, p.client_city].filter(Boolean).join(", ")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t px-3 py-1.5 text-[10px] text-gray-400">
            Type 2+ characters to search every project — not just recent ones.
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
