/**
 * New Quote — /estimator/quotes/new
 *
 * Standalone quote builder. Supports "Create Similar Quote":
 * /estimator/quotes/new?copy_from_quote_id=<estimateId> pre-fills the line
 * items and quote terms from the source quote, while the client, title and
 * quote number start fresh. Everything is in-memory until Save Quote, which
 * creates a new ContractorProject (the client record) + Estimate as fresh
 * rows with new IDs — nothing links back to the source quote.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichDescriptionInput from "@/components/estimator/RichDescriptionInput";
import AddressInput from "@/components/AddressInput";
import { ArrowLeft, Plus, Trash2, Save, Search, User, FileText, CopyPlus, Loader2, X } from "lucide-react";

const COST_TYPES = ["labor", "material", "subcontractor", "allowance", "other"];
const UNITS = ["each", "sq ft", "lin ft", "hr", "day", "ls", "ton", "cy", "bag", "gal"];
const PROJECT_TYPES = [
  "Home Addition", "Kitchen Remodel", "Bathroom Remodel", "Deck / Porch / Pergola",
  "Siding", "Custom Carpentry", "Snow Removal", "Full Home Renovation",
  "Roofing", "Flooring", "Other",
];

const EMPTY_CLIENT = {
  client_name: "",
  client_phone: "",
  client_email: "",
  client_address: "",
  client_city: "",
  client_zipcode: "",
};

function calcTotal(item) {
  const base = (item.quantity || 0) * (item.unit_cost || 0);
  return base * (1 + (item.markup_pct || 0) / 100);
}

function newItem(markup) {
  return {
    id: crypto.randomUUID(),
    parent_group: "",
    subgroup: "",
    title: "",
    description: "",
    quantity: 1,
    unit: "ls",
    unit_cost: 0,
    markup_pct: markup,
    total: 0,
    cost_type: "material",
    is_allowance: false,
    internal_notes: "",
  };
}

// Deep-copy a source line item as a fresh, unsaved row: new id, template
// fields only (actuals/job-costing data from the old quote never carries over).
function copyItem(src) {
  const item = {
    id: crypto.randomUUID(),
    parent_group: src.parent_group || "",
    subgroup: src.subgroup || "",
    title: src.title || "",
    description: src.description || "",
    quantity: src.quantity ?? 1,
    unit: src.unit || "ls",
    unit_cost: src.unit_cost ?? 0,
    markup_pct: src.markup_pct ?? 0,
    cost_type: src.cost_type || "material",
    is_allowance: src.is_allowance || false,
    internal_notes: src.internal_notes || "",
  };
  item.total = calcTotal(item);
  return item;
}

export default function NewQuote() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { brandColor } = useCompanyBrand();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get("copy_from_quote_id");

  const [client, setClient] = useState(EMPTY_CLIENT);
  const [clientSearch, setClientSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("");
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [markup, setMarkup] = useState(20);
  const [taxRate, setTaxRate] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Copy-from source quote (in-memory only — nothing is written) ──────────
  const { data: sourceQuote, isLoading: loadingSource } = useQuery({
    queryKey: ["quote-copy-source", copyFromId],
    enabled: !!copyFromId,
    queryFn: () => base44.entities.Estimate.filter({ id: copyFromId }).then((r) => r[0] || null),
  });

  useEffect(() => {
    if (seeded || !copyFromId) return;
    if (!sourceQuote) return;
    // Copied: line items (deep copy), markup, tax rate, contract/terms notes.
    // NOT copied: client, title, quote number/version, salesperson, status, dates.
    setItems((sourceQuote.line_items || []).map(copyItem));
    setNotes(sourceQuote.notes || "");
    setMarkup(sourceQuote.default_markup_pct ?? 20);
    setTaxRate(sourceQuote.tax_rate ?? 0);
    setSeeded(true);
  }, [sourceQuote, seeded, copyFromId]);

  // ── Existing clients (from projects) for the picker ───────────────────────
  const { data: projects = [] } = useQuery({
    queryKey: ["all-contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 500),
  });

  const clients = useMemo(() => {
    const seen = new Map();
    for (const p of projects) {
      if (!p.client_name) continue;
      const key = `${p.client_name.toLowerCase()}|${(p.client_email || p.client_phone || "").toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, {
          client_name: p.client_name,
          client_phone: p.client_phone || "",
          client_email: p.client_email || "",
          client_address: p.client_address || "",
          client_city: p.client_city || "",
          client_zipcode: p.client_zipcode || "",
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.client_name.localeCompare(b.client_name));
  }, [projects]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter((c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.client_email.toLowerCase().includes(q) ||
        c.client_city.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [clients, clientSearch]);

  useEffect(() => {
    const onClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pickClient = (c) => {
    setClient(c);
    setClientSearch("");
    setPickerOpen(false);
  };

  const updateClient = (field, val) => setClient((prev) => ({ ...prev, [field]: val }));

  // ── Line items ─────────────────────────────────────────────────────────────
  const updateItem = (id, field, val) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        updated.total = calcTotal(updated);
        return updated;
      })
    );
  };

  const addItem = () => setItems((prev) => [...prev, newItem(markup)]);
  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const grandTotal = items.reduce((sum, i) => sum + (i.total || 0), 0);

  // ── Save: the only point where records are created ─────────────────────────
  const handleSave = async () => {
    if (!client.client_name.trim()) {
      toast({ title: "Select a client", description: "Pick an existing client or enter a new client name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const projectPayload = {
        client_name: client.client_name.trim(),
        status: "draft",
      };
      for (const f of ["client_phone", "client_email", "client_address", "client_city", "client_zipcode"]) {
        if (client[f]?.trim()) projectPayload[f] = client[f].trim();
      }
      if (projectType) projectPayload.project_type = projectType;
      const project = await base44.entities.ContractorProject.create(projectPayload);

      const estimatePayload = {
        project_id: project.id,
        type: "original",
        status: "draft",
        line_items: items,
        grand_total: grandTotal,
        notes,
        default_markup_pct: markup,
      };
      if (title.trim()) estimatePayload.title = title.trim();
      if (taxRate) estimatePayload.tax_rate = taxRate;
      await base44.entities.Estimate.create(estimatePayload);

      await base44.entities.ContractorProject.update(project.id, {
        original_estimate_total: grandTotal,
        adjusted_total: grandTotal,
      });

      qc.invalidateQueries({ queryKey: ["all-estimates"] });
      qc.invalidateQueries({ queryKey: ["all-contractor-projects"] });
      toast({ title: "Quote created", description: `New quote for ${client.client_name} saved as draft.` });
      navigate(`/estimator/projects/${project.id}?tab=estimate`);
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/estimates" className="text-gray-400 hover:text-secondary" aria-label="Back to quotes">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-secondary flex items-center gap-2">
              {copyFromId ? <CopyPlus className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-primary" />}
              New Quote
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {copyFromId
                ? "Copied line items and terms — select a client and title to finish."
                : "Build a quote for a new or existing client."}
              <span className="ml-2 text-gray-400">Quote # v1 (auto-assigned on save)</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 text-white font-semibold" style={{ background: brandColor }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Quote"}
          </Button>
        </div>
      </div>

      {copyFromId && loadingSource && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading line items from the source quote…
        </div>
      )}
      {copyFromId && !loadingSource && !sourceQuote && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
          Source quote not found — starting with a blank quote instead.
        </div>
      )}

      {/* Client */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-secondary text-sm flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Client
        </h2>
        <div className="relative" ref={pickerRef}>
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            value={clientSearch}
            onChange={(e) => { setClientSearch(e.target.value); setPickerOpen(true); }}
            onFocus={() => setPickerOpen(true)}
            placeholder="Search existing clients…"
            className="pl-9"
            aria-label="Search existing clients"
          />
          {pickerOpen && filteredClients.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {filteredClients.map((c) => (
                <button
                  key={`${c.client_name}|${c.client_email}|${c.client_phone}`}
                  type="button"
                  onClick={() => pickClient(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <div className="font-medium text-sm text-secondary">{c.client_name}</div>
                  <div className="text-xs text-gray-400">
                    {[c.client_email, c.client_city].filter(Boolean).join(" · ") || "No contact info"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Client Name *</label>
            <div className="relative">
              <Input
                value={client.client_name}
                onChange={(e) => updateClient("client_name", e.target.value)}
                placeholder="Select a client above or type a new name"
              />
              {client.client_name && (
                <button
                  type="button"
                  onClick={() => setClient(EMPTY_CLIENT)}
                  className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500"
                  aria-label="Clear client"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Phone</label>
            <Input value={client.client_phone} onChange={(e) => updateClient("client_phone", e.target.value)} placeholder="(617) 555-0100" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <Input type="email" value={client.client_email} onChange={(e) => updateClient("client_email", e.target.value)} placeholder="client@email.com" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Address</label>
            <AddressInput
              className="h-10 rounded-md"
              value={client.client_address}
              onChange={(val) => updateClient("client_address", val)}
              onGeocode={(geo) =>
                setClient((c) => ({
                  ...c,
                  client_city: c.client_city || geo.city || "",
                  client_zipcode: c.client_zipcode || geo.zip || "",
                }))
              }
              placeholder="Street address"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">City</label>
            <Input value={client.client_city} onChange={(e) => updateClient("client_city", e.target.value)} placeholder="City" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Zip</label>
            <Input value={client.client_zipcode} onChange={(e) => updateClient("client_zipcode", e.target.value)} placeholder="Zip code" />
          </div>
        </div>
      </div>

      {/* Quote details */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-secondary text-sm">Quote Details</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kitchen Remodel" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Project Type</label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger><SelectValue placeholder="Select project type…" /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Default Markup %</label>
            <Input type="number" value={markup} onChange={(e) => setMarkup(Number(e.target.value))} className="text-center" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tax Rate %</label>
            <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="text-center" />
          </div>
        </div>
      </div>

      {/* Grand total bar */}
      <div className="bg-secondary text-white rounded-xl px-5 py-3 flex justify-between items-center">
        <span className="font-semibold">Grand Total</span>
        <span className="text-2xl font-bold text-primary">
          ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Line items */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-muted border-b border-gray-100">
          <h2 className="font-semibold text-secondary text-sm">Line Items ({items.length})</h2>
          <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Line Item
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="font-medium">No line items yet.</p>
            <p className="text-sm mt-1">Click "Add Line Item" to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className="p-4 grid gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 block mb-1">Title</label>
                    <Input value={item.title} onChange={(e) => updateItem(item.id, "title", e.target.value)} className="h-8 text-sm" placeholder="Line item title" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Group</label>
                    <Input value={item.parent_group} onChange={(e) => updateItem(item.id, "parent_group", e.target.value)} className="h-8 text-sm" placeholder="e.g. Demolition" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Cost Type</label>
                    <Select value={item.cost_type} onValueChange={(v) => updateItem(item.id, "cost_type", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COST_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Description</label>
                  <RichDescriptionInput
                    value={item.description || ""}
                    onChange={(val) => updateItem(item.id, "description", val)}
                  />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Qty</label>
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))} className="h-8 text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Unit</label>
                    <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Unit Cost</label>
                    <Input type="number" value={item.unit_cost} onChange={(e) => updateItem(item.id, "unit_cost", Number(e.target.value))} className="h-8 text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Markup %</label>
                    <Input type="number" value={item.markup_pct} onChange={(e) => updateItem(item.id, "markup_pct", Number(e.target.value))} className="h-8 text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Total</label>
                    <div className="h-8 flex items-center px-2 bg-muted rounded text-sm font-semibold text-primary">
                      ${(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="h-8 w-8 text-red-400 hover:text-red-600"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terms / notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Quote Notes / Terms</label>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="resize-none text-sm"
          placeholder="Terms, conditions, payment schedule…"
        />
      </div>

      {/* Footer save */}
      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2 text-white font-semibold" style={{ background: brandColor }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Quote"}
        </Button>
      </div>
    </div>
  );
}
