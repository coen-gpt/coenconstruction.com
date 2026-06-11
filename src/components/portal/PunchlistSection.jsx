import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Plus, Trash2, Camera, ClipboardList, AlertCircle } from "lucide-react";

export default function PunchlistSection({ project, punchlist, token, onUpdate }) {
  const [items, setItems] = useState(punchlist?.items || []);
  const [newItem, setNewItem] = useState({ description: "", location: "" });
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(punchlist?.status === "submitted");
  const [submitError, setSubmitError] = useState(null);

  const addItem = () => {
    if (!newItem.description.trim()) return;
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      description: newItem.description.trim(),
      location: newItem.location.trim(),
      photo_url: "",
      resolved: false,
    }]);
    setNewItem({ description: "", location: "" });
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handlePhotoUpload = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    setUploadError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setItems(prev => prev.map(i => i.id === id ? { ...i, photo_url: file_url } : i));
    } catch {
      setUploadError("Photo upload failed — please check your connection and try again. You can also submit without a photo.");
    }
    setUploadingId(null);
  };

  const handleSubmit = async () => {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Token-validated backend write — the public portal must never write
      // entities directly.
      const res = await base44.functions.invoke("submitPunchlist", {
        token,
        punchlist_id: punchlist?.id,
        items,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setSubmitted(true);
      onUpdate?.();
    } catch (err) {
      // Never pretend it worked — the office wouldn't know to schedule the fixes.
      setSubmitError(err?.response?.data?.error || err.message || "Something went wrong. Please try again or call us at (617) 857-COEN.");
    }
    setSubmitting(false);
  };

  if (submitted || punchlist?.status === "submitted") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <h3 className="font-bold text-green-800 text-lg mb-1">Punchlist Submitted!</h3>
        <p className="text-green-700 text-sm">
          Thank you for submitting your punchlist. Our team will review each item and follow up with you shortly.
        </p>
        {(punchlist?.items || items).length > 0 && (
          <div className="mt-4 space-y-2 text-left">
            {(punchlist?.items || items).map((item, i) => (
              <div key={item.id || i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${item.resolved ? "bg-green-100" : "bg-white border border-green-200"}`}>
                {item.resolved
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.description}</p>
                  {item.location && <p className="text-xs text-gray-500">{item.location}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.resolved ? "bg-green-200 text-green-800" : "bg-amber-100 text-amber-700"}`}>
                  {item.resolved ? "Resolved" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-amber-700" />
          <h3 className="font-bold text-amber-900 text-base">Your Final Punchlist</h3>
        </div>
        <p className="text-amber-800 text-sm">
          This is your one and final opportunity to submit items you'd like addressed before your project is closed out. 
          Please be specific about the location and issue for each item.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Existing items */}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-sm text-gray-800">{item.description}</p>
              {item.location && <p className="text-xs text-gray-500">📍 {item.location}</p>}
              {item.photo_url && (
                <a href={item.photo_url} target="_blank" rel="noreferrer">
                  <img src={item.photo_url} alt="Punchlist item" className="w-24 h-24 object-cover rounded-lg border border-gray-200 mt-1" />
                </a>
              )}
              {!item.photo_url && (
                <label className="flex items-center gap-1.5 text-xs text-blue-600 cursor-pointer hover:underline mt-1">
                  <Camera className="w-3.5 h-3.5" />
                  {uploadingId === item.id ? "Uploading..." : "Add Photo (optional)"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(item.id, e.target.files[0])} />
                </label>
              )}
            </div>
            <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Add new item form */}
        <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-gray-50/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Punchlist Item</p>
          <Input
            placeholder="Describe the issue (e.g. Paint scuff on south wall of kitchen)"
            value={newItem.description}
            onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))}
            className="text-sm"
          />
          <Input
            placeholder="Location (e.g. Kitchen, Master Bathroom, Back Deck)"
            value={newItem.location}
            onChange={e => setNewItem(f => ({ ...f, location: e.target.value }))}
            className="text-sm"
          />
          <Button
            onClick={addItem}
            disabled={!newItem.description.trim()}
            variant="outline"
            size="sm"
            className="gap-1.5 w-full"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </Button>
        </div>

        {/* Upload / submit errors */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3">
            {uploadError}
          </div>
        )}
        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {submitError}
          </div>
        )}

        {/* Submit button */}
        {items.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
              <strong>Important:</strong> This is your one and final punchlist. Once submitted, you will not be able to add more items.
              Please review carefully before submitting.
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-primary hover:bg-[#c94522] text-white font-bold text-sm rounded-xl py-3"
            >
              {submitting ? "Submitting..." : `Submit Final Punchlist (${items.length} item${items.length !== 1 ? "s" : ""})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}