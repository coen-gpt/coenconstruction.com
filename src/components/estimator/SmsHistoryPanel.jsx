import { useState } from "react";
import adminEntities from '@/api/adminEntities';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, CheckCircle, Clock, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SmsHistoryPanel({ project }) {
  const [filter, setFilter] = useState("all");

  const { data: smsHistory, isLoading } = useQuery({
    queryKey: ["sms-history", project?.id],
    queryFn: async () => {
      const portals = await adminEntities.CustomerPortal.filter({
        project_id: project.id
      });
      const portal = portals[0];
      
      if (!portal) return [];
      
      const notes = portal.customer_notes || [];
      return notes
        .filter(n => n.note?.startsWith("SMS notification sent:"))
        .map(note => ({
          ...note,
          type: note.note.includes("Milestone") ? "milestone" : "status",
          status: note.note.split(":")[1]?.trim() || "unknown"
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    enabled: !!project?.id,
  });

  const filteredHistory = filter === "all" 
    ? smsHistory 
    : smsHistory?.filter(h => h.type === filter);

  const stats = {
    total: smsHistory?.length || 0,
    status: smsHistory?.filter(h => h.type === "status").length || 0,
    milestone: smsHistory?.filter(h => h.type === "milestone").length || 0,
  };

  return (
    <Card className="border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            SMS Notification History
          </CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({stats.total})</SelectItem>
              <SelectItem value="status">Status ({stats.status})</SelectItem>
              <SelectItem value="milestone">Milestones ({stats.milestone})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading SMS history...</p>
          </div>
        ) : filteredHistory?.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No SMS notifications sent yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory?.map((sms, idx) => (
              <div 
                key={sms.id || idx} 
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-gray-100"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  sms.type === "status" 
                    ? "bg-blue-100 text-blue-600" 
                    : "bg-green-100 text-green-600"
                }`}>
                  {sms.type === "status" ? <Phone className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs ${
                      sms.type === "status" 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-green-100 text-green-700"
                    }`}>
                      {sms.type === "status" ? "Status Update" : "Milestone Complete"}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(sms.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{sms.note}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}