import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function DismissModal({ item, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleDismiss = async () => {
    if (!reason.trim()) { setError("A dismiss reason is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await base44.entities.ClientCommunication.update(item.id, {
        status: "dismissed",
        dismiss_reason: reason.trim(),
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Dismiss Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-gray-600">
            Dismissing: <span className="font-medium text-secondary">{item.title}</span>
          </p>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Reason <span className="text-red-400">*</span></p>
            <Textarea
              rows={3}
              placeholder="Why is this being dismissed?"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="text-sm resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" variant="destructive" onClick={handleDismiss} disabled={saving}>
            {saving ? "Dismissing…" : "Dismiss"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}