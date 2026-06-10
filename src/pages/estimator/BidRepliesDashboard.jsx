import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { RefreshCw, MailCheck } from "lucide-react";
import BidReplyStats from "@/components/estimator/bid-replies/BidReplyStats";
import BidReplyList from "@/components/estimator/bid-replies/BidReplyList";

function normalizeMtoReplies(records) {
  return records.flatMap((record) => (record.vendor_quotes || []).map((quote) => ({
    key: `mto-${record.id}-${quote.message_id}`,
    source_type: "Material Take-Off",
    project_title: record.title || "Untitled MTO",
    sender_name: quote.vendor_name,
    sender_email: quote.vendor_email,
    amount: quote.amount,
    quote_type: quote.quote_type,
    notes: quote.notes,
    body_snippet: quote.body_snippet,
    received_date: quote.received_date,
  })));
}

function normalizeSowReplies(records, projectsById) {
  return records.flatMap((record) => (record.sub_quotes || []).map((quote) => ({
    key: `sow-${record.id}-${quote.message_id}`,
    source_type: "Scope of Work",
    project_title: projectsById[record.project_id] || record.title || "Untitled SoW",
    sender_name: quote.sub_name,
    sender_email: quote.sub_email,
    amount: quote.amount,
    quote_type: quote.quote_type,
    notes: quote.notes,
    body_snippet: quote.body_snippet,
    received_date: quote.received_date,
  })));
}

export default function BidRepliesDashboard() {
  const [mtoRecords, setMtoRecords] = useState([]);
  const [sowRecords, setSowRecords] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [mtos, sows, projectList] = await Promise.all([
      base44.entities.SavedMTO.list("-updated_date", 100),
      base44.entities.SavedSoW.list("-updated_date", 100),
      adminEntities.ContractorProject.list("-updated_date", 200),
    ]);
    setMtoRecords(mtos);
    setSowRecords(sows);
    setProjects(projectList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const replies = useMemo(() => {
    const projectsById = Object.fromEntries(projects.map((project) => [project.id, project.client_name || project.description || project.project_type]));
    return [...normalizeMtoReplies(mtoRecords), ...normalizeSowReplies(sowRecords, projectsById)]
      .sort((a, b) => new Date(b.received_date || 0) - new Date(a.received_date || 0));
  }, [mtoRecords, sowRecords, projects]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-gray-50 min-h-screen space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MailCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pending Bid Replies</h1>
            <p className="text-sm text-gray-500">Scanned quote and bid replies from MTO and SoW requests that need review.</p>
          </div>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline" className="shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <BidReplyStats replies={replies} />
      <BidReplyList replies={replies} />
    </div>
  );
}