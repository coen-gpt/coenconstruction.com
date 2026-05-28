import React, { useState, useMemo, useRef } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import { Pin, PinOff, ChevronUp, ChevronDown, Search, AlertTriangle, MoreHorizontal, CheckSquare, Square, Paperclip, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 50;

const SORT_FIELDS = {
  email_received_date: "Date Received",
  invoice_date: "Invoice Date",
  vendor_name: "Vendor",
  amount: "Amount",
  status: "Status",
  ai_classified_category: "Trade/Service",
};

const TRADE_CATEGORIES = [
  "Lumber & Building Materials", "Electrical", "Plumbing", "HVAC", "Roofing",
  "Flooring", "Hardware", "Paint", "Concrete & Masonry", "General Supply", "Other"
];

export default function InvoiceTable({ records, loading, onSelect, onOpenAttachments, onUpdate, projects = [] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortField, setSortField] = useState("email_received_date");
  const [sortDir, setSortDir] = useState("desc");
  const [groupByVendor, setGroupByVendor] = useState(false);
  const [groupByTrade, setGroupByTrade] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkTrade, setBulkTrade] = useState("");
  const [showBulkTradeModal, setShowBulkTradeModal] = useState(false);
  const [tradeFilter, setTradeFilter] = useState("all");
  const rowRefs = useRef({});

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const handleBulkAction = async (status) => {
    setBulkUpdating(true);
    await Promise.all([...selectedIds].map(id => onUpdate(id, { status }, `Bulk: ${status}`)));
    setSelectedIds(new Set());
    setBulkUpdating(false);
  };

  const handleBulkAssignTrade = async () => {
    if (!bulkTrade) return;
    setBulkUpdating(true);
    await Promise.all([...selectedIds].map(id => onUpdate(id, { ai_classified_category: bulkTrade }, `Bulk trade: ${bulkTrade}`)));
    setSelectedIds(new Set());
    setBulkTrade("");
    setShowBulkTradeModal(false);
    setBulkUpdating(false);
  };

  const handleBulkImportVendors = async () => {
    setBulkUpdating(true);
    const { base44 } = await import("@/api/base44Client");
    
    for (const recordId of selectedIds) {
      const record = records.find(r => r.id === recordId);
      if (!record || (!record.vendor_name && !record.vendor_email)) continue;

      try {
        const matches = record.vendor_email 
          ? await base44.entities.Vendor.filter({ email: record.vendor_email })
          : [];
        const existing = matches[0] || null;

        const vendorData = {
          company_name: record.vendor_name || "Unknown",
          contact_name: "",
          email: record.vendor_email || "",
          phone: record.vendor_phone || "",
          address: "",
          category: record.ai_classified_category || record.vendor_category || "General Supply",
          notes: `Imported from invoice #${record.invoice_number || "unknown"}`,
          active: true
        };

        if (existing) {
          await base44.entities.Vendor.update(existing.id, vendorData);
        } else {
          await base44.entities.Vendor.create(vendorData);
        }
      } catch (e) {
        console.error(`Failed to import vendor ${record.vendor_name}:`, e);
      }
    }

    setSelectedIds(new Set());
    setBulkUpdating(false);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const isOverdue = (r) => {
    if (r.status === 'paid' || r.status === 'rejected') return false;
    if (!r.email_received_date) return false;
    return differenceInDays(new Date(), parseISO(r.email_received_date)) > 30;
  };

  const filtered = useMemo(() => {
    let list = [...records];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.vendor_name || '').toLowerCase().includes(q) ||
        (r.invoice_number || '').toLowerCase().includes(q) ||
        (r.email_subject || '').toLowerCase().includes(q) ||
        (r.vendor_email || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter(r => r.status === filterStatus);
    if (filterType !== 'all') list = list.filter(r => r.document_type === filterType);

    list.sort((a, b) => {
      // Pinned always first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Overdue highlight
      const aO = isOverdue(a), bO = isOverdue(b);
      if (aO && !bO) return -1;
      if (!aO && bO) return 1;

      let av = a[sortField] || '';
      let bv = b[sortField] || '';
      if (sortField === 'amount') { av = Number(av) || 0; bv = Number(bv) || 0; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    // Deduplicate: keep most recent for each vendor + invoice_number combo
    const seen = new Map();
    list = list.filter(r => {
      if (!r.invoice_number) return true; // Keep items with no invoice number
      const vendor = r.vendor_name || r.vendor_email || 'Unknown';
      const key = `${vendor}|${r.invoice_number}`;
      if (!seen.has(key)) {
        seen.set(key, r);
        return true;
      }
      // Keep the most recent one by email_received_date
      const existing = seen.get(key);
      const existingDate = existing.email_received_date ? parseISO(existing.email_received_date) : new Date(0);
      const newDate = r.email_received_date ? parseISO(r.email_received_date) : new Date(0);
      if (newDate > existingDate) {
        seen.set(key, r);
        return true;
      }
      return false;
    });

    return list;
  }, [records, search, filterStatus, filterType, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  React.useEffect(() => { setPage(1); }, [search, filterStatus, filterType, sortField, sortDir, groupByVendor, groupByTrade, tradeFilter]);

  const grouped = useMemo(() => {
    if (!groupByVendor && !groupByTrade) return null;
    const map = {};
    for (const r of filtered) {
      const key = groupByTrade 
        ? (r.ai_classified_category || r.vendor_category || 'Unclassified')
        : (r.vendor_name || r.vendor_email || 'Unknown');
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    
    // Sort trades using predefined order, unclassified last
    if (groupByTrade) {
      const tradeOrder = TRADE_CATEGORIES;
      const sorted = {};
      tradeOrder.forEach(t => {
        if (map[t]) sorted[t] = map[t];
      });
      if (map['Unclassified']) sorted['Unclassified'] = map['Unclassified'];
      Object.keys(map).forEach(k => {
        if (!sorted[k]) sorted[k] = map[k];
      });
      return sorted;
    }
    
    return map;
  }, [filtered, groupByVendor, groupByTrade]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const Th = ({ field, label }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">{label} <SortIcon field={field} /></span>
    </th>
  );

  const renderRow = (r) => {
    const overdue = isOverdue(r);
    const isSelected = selectedIds.has(r.id);
    const hasAtts = (r.attachment_names?.length > 0) || (r.attachment_urls?.length > 0);
    const attCount = r.attachment_urls?.length || r.attachment_names?.length || 0;
    if (!rowRefs.current[r.id]) rowRefs.current[r.id] = React.createRef();

    return (
      <tr
        key={r.id}
        ref={rowRefs.current[r.id]}
        onClick={() => onSelect(r, rowRefs.current[r.id])}
        className={`border-b border-gray-100 cursor-pointer transition-colors
          ${isSelected ? 'bg-primary/5' : r.pinned ? 'bg-amber-50 hover:bg-amber-100' : overdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
      >
        <td className="px-3 py-2.5 w-8" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
          {isSelected
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {r.pinned && <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
            {overdue && !r.pinned && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
            <span className="font-medium text-sm text-gray-900 truncate max-w-[140px]">{r.vendor_name || r.vendor_email || '—'}</span>
            {hasAtts && (
              <button
                title={`${attCount} attachment(s)`}
                onClick={e => { e.stopPropagation(); onOpenAttachments?.(r, rowRefs.current[r.id]); }}
                className="inline-flex items-center gap-0.5 ml-0.5 text-blue-500 hover:text-blue-700 relative shrink-0"
              >
                <Paperclip className="w-3 h-3" />
                {attCount > 1 && <span className="text-[9px] font-bold">{attCount}</span>}
              </button>
            )}
          </div>
          {r.attachment_unrecoverable && (
            <div className="text-[10px] text-gray-400 pl-5 mt-0.5">⚠ Attachment unavailable</div>
          )}
          <div className="text-xs text-gray-400 truncate max-w-[160px] pl-5">{r.vendor_email}</div>
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-600">{r.invoice_number || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
          {r.invoice_date ? format(parseISO(r.invoice_date), 'MMM d, yyyy') : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
          {r.email_received_date ? format(parseISO(r.email_received_date), 'MMM d, yyyy') : '—'}
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-600">
          {r.amount ? `$${Number(r.amount).toLocaleString()}` : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium
            ${r.document_type === 'invoice' ? 'bg-blue-50 text-blue-700' :
              r.document_type === 'proposal' ? 'bg-purple-50 text-purple-700' :
              r.document_type === 'quote' ? 'bg-cyan-50 text-cyan-700' :
              r.document_type === 'bill' ? 'bg-orange-50 text-orange-700' :
              'bg-gray-50 text-gray-600'}`}>
            {r.document_type}
          </span>
        </td>
        <td className="px-3 py-2.5"><InvoiceStatusBadge status={r.status} /></td>
        <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">
          {projects.find(p => p.id === r.project_id)?.client_name || <span className="text-gray-200">—</span>}
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-400">
          <span className={overdue ? 'text-red-600 font-semibold' : ''}>
            {r.email_received_date ? `${differenceInDays(new Date(), parseISO(r.email_received_date))}d ago` : '—'}
          </span>
        </td>
        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'approved' }, 'Marked approved')}>✅ Approve</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'paid' }, 'Marked paid')}>💰 Mark Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'outstanding' }, 'Marked outstanding')}>⚠️ Outstanding</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'on_hold' }, 'Placed on hold')}>⏸ On Hold</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'rejected' }, 'Rejected')}>❌ Reject</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onUpdate(r.id, { pinned: !r.pinned }, r.pinned ? 'Unpinned' : 'Pinned')}>
                  {r.pinned ? <><PinOff className="w-3.5 h-3.5 mr-1.5" /> Unpin</> : <><Pin className="w-3.5 h-3.5 mr-1.5" /> Pin</>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
    );
  };

  const renderMobileCard = (r) => {
    const overdue = isOverdue(r);
    const isSelected = selectedIds.has(r.id);
    const hasAtts = (r.attachment_names?.length > 0) || (r.attachment_urls?.length > 0);
    const attCount = r.attachment_urls?.length || r.attachment_names?.length || 0;
    if (!rowRefs.current[r.id]) rowRefs.current[r.id] = React.createRef();

    return (
      <div
        key={r.id}
        ref={rowRefs.current[r.id]}
        onClick={() => onSelect(r, rowRefs.current[r.id])}
        className={`p-3 cursor-pointer transition-colors border-b border-gray-100 ${isSelected ? 'bg-primary/5' : overdue ? 'bg-red-50' : r.pinned ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={e => { e.stopPropagation(); toggleSelect(r.id); }} className="shrink-0">
              {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-gray-300" />}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {r.pinned && <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                {overdue && !r.pinned && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className="font-semibold text-sm text-gray-900 truncate">{r.vendor_name || r.vendor_email || '—'}</span>
                {hasAtts && (
                  <button
                    title={`${attCount} attachment(s)`}
                    onClick={e => { e.stopPropagation(); onOpenAttachments?.(r, rowRefs.current[r.id]); }}
                    className="inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-700 shrink-0"
                  >
                    <Paperclip className="w-3 h-3" />
                    {attCount > 1 && <span className="text-[9px] font-bold">{attCount}</span>}
                  </button>
                )}
              </div>
              {r.attachment_unrecoverable && (
                <div className="text-[10px] text-gray-400 mt-0.5">⚠ Attachment unavailable</div>
              )}
              <div className="text-xs text-gray-400 truncate">{r.vendor_email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <InvoiceStatusBadge status={r.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'approved' }, 'Marked approved')}>✅ Approve</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'paid' }, 'Marked paid')}>💰 Mark Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'outstanding' }, 'Marked outstanding')}>⚠️ Outstanding</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'on_hold' }, 'Placed on hold')}>⏸ On Hold</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(r.id, { status: 'rejected' }, 'Rejected')}>❌ Reject</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onUpdate(r.id, { pinned: !r.pinned }, r.pinned ? 'Unpinned' : 'Pinned')}>
                  {r.pinned ? <><PinOff className="w-3.5 h-3.5 mr-1.5" />Unpin</> : <><Pin className="w-3.5 h-3.5 mr-1.5" />Pin</>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs ml-6">
          <div><span className="text-gray-400">Invoice #</span><div className="font-medium text-gray-700 truncate">{r.invoice_number || '—'}</div></div>
          <div><span className="text-gray-400">Amount</span><div className="font-medium text-gray-700">{r.amount ? `$${Number(r.amount).toLocaleString()}` : '—'}</div></div>
          <div><span className="text-gray-400">Age</span><div className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-700'}`}>{r.email_received_date ? `${differenceInDays(new Date(), parseISO(r.email_received_date))}d` : '—'}</div></div>
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-3 py-3 border-b border-gray-100 space-y-2">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder="Search vendor, invoice #, subject…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8 text-xs flex-1 min-w-[110px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="outstanding">Outstanding</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-28 h-8 text-xs flex-1 min-w-[90px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="quote">Quote</SelectItem>
              <SelectItem value="bill">Bill</SelectItem>
              <SelectItem value="receipt">Receipt</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={groupByVendor ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setGroupByVendor(v => !v); setGroupByTrade(false); }}
          >
            Group by Vendor
          </Button>
          <Button
            variant={groupByTrade ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setGroupByTrade(v => !v); setGroupByVendor(false); setTradeFilter("all"); }}
          >
            Group by Trade
          </Button>
          {groupByTrade && (
            <Select value={tradeFilter} onValueChange={setTradeFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Filter trades…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {TRADE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                <SelectItem value="Unclassified">Unclassified</SelectItem>
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} records</span>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-3 bg-primary/5 border-b border-primary/20 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-primary">{selectedIds.size} selected</span>
            <div className="flex gap-1.5 ml-2 flex-wrap">
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleBulkAction('approved')} disabled={bulkUpdating}>✅ Approve</Button>
              <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => handleBulkAction('paid')} disabled={bulkUpdating}>💰 Mark Paid</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkAction('outstanding')} disabled={bulkUpdating}>⚠️ Outstanding</Button>
              <Button size="sm" variant="outline" className="h7 text-xs" onClick={() => handleBulkAction('on_hold')} disabled={bulkUpdating}>⏸ On Hold</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200" onClick={() => handleBulkAction('rejected')} disabled={bulkUpdating}>❌ Reject</Button>
            </div>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowBulkTradeModal(true)} disabled={bulkUpdating}>
              📊 Assign Trade
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-blue-50 border-blue-200" onClick={handleBulkImportVendors} disabled={bulkUpdating}>
              📋 Import to Vendors
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Trade Modal */}
      {showBulkTradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowBulkTradeModal(false)} />
          <div className="relative bg-white rounded-lg shadow-lg p-5 max-w-xs">
            <h3 className="font-bold text-sm mb-3">Assign Trade to {selectedIds.size} invoices</h3>
            <Select value={bulkTrade} onValueChange={setBulkTrade}>
              <SelectTrigger className="h-8 text-xs mb-4"><SelectValue placeholder="Select trade…" /></SelectTrigger>
              <SelectContent>
                {TRADE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowBulkTradeModal(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleBulkAssignTrade} disabled={!bulkTrade || bulkUpdating}>Assign</Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile card list / Desktop table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading records…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-sm text-gray-400 gap-1">
          <span>No records found.</span>
          <span className="text-xs">Run a sync to scan your Gmail inbox.</span>
        </div>
      ) : (
        <>
          {/* Mobile: card view */}
          <div className="sm:hidden divide-y divide-gray-100">
            {!groupByVendor && !groupByTrade ? (
              paginated.map(renderMobileCard)
            ) : (
              Object.entries(grouped)
                .filter(([key]) => tradeFilter === 'all' || key === tradeFilter)
                .map(([key, rows]) => {
                  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                  return (
                    <div key={`mobile-group-${key}`}>
                      <div className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">
                        {key} <span className="font-normal text-gray-400">({rows.length})</span>
                      </div>
                      {paginatedRows.map(renderMobileCard)}
                    </div>
                  );
                })
            )}
          </div>

          {/* Desktop: table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-700">
                      {selectedIds.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <Th field="vendor_name" label="Vendor" />
                  <Th field="invoice_number" label="Invoice #" />
                  <Th field="invoice_date" label="Invoice Date" />
                  <Th field="email_received_date" label="Received" />
                  <Th field="amount" label="Amount" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Type</th>
                  <Th field="status" label="Status" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Project</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Age</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {!groupByVendor && !groupByTrade ? (
                  paginated.map(renderRow)
                ) : (
                  Object.entries(grouped)
                    .filter(([key]) => tradeFilter === 'all' || key === tradeFilter)
                    .map(([key, rows]) => {
                      const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                      return (
                        <React.Fragment key={`group-${key}`}>
                          <tr className="bg-gray-50">
                            <td colSpan={11} className="px-3 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">
                              {key} <span className="font-normal text-gray-400">({rows.length} items)</span>
                            </td>
                          </tr>
                          {paginatedRows.map(renderRow)}
                        </React.Fragment>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-30 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-xs text-gray-600 px-1">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-30 transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>

    </>
  );
}