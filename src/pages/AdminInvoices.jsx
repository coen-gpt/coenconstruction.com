import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AttachmentPreviewModal from '@/components/invoices/AttachmentPreviewModal';
import {
  RefreshCw, Search, Paperclip, ChevronDown, ChevronUp, Mail, Filter
} from 'lucide-react';

const STATUS_COLORS = {
  pending_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  outstanding: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
  on_hold: 'bg-gray-100 text-gray-600',
};

const DOC_COLORS = {
  invoice: 'bg-purple-100 text-purple-700',
  quote: 'bg-cyan-100 text-cyan-700',
  proposal: 'bg-indigo-100 text-indigo-700',
  bill: 'bg-red-100 text-red-700',
  receipt: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatAmount(amount) {
  if (!amount) return '—';
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminInvoices() {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDocType, setFilterDocType] = useState('all');
  const [sortBy, setSortBy] = useState('email_received_date');
  const [sortDir, setSortDir] = useState('desc');
  const [previewInvoice, setPreviewInvoice] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.InvoiceRecord.list('-email_received_date', 200);
      setRecords(data);
    } catch (e) {
      toast({ title: 'Failed to load invoices', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSync = async () => {
    setSyncing(true);
    toast({ title: 'Scanning Gmail…', description: 'Checking for new invoices, quotes, and estimates.' });
    try {
      const res = await base44.functions.invoke('scanGmailInvoices', { maxResults: 50 });
      const d = res.data;
      toast({ title: 'Sync complete', description: `Scanned ${d.scanned} emails, found ${d.new} new records.` });
      await fetchRecords();
    } catch (e) {
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleResync = async () => {
    setResyncing(true);
    toast({ title: 'Resyncing attachments…', description: 'Processing up to 20 records per batch.' });
    try {
      const res = await base44.functions.invoke('resyncInvoiceAttachments', { batchSize: 20 });
      const d = res.data;
      toast({ title: 'Resync complete', description: `Updated ${d.updated} of ${d.total} records.` });
      await fetchRecords();
    } catch (e) {
      toast({ title: 'Resync failed', description: e.message, variant: 'destructive' });
    }
    setResyncing(false);
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  // Filter + sort
  const filtered = records
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.vendor_name?.toLowerCase().includes(q) ||
        r.vendor_email?.toLowerCase().includes(q) ||
        r.email_subject?.toLowerCase().includes(q) ||
        r.invoice_number?.toLowerCase().includes(q) ||
        r.email_snippet?.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchDoc = filterDocType === 'all' || r.document_type === filterDocType;
      return matchSearch && matchStatus && matchDoc;
    })
    .sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === 'amount') { va = Number(va) || 0; vb = Number(vb) || 0; }
      else { va = va || ''; vb = vb || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Invoice Inbox</h1>
            <p className="text-xs text-gray-500 mt-0.5">cole@coenconstruction.com · {records.length} records</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleResync} disabled={resyncing} className="h-8 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${resyncing ? 'animate-spin' : ''}`} />
              {resyncing ? 'Resyncing…' : 'Resync Attachments'}
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncing} className="h-8 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Gmail Now'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search vendor, subject, invoice #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={filterDocType} onValueChange={setFilterDocType}>
            <SelectTrigger className="h-8 text-xs w-36">
              <Filter className="w-3 h-3 mr-1.5" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="quote">Quote</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="bill">Bill</SelectItem>
              <SelectItem value="receipt">Receipt</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="outstanding">Outstanding</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Mail className="w-10 h-10 text-gray-200" />
            <p className="text-sm">No records found. Try syncing Gmail or adjusting filters.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium cursor-pointer whitespace-nowrap" onClick={() => toggleSort('vendor_name')}>
                  Vendor <SortIcon field="vendor_name" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium cursor-pointer whitespace-nowrap" onClick={() => toggleSort('email_subject')}>
                  Subject <SortIcon field="email_subject" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-2.5 font-medium cursor-pointer whitespace-nowrap" onClick={() => toggleSort('amount')}>
                  Amount <SortIcon field="amount" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium cursor-pointer whitespace-nowrap" onClick={() => toggleSort('email_received_date')}>
                  Received <SortIcon field="email_received_date" />
                </th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Status</th>
                <th className="text-center px-4 py-2.5 font-medium whitespace-nowrap">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(record => (
                <tr
                  key={record.id}
                  onClick={() => setPreviewInvoice(record)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-[160px]">{record.vendor_name || '—'}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[160px]">{record.vendor_email || ''}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="truncate text-gray-700">{record.email_subject || '—'}</div>
                    {record.invoice_number && (
                      <div className="text-xs text-gray-400">#{record.invoice_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs capitalize font-normal ${DOC_COLORS[record.document_type] || DOC_COLORS.other}`}>
                      {record.document_type || 'other'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {record.amount ? (
                      <span className="font-medium text-gray-900">{formatAmount(record.amount)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                    {formatDate(record.email_received_date)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs font-normal capitalize ${STATUS_COLORS[record.status] || STATUS_COLORS.pending_review}`}>
                      {record.status?.replace(/_/g, ' ') || 'pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(record.attachment_names?.length > 0 || record.attachment_urls?.length > 0) ? (
                      <span className="inline-flex items-center gap-1 text-blue-500 group-hover:text-blue-700">
                        <Paperclip className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          {Math.max(record.attachment_names?.length || 0, record.attachment_urls?.length || 0)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div className="px-4 py-2 text-xs text-gray-400 border-t bg-white">
          Showing {filtered.length} of {records.length} records
        </div>
      )}

      {/* Attachment Preview Modal */}
      <AttachmentPreviewModal
        invoice={previewInvoice}
        onClose={() => setPreviewInvoice(null)}
      />
    </div>
  );
}