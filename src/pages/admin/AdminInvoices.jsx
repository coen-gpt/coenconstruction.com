import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceDetailDrawer from "@/components/invoices/InvoiceDetailDrawer";
import InvoiceStatsBar from "@/components/invoices/InvoiceStatsBar";
import InvoiceExclusionSettings from "@/components/invoices/InvoiceExclusionSettings";
import AttachmentViewerModal from "@/components/invoices/AttachmentViewerModal";
import { Button } from "@/components/ui/button";
import { RefreshCw, Mail, Settings, BarChart2, List, Calendar, CheckCircle, WifiOff } from "lucide-react";
import VendorDashboard from "@/components/invoices/VendorDashboard";
import InvoiceCalendar from "@/components/invoices/InvoiceCalendar";
import { useToast } from "@/components/ui/use-toast";


export default function AdminInvoices() {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [gmailEmail, setGmailEmail] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [attachmentViewerRecord, setAttachmentViewerRecord] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastFocusRef = useRef(null);
  const [exclusionKeywords, setExclusionKeywords] = useState([]);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'vendors' | 'calendar'
  const [projects, setProjects] = useState([]);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  useEffect(() => {
    base44.entities.ContractorProject.list('-created_date', 100)
      .then(setProjects).catch(() => {});
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.InvoiceRecord.list('-email_received_date', 500);
      setRecords(data);
    } catch (e) {
      toast({ title: "Error loading records", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const checkConnection = async () => {
    try {
      const res = await base44.functions.invoke('checkGmailConnection', {});
      if (res.data?.connected && res.data?.email) {
        setGmailEmail(res.data.email);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  useEffect(() => {
    // Load exclusion keywords from localStorage
    const saved = localStorage.getItem("invoice_exclusion_keywords");
    if (saved) {
      try {
        setExclusionKeywords(JSON.parse(saved));
      } catch {}
    }
    fetchRecords();
    checkConnection();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('scanGmailInvoices', { maxResults: 25, processLimit: 8, filterEmail: 'info@coenconstruction.com' });
      const d = res.data;
      toast({
        title: `Sync complete`,
        description: `Scanned ${d.scanned} emails, found ${d.new} new items.${d.remaining > 0 ? ` ${d.remaining} more ready for the next sync.` : ''}`
      });
      setGmailEmail(d.gmailEmail);
      await fetchRecords();
    } catch (e) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  };

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
    await base44.functions.invoke('updateInvoiceRecord', {
      id, updates, action_note: note,
      gmail_message_id: rec?.gmail_message_id
    });
    await fetchRecords();
    if (selectedRecord?.id === id) {
      const updated = records.find(r => r.id === id);
      if (updated) setSelectedRecord({ ...updated, ...updates });
    }
  };

  // Filter records based on exclusion keywords
  const filteredRecords = records.filter(record => {
    const text = [record.email_subject, record.vendor_name, record.email_snippet].join(' ').toLowerCase();
    return !exclusionKeywords.some(kw => text.includes(kw.toLowerCase()));
  });

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm border-l-4 border-l-primary/40">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Invoice Inbox</h1>
            <p className="text-xs text-gray-500">Scan Gmail for invoices, quotes & bills</p>
          </div>
        </div>
        <div className="mb-3" aria-live="polite">
          {gmailEmail ? (
            <span className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium max-w-full truncate" title="Gmail connected">
              <CheckCircle className="w-3 h-3 shrink-0" />
              <span>Connected</span>
              <span className="text-green-600 opacity-70">·</span>
              <span className="truncate">{gmailEmail}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2.5 py-1 rounded-full font-medium">
              <WifiOff className="w-3 h-3 shrink-0" />
              <span>Disconnected</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} title="Keyword exclusion settings" className="h-8">
            <Settings className="w-3.5 h-3.5" />
            {exclusionKeywords.length > 0 && <span className="ml-1 text-xs">{exclusionKeywords.length}</span>}
          </Button>
          <Button size="sm" onClick={handleSync} disabled={syncing} className="h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleResyncAttachments} disabled={resyncing} className="h-8 text-xs" aria-live="polite">
            <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? "animate-spin" : ""}`} />
            {resyncing ? "Resyncing…" : "Resync Attachments"}
          </Button>
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
      </div>

      {activeTab === 'inbox' && (
        <>
          <InvoiceStatsBar records={filteredRecords} />
          <InvoiceTable
            records={filteredRecords}
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