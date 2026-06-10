import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Truck, PackageCheck, Package, Trash2, Circle } from "lucide-react";

function statusBadge(item) {
  if (item.received) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 flex items-center gap-1"><PackageCheck className="w-3 h-3" />On Site</span>;
  if (item.ordered) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 flex items-center gap-1"><Truck className="w-3 h-3" />Ordered</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500 flex items-center gap-1"><Circle className="w-3 h-3" />Pending</span>;
}

export default function MaterialChecklist({ project, onUpdate }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: "", supplier: "", notes: "" });

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const items = project.material_checklist || [];
  const orderedCount = items.filter(i => i.ordered).length;
  const receivedCount = items.filter(i => i.received).length;

  const save = async (updatedItems) => {
    setSaving(true);
    await base44.entities.ContractorProject.update(project.id, { material_checklist: updatedItems });
    onUpdate();
    setSaving(false);
  };

  const addItem = async () => {
    if (!newItem.name.trim()) { toast({ title: "Item name required", variant: "destructive" }); return; }
    const item = {
      id: crypto.randomUUID(),
      name: newItem.name.trim(),
      quantity: newItem.quantity.trim(),
      supplier: newItem.supplier.trim(),
      notes: newItem.notes.trim(),
      ordered: false,
      received: false,
      created_at: new Date().toISOString(),
      created_by: user?.full_name || user?.email || "Office",
    };
    await save([...items, item]);
    setNewItem({ name: "", quantity: "", supplier: "", notes: "" });
    setShowAdd(false);
    toast({ title: "Item added" });
  };

  const toggleOrdered = async (item) => {
    const now = new Date().toISOString();
    const userName = user?.full_name || user?.email || "Team";
    const updated = items.map(i => i.id === item.id
      ? { ...i, ordered: !i.ordered, ordered_at: !i.ordered ? now : null, ordered_by: !i.ordered ? userName : null }
      : i
    );
    await save(updated);
  };

  const toggleReceived = async (item) => {
    const now = new Date().toISOString();
    const userName = user?.full_name || user?.email || "Team";
    const updated = items.map(i => i.id === item.id
      ? { ...i, received: !i.received, received_at: !i.received ? now : null, received_by: !i.received ? userName : null, ordered: !i.received ? true : i.ordered }
      : i
    );
    await save(updated);
  };

  const removeItem = async (id) => {
    await save(items.filter(i => i.id !== id));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-secondary flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Material Checklist
          </h2>
          {items.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {receivedCount}/{items.length} on site · {orderedCount}/{items.length} ordered
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1 bg-primary text-white">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </Button>
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Ordered</span><span>{orderedCount}/{items.length}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${items.length ? (orderedCount / items.length) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>On Site</span><span>{receivedCount}/{items.length}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${items.length ? (receivedCount / items.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Material name *" value={newItem.name} onChange={e => setNewItem(f => ({ ...f, name: e.target.value }))} className="text-sm h-8" />
            <Input placeholder="Qty (e.g. 20 sheets)" value={newItem.quantity} onChange={e => setNewItem(f => ({ ...f, quantity: e.target.value }))} className="text-sm h-8" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Supplier / vendor" value={newItem.supplier} onChange={e => setNewItem(f => ({ ...f, supplier: e.target.value }))} className="text-sm h-8" />
            <Input placeholder="Notes" value={newItem.notes} onChange={e => setNewItem(f => ({ ...f, notes: e.target.value }))} className="text-sm h-8" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={addItem} disabled={saving} className="bg-primary text-white">Add</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No materials added yet</p>
          <p className="text-sm mt-1">Add materials to track ordering and delivery.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`border rounded-xl p-3 transition-colors ${item.received ? "border-green-200 bg-green-50/50" : item.ordered ? "border-blue-200 bg-blue-50/30" : "border-gray-200"}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${item.received ? "line-through text-gray-400" : "text-secondary"}`}>{item.name}</span>
                    {statusBadge(item)}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {item.quantity && <span className="text-xs text-gray-500">Qty: {item.quantity}</span>}
                    {item.supplier && <span className="text-xs text-gray-500">· {item.supplier}</span>}
                    {item.notes && <span className="text-xs text-gray-400 italic">· {item.notes}</span>}
                  </div>
                  {item.ordered_by && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Ordered by {item.ordered_by} · {item.ordered_at ? new Date(item.ordered_at).toLocaleDateString() : ""}
                      {item.received_by && ` · Received by ${item.received_by}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleOrdered(item)}
                    title={item.ordered ? "Mark unordered" : "Mark ordered"}
                    className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${item.ordered ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600"}`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleReceived(item)}
                    title={item.received ? "Mark not received" : "Mark on site"}
                    className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${item.received ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"}`}
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}