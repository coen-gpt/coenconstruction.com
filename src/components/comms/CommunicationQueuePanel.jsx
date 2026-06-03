import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, ChevronDown, ChevronUp, AlertTriangle, Clock,
  ArrowUpRight, Plus, Phone, Mail, MessageCircle, User, Globe, CheckCircle2
} from "lucide-react";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import LogContactModal from "./LogContactModal";
import DismissModal from "./DismissModal";
import ManualLogModal from "./ManualLogModal";

const CHANNEL_ICONS = {
  phone: Phone,
  email: Mail,
  text: MessageCircle,
  in_person: User,
  portal: Globe,
  other: MessageSquare,
};

function urgencyClass(item) {
  if (item.urgency === "high" || item.kind === "inbound") {
    return "border-l-4 border-l-red-400 bg-red-50";
  }
  const isOverdue = item.due_at && isPast(parseISO(item.due_at));
  if (isOverdue) return "border-l-4 border-l-orange-400 bg-orange-50";
  return "border-l-4 border-l-gray-200 bg-white";
}

function overdueLabel(due_at) {
  if (!due_at) return null;
  const d = parseISO(due_at);
  if (isPast(d)) return `Overdue ${formatDistanceToNow(d, { addSuffix: false })}`;
  return `Due ${formatDistanceToNow(d, { addSuffix: true })}`;
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    // inbound first
    const aInbound = a.kind === "inbound" ? 0 : 1;
    const bInbound = b.kind === "inbound" ? 0 : 1;
    if (aInbound !== bInbound) return aInbound - bInbound;
    // then high urgency
    const aHigh = a.urgency === "high" ? 0 : 1;
    const bHigh = b.urgency === "high" ? 0 : 1;
    if (aHigh !== bHigh) return aHigh - bHigh;
    // then by due_at ascending (oldest first)
    const aDate = a.due_at ? new Date(a.due_at) : new Date();
    const bDate = b.due_at ? new Date(b.due_at) : new Date();
    return aDate - bDate;
  });
}

export default function CommunicationQueuePanel({ items, loading, currentUser, onRefresh }) {
  const [collapsed, setCollapsed] = useState(false);
  const [logItem, setLogItem] = useState(null);
  const [dismissItem, setDismissItem] = useState(null);
  const [showManual, setShowManual] = useState(false);

  // Fetch projects for client names
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-comms"],
    queryFn: () => base44.entities.ContractorProject.list("-updated_date", 300),
    staleTime: 60_000,
  });
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const sorted = sortItems(items);
  const highCount = items.filter(i => i.urgency === "high" || i.kind === "inbound").length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-secondary text-sm">Communication Queue</h2>
            {items.length > 0 && (
              <span className="text-xs font-bold bg-indigo-600 text-white rounded-full px-2 py-0.5">{items.length}</span>
            )}
            {highCount > 0 && (
              <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> {highCount} urgent
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Client outreach queue — click a row to take action</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-7"
            onClick={e => { e.stopPropagation(); setShowManual(true); }}
          >
            <Plus className="w-3 h-3" /> Log Contact
          </Button>
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {loading && (
            <div className="py-8 text-center text-sm text-gray-400 animate-pulse">Loading queue…</div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm font-medium text-green-700">All clients contacted — nothing overdue</p>
              <p className="text-xs text-gray-400 mt-1">Run benchmarks to generate new communication prompts</p>
            </div>
          )}
          {!loading && sorted.map(item => {
            const project = item.project_id ? projectMap[item.project_id] : null;
            const ChanIcon = CHANNEL_ICONS[item.channel] || MessageSquare;
            const due = overdueLabel(item.due_at);

            return (
              <div key={item.id} className={`flex items-start gap-3 px-4 py-3 ${urgencyClass(item)}`}>
                {/* Kind/urgency indicator */}
                <div className="shrink-0 mt-0.5">
                  {item.kind === "inbound" || item.urgency === "high" ? (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-secondary">
                      {project?.client_name || "Unknown Client"}
                    </span>
                    {project?.project_type && (
                      <span className="text-xs text-gray-400">· {project.project_type}</span>
                    )}
                    {item.kind === "inbound" && (
                      <span className="text-xs bg-red-100 text-red-700 font-semibold px-1.5 py-0.5 rounded-full">INBOUND</span>
                    )}
                    {item.urgency === "high" && item.kind !== "inbound" && (
                      <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded-full">URGENT</span>
                    )}
                  </div>
                  <div className="text-sm text-secondary font-medium mt-0.5">{item.title}</div>
                  {item.prompt_detail && (
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.prompt_detail}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {item.channel && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <ChanIcon className="w-3 h-3" />
                        {item.channel}
                      </span>
                    )}
                    {due && (
                      <span className={`text-xs font-medium ${isPast(parseISO(item.due_at || new Date().toISOString())) ? "text-red-600" : "text-gray-500"}`}>
                        {due}
                      </span>
                    )}
                    {project && (
                      <Link
                        to={`/admin/projects/${item.project_id}`}
                        className="inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        View project <ArrowUpRight className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                    onClick={() => setLogItem(item)}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Log
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-gray-500"
                    onClick={() => setDismissItem(item)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {logItem && (
        <LogContactModal
          item={logItem}
          onClose={() => setLogItem(null)}
          onSaved={() => { setLogItem(null); onRefresh(); }}
        />
      )}
      {dismissItem && (
        <DismissModal
          item={dismissItem}
          onClose={() => setDismissItem(null)}
          onSaved={() => { setDismissItem(null); onRefresh(); }}
        />
      )}
      {showManual && (
        <ManualLogModal
          onClose={() => setShowManual(false)}
          onSaved={() => { setShowManual(false); onRefresh(); }}
        />
      )}
    </div>
  );
}