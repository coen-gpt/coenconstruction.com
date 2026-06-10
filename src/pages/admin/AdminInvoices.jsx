import { useState, useEffect, useRef, useCallback } from "react";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceDetailDrawer from "@/components/invoices/InvoiceDetailDrawer";
import InvoiceStatsBar from "@/components/invoices/InvoiceStatsBar";
import InvoiceExclusionSettings from "@/components/invoices/InvoiceExclusionSettings";
import AttachmentViewerModal from "@/components/invoices/AttachmentViewerModal";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Mail, Settings, BarChart2, List, Calendar, CheckCircle, WifiOff,
  MoreVertical, Paperclip, Sparkles, BellOff, Bell, FolderKanban
} from "lucide-react";
import ProjectCostsDashboard from "@/components/invoices/ProjectCostsDashboard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import VendorDashboard from "@/components/invoices/VendorDashboard";
import InvoiceCalendar from "@/components/invoices/InvoiceCalendar";
import { useToast } from "@/components/ui/use-toast";

const AUTO_SYNC_KEY = "invoice_last_autosync";
const AUTO_SYNC_THROTTLE_MS = 10 * 60 * 1000; // don't auto-sync more than every 10 min
const MAX_SYNC_ROUNDS = 3; // chain syncs to drain the backlog without hammering Gmail

export default function AdminInvoices() {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [labeling, setLabeling] = useState(false);
  const [matching, setMatching] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [gmailEmail, setGmailEmail] = useState(null);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [attachmentViewerRecord, setAttachmentViewerRecord] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastFocusRef = useRef(null);
  const [exclusionKeywords, setExclusionKeywords] = useState([]);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'vendors' | 'calendar'
  const [showLowPriority, setShowLowPriority] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  useEffect(() => {
    base44.entities.ContractorProject.list('-created_date', 100)
      .then(setProjects).catch(() => {});
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.InvoiceRecord.list('-email_received_date', 500);
      setRecords(data);
      setLoading(false);
      return data;
    } catch (e) {
      toast({ title: "Error loading records", description: e.message, variant: "destructive" });
      setLoading(false);
      return [];
    }
  }, [toast]);

  const checkConnection = async () => {
    try {
      const res = await base44.functions.invoke('checkGmailConnection', {});
      if (res.data?.connected && res.data?.email) {
        setGmailEmail(res.data.email);
        setConnectionChecked(true);
        return true;
      }
    } catch { /* treated as disconnected */ }
    setConnectionChecked(true);
    return false;
  };

  // Try to assign unmatched records to projects via PO / job name / address.
  const runProjectMatch = useCallback(async ({ silent = false } = {}) => {
    setMatching(true);
    let totalMatched = 0;
    try {
      for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
        const res = await base44.functions.invoke('matchInvoiceProjects', { batchSize: 6 });
        totalMatched += res.data?.matched || 0;
        if (!res.data?.remaining) break;
      }
      if (totalMatched > 0) {
        await fetchRecords();
        toast({
          title: `${totalMatched} item${totalMatched !== 1 ? 's' : ''} matched to projects`,
          description: "Review the suggestions in the Project Costs tab."
        });
      } else if (!silent) {
        toast({ title: "No new matches", description: "No PO or address matched an active project." });
      }
    } catch (e) {
      if (!silent) toast({ title: "Match scan failed", description: e.message, variant: "destructive" });
    }
    setMatching(false);
  }, [fetchRecords, toast]);

  // Label any records the AI hasn't triaged yet. Silent — runs in the background.
  const runAutoLabel = useCallback(async () => {
    setLabeling(true);
    try {
      for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
        const res = await base44.functions.invoke('autoLabelInvoices', { batchSize: 80 });
        if (!res.data?.labeled) break;
        await fetchRecords();
        if (!res.data?.remaining) break;
      }
    } catch { /* labeling is best-effort */ }
    setLabeling(false);
  }, [fetchRecords]);

  // One sync pass = scan up to 50 matching emails, process up to 8 new ones.
  // Chained rounds drain the backlog so the user never has to mash a button.
  const runSync = useCallback(async ({ silent = false } = {}) => {
    setSyncing(true);
    let totalNew = 0;
    try {
      for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
        const res = await base44.functions.invoke('scanGmailInvoices', {
          maxResults: 50, processLimit: 8, filterEmail: 'info@coenconstruction.com'
        });
        const d = res.data;
        totalNew += d.new || 0;
        if (d.gmailEmail) setGmailEmail(d.gmailEmail);
        if (d.lastSyncedAt) setLastSyncedAt(d.lastSyncedAt);
        if (!d.remaining) break;
      }
      localStorage.setItem(AUTO_SYNC_KEY, String(Date.now()));
      if (!silent || totalNew > 0) {
        toast({
          title: totalNew > 0 ? `${totalNew} new item${totalNew !== 1 ? 's' : ''} found` : "Inbox up to date",
          description: totalNew > 0 ? "New invoices were scanned from Gmail and labeled." : "No new invoices in Gmail."
        });
      }
      await fetchRecords();
      await runAutoLabel();
      await runProjectMatch({ silent: true });
    } catch (e) {
      if (!silent) toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  }, [fetchRecords, runAutoLabel, runProjectMatch, toast]);

  useEffect(() => {
    const saved = localStorage.getItem("invoice_exclusion_keywords");
    if (saved) {
      try { setExclusionKeywords(JSON.parse(saved)); } catch {}
    }

    (async () => {
      const data = await fetchRecords();
      const connected = await checkConnection();

      // Backfill labels for older records even if we skip the sync
      if (data.some(r => !r.priority)) runAutoLabel();

      if (!connected) return;
      const last = Number(localStorage.getItem(AUTO_SYNC_KEY) || 0);
      if (Date.now() - last < AUTO_SYNC_THROTTLE_MS) return;
      runSync({ silent: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResyncAttachments = async () => {
    setResyncing(true);
    toast({ title: "Resyncing attachments…", description: "Processing up to 20 records per batch." });
    try {
      const res = await base44.functions.invoke('resyncInvoiceAttachments', { batchSize: 20 });
      const d = res.data;
      toast({
        title: "Attachment resync complete",
        description: `Resynced ${d.updated} of ${d.total} attachments. ${d.unrecoverable > 0 ? `${d.unrecoverable} unrecoverable.` : ''}`
      });
      await fetchRecords();
    } catch (e) {
      toast({ title: "Resync failed", description: e.message, variant: "destructive" });
    }
    setResyncing(false);
  };

  const handleUpdateRecord = async (id, updates, note) => {
    const rec = records.find(r => r.id === id);
    let userEmail = null;
    try { userEmail = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || 'null')?.email || null; } catch {}
    await base44.functions.invoke('updateInvoiceRecord', {
      id, updates, action_note: note,
      gmail_message_id: rec?.gmail_message_id,
      user_email: userEmail
    });
    await fetchRecords();
    if (selectedRecord?.id === id) {
      const updated = records.find(r => r.id === id);
      if (updated) setSelectedRecord({ ...updated, ...updates });
    }
  };

  // Keyword exclusions hide records entirely; the low-priority filter just tucks
  // away noise (store receipts, phone notifications) behind a toggle.
  const filteredRecords = records.filter(record => {
    const text = [record.email_subject, record.vendor_name, record.email_snippet].join(' ').toLowerCase();
    return !exclusionKeywords.some(kw => text.includes(kw.toLowerCase()));
  });
  const lowPriorityCount = filteredRecords.filter(r => r.priority === 'low').length;
  const inboxRecords = showLowPriority ? filteredRecords : filteredRecords.filter(r => r.priority !== 'low');

  const syncStatusText = syncing
    ? 'Syncing Gmail…'
    : labeling
      ? 'AI labeling…'
      : lastSyncedAt
        ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
        : 'Auto-syncs on open';

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-50 min-h-screen">
      {/* Header — one compact row: identity, status, a single action */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">Invoice Inbox</h1>
              {!connectionChecked ? null : gmailEmail ? (
                <span className="inline-flex items-center gap-1 text-[11px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium" title={`Gmail connected · ${gmailEmail}`}>
                  <CheckCircle className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[180px]">{gmailEmail}</span>
                  <span className="sm:hidden">Connected</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                  <WifiOff className="w-3 h-3 shrink-0" />
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1" aria-live="polite">
              {(syncing || labeling) && <RefreshCw className="w-3 h-3 animate-spin shrink-0" />}
              {syncStatusText}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" onClick={() => runSync()} disabled={syncing} className="h-8 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span className="ml-1">{syncing ? "Syncing…" : "Sync"}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" title="More options">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={runAutoLabel} disabled={labeling}>
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> AI Auto-Label Records
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runProjectMatch()} disabled={matching}>
                  <FolderKanban className="w-3.5 h-3.5 mr-2" /> {matching ? "Matching projects…" : "Match Receipts to Projects"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleResyncAttachments} disabled={resyncing}>
                  <Paperclip className="w-3.5 h-3.5 mr-2" /> {resyncing ? "Resyncing…" : "Resync Attachments"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="w-3.5 h-3.5 mr-2" /> Exclusion Keywords{exclusionKeywords.length > 0 ? ` (${exclusionKeywords.length})` : ''}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto scrollbar-hide bg-white rounded-t-xl px-2 pt-1 shadow-sm">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'inbox' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <List className="w-3.5 h-3.5 shrink-0" /> <span>Invoice List</span>
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'calendar' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" /> <span>Payment Calendar</span>
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'vendors' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Vendor Dashboard</span><span className="sm:hidden">Vendors</span>
        </button>
        <button
          onClick={() => setActiveTab('costs')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'costs' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Project Costs</span><span className="sm:hidden">Costs</span>
          {filteredRecords.filter(r => r.project_match_status === 'suggested').length > 0 && (
            <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {filteredRecords.filter(r => r.project_match_status === 'suggested').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'inbox' && (
        <>
          {lowPriorityCount > 0 && (
            <button
              onClick={() => setShowLowPriority(v => !v)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border text-xs transition-colors ${
                showLowPriority
                  ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                {showLowPriority ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                {showLowPriority
                  ? `Showing ${lowPriorityCount} low-priority item${lowPriorityCount !== 1 ? 's' : ''} (receipts & notifications)`
                  : `${lowPriorityCount} low-priority item${lowPriorityCount !== 1 ? 's' : ''} hidden — store receipts & phone notifications`}
              </span>
              <span className="font-semibold text-primary">{showLowPriority ? 'Hide' : 'Show'}</span>
            </button>
          )}
          <InvoiceStatsBar records={inboxRecords} />
          <InvoiceTable
            records={inboxRecords}
            loading={loading}
            onSelect={(rec, triggerRef) => {
              lastFocusRef.current = triggerRef?.current || null;
              setSelectedRecord(rec);
            }}
            onOpenAttachments={(rec, triggerRef) => {
              lastFocusRef.current = triggerRef?.current || null;
              setAttachmentViewerRecord(rec);
            }}
            onUpdate={handleUpdateRecord}
            projects={projects}
          />
          {records.length > filteredRecords.length && (
            <div className="text-center py-6 text-xs text-gray-500 bg-gray-50 rounded-lg">
              {records.length - filteredRecords.length} invoice{records.length - filteredRecords.length !== 1 ? 's' : ''} hidden by exclusion filters
            </div>
          )}
        </>
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <InvoiceCalendar records={filteredRecords} onSelectDay={setSelectedCalendarDay} />

          {selectedCalendarDay && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-3">
                Invoices for {selectedCalendarDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredRecords
                  .filter(r => {
                    const dateStr = r.scheduled_payment_date || r.due_date;
                    return dateStr && new Date(dateStr).toDateString() === selectedCalendarDay.toDateString();
                  })
                  .map(r => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRecord(r)}
                      className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border border-gray-200"
                    >
                      <div className="font-medium text-gray-900">{r.vendor_name || r.vendor_email}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.invoice_number || r.email_subject}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-gray-700">${(r.amount || 0).toLocaleString()}</span>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          r.status === 'approved' ? 'bg-green-100 text-green-700' :
                          r.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                          r.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'vendors' && <VendorDashboard records={filteredRecords} />}

      {activeTab === 'costs' && (
        <ProjectCostsDashboard
          records={filteredRecords}
          projects={projects}
          onUpdate={handleUpdateRecord}
          onSelectRecord={(rec) => setSelectedRecord(rec)}
          onRunMatch={() => runProjectMatch()}
          matching={matching}
        />
      )}

      {attachmentViewerRecord && (
        <AttachmentViewerModal
          record={attachmentViewerRecord}
          onClose={() => setAttachmentViewerRecord(null)}
          lastFocusRef={lastFocusRef}
        />
      )}

      {selectedRecord && (
        <InvoiceDetailDrawer
          record={selectedRecord}
          onClose={() => { setSelectedRecord(null); lastFocusRef.current?.focus(); }}
          onUpdate={handleUpdateRecord}
          onRefresh={fetchRecords}
          projects={projects}
        />
      )}

      <InvoiceExclusionSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(kw) => setExclusionKeywords(kw)}
      />
    </div>
  );
}
