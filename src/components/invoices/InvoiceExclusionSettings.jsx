import { useState, useEffect } from "react";
import { X, Plus, Settings, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function InvoiceExclusionSettings({ open, onClose, onSave }) {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [saving, setSaving] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("invoice_exclusion_keywords");
    if (saved) {
      try {
        setKeywords(JSON.parse(saved));
      } catch {}
    }
  }, [open]);

  const handleAdd = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords(prev => [...prev, trimmed]);
      setNewKeyword("");
    }
  };

  const handleRemove = (idx) => {
    setKeywords(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    localStorage.setItem("invoice_exclusion_keywords", JSON.stringify(keywords));
    await onSave?.(keywords);
    setSaving(false);
    toast({ title: "Exclusion keywords saved", description: `${keywords.length} keywords will filter out invoices.` });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-secondary" />
            <h2 className="font-bold text-secondary">Exclusion Keywords</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Emails containing any of these keywords will be automatically filtered out and not appear in your inbox.
          </p>

          {/* Add keyword */}
          <div className="flex gap-2">
            <Input
              placeholder="e.g., promotional, junk, test"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="h-9 text-xs"
            />
            <Button size="sm" onClick={handleAdd} className="h-9">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Keyword list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {keywords.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">No exclusion keywords yet</div>
            ) : (
              keywords.map((kw, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 bg-gray-50 px-3 py-2 rounded text-xs">
                  <span className="text-gray-700 font-mono">{kw}</span>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Count */}
          <div className="text-xs text-gray-500">
            {keywords.length} keyword{keywords.length !== 1 ? 's' : ''} active
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}