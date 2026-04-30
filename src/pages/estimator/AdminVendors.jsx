import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit3, Trash2, Building2, Phone, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = ["Lumber & Building Materials", "Electrical", "Plumbing", "HVAC", "Roofing", "Flooring", "Hardware", "Paint", "Concrete & Masonry", "General Supply", "Other"];

const emptyVendor = { company_name: "", contact_name: "", email: "", phone: "", address: "", category: "General Supply", notes: "", active: true };

export default function AdminVendors() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyVendor);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Vendor.update(editing.id, data) : base44.entities.Vendor.create(data),
    onSuccess: () => { qc.invalidateQueries(["vendors"]); setOpen(false); toast({ title: "Vendor saved" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Vendor.delete(id),
    onSuccess: () => { qc.invalidateQueries(["vendors"]); toast({ title: "Vendor deleted" }); },
  });

  const openNew = () => { setEditing(null); setForm(emptyVendor); setOpen(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...v }); setOpen(true); };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Vendor Directory</h1>
          <p className="text-sm text-gray-500">Supply houses for material take-off emails</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-primary text-white">
          <Plus className="w-4 h-4" /> Add Vendor
        </Button>
      </div>

      <div className="space-y-3">
        {vendors.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No vendors yet</p>
            <p className="text-sm mt-1">Add supply houses to send material take-offs.</p>
          </div>
        )}
        {vendors.map((v) => (
          <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-secondary">{v.company_name}</div>
              <div className="text-sm text-gray-500">{v.contact_name}</div>
              <div className="flex gap-4 mt-1">
                {v.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{v.email}</span>}
                {v.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{v.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {v.category && <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-gray-600 hidden sm:block">{v.category}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${v.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {v.active ? "Active" : "Inactive"}
              </span>
              <Button variant="ghost" size="icon" onClick={() => openEdit(v)} className="text-gray-400 hover:text-primary">
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(v.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {[["company_name", "Company Name *"], ["contact_name", "Contact Name"], ["email", "Email *"], ["phone", "Phone"], ["address", "Address"]].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">{label}</label>
                <Input value={form[field] || ""} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <label htmlFor="active" className="text-sm text-gray-600">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate(form)} className="bg-primary text-white">
                {saveMutation.isLoading ? "Saving..." : "Save Vendor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}