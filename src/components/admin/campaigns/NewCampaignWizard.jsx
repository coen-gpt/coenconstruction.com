import React, { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileSpreadsheet, Loader2, Users } from "lucide-react";
import { detectAndParse, looksBinary } from "@/lib/leadsImport";
import { campaignApi } from "@/api/emailCampaignsApi";

const CHUNK_SIZE = 100;

// Sensible defaults: re-engage everyone except customers we already won.
// Blank statuses are bucketed under one label so the checkbox, counts, and
// audience filter all agree.
function statusKey(c) {
  return c.quote_status || "No status";
}

function defaultIncludedStatuses(customers) {
  const statuses = new Set(customers.map(statusKey));
  return new Set([...statuses].filter((s) => !/converted|won/i.test(s) || /did not win|didn't win/i.test(s)));
}

const FORMAT_NAMES = {
  jobber: "Past Quotes Re-Engagement",
  angi: "Angi Leads Re-Engagement",
  generic: "Lead List Campaign",
};

export default function NewCampaignWizard({ open, onClose, onCreated }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [name, setName] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [heroUrl, setHeroUrl] = useState("");
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [includedStatuses, setIncludedStatuses] = useState(new Set());
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const c of parsed?.customers || []) {
      counts[statusKey(c)] = (counts[statusKey(c)] || 0) + 1;
    }
    return counts;
  }, [parsed]);

  const audience = useMemo(() => {
    return (parsed?.customers || []).filter(
      (c) => includedStatuses.has(statusKey(c)) && (!excludeInternal || !c.internal)
    );
  }, [parsed, includedStatuses, excludeInternal]);

  const internalCount = useMemo(
    () => (parsed?.customers || []).filter((c) => c.internal).length,
    [parsed]
  );

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (looksBinary(head)) {
        throw new Error("This is a binary Excel file. Open it in Excel and save as CSV (most lead-platform .xls exports are already plain text and work directly).");
      }
      const text = await file.text();
      const result = detectAndParse(text);
      if (!result.customers.length) throw new Error("No customers with valid emails found in this file.");
      setParsed(result);
      setFileName(file.name);
      setIncludedStatuses(defaultIncludedStatuses(result.customers));
      if (!name) setName(`${FORMAT_NAMES[result.format] || FORMAT_NAMES.generic} — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`);
    } catch (err) {
      toast({ title: "Couldn't read that file", description: err.message, variant: "destructive" });
    }
  };

  const toggleStatus = (status) => {
    setIncludedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Give the campaign a name first", variant: "destructive" });
      return;
    }
    if (!audience.length) {
      toast({ title: "The audience is empty", description: "Include at least one quote status.", variant: "destructive" });
      return;
    }
    setImporting(true);
    setProgress(0);
    try {
      const { campaign } = await campaignApi("create_campaign", {
        name: name.trim(),
        custom_note: customNote.trim(),
        hero_image_url: heroUrl.trim(),
      });
      for (let i = 0; i < audience.length; i += CHUNK_SIZE) {
        const chunk = audience.slice(i, i + CHUNK_SIZE).map(({ internal, ...c }) => c);
        await campaignApi("add_recipients", { campaign_id: campaign.id, recipients: chunk });
        setProgress(Math.min(100, Math.round(((i + chunk.length) / audience.length) * 100)));
      }
      toast({ title: "Campaign created", description: `${audience.length} recipients imported.` });
      reset();
      onCreated?.(campaign.id);
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setParsed(null);
    setFileName("");
    setName("");
    setCustomNote("");
    setHeroUrl("");
    setIncludedStatuses(new Set());
    setExcludeInternal(true);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) { reset(); onClose?.(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Email Campaign</DialogTitle>
          <DialogDescription>
            Upload a Jobber quotes export — each customer gets an email personalized around their quote line items.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-primary hover:bg-primary/5 transition-colors w-full"
          >
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-3" />
            <p className="font-semibold text-secondary">Upload a quotes or leads export</p>
            <p className="text-sm text-gray-500 mt-1">Jobber quotes, Angi leads, or any CSV/XLS lead list with emails — the format is detected automatically</p>
          </button>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-secondary">{fileName}</span>
                <span className="text-gray-500"> — {parsed.totalRows} rows, {parsed.customers.length} unique customers</span>
                {parsed.skippedNoEmail > 0 && (
                  <span className="text-gray-400"> ({parsed.skippedNoEmail} rows without a valid email skipped)</span>
                )}
                <div className="text-xs text-primary font-semibold mt-0.5">{parsed.formatLabel}</div>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setParsed(null); setFileName(""); }} disabled={importing}>
                Change
              </Button>
            </div>

            <div>
              <label className="text-sm font-semibold text-secondary block mb-1.5">Campaign name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={importing} />
            </div>

            <div>
              <label className="text-sm font-semibold text-secondary block mb-2">Who should get it?</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                  <label key={status} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                    <Checkbox checked={includedStatuses.has(status)} onCheckedChange={() => toggleStatus(status)} disabled={importing} />
                    <span className="text-secondary">{status}</span>
                    <span className="ml-auto text-gray-400">{count}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer">
                <Checkbox checked={excludeInternal} onCheckedChange={(v) => setExcludeInternal(Boolean(v))} disabled={importing} />
                <span className="text-gray-600">Exclude internal emails (Samia / Coen addresses){internalCount ? ` — ${internalCount} found` : ""}</span>
              </label>
            </div>

            <div>
              <label className="text-sm font-semibold text-secondary block mb-1.5">Personal note <span className="font-normal text-gray-400">(optional — appears in every email)</span></label>
              <Textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder={'e.g. "P.S. Mention this email at your walkthrough and we\'ll include a free design consult."'}
                rows={2}
                disabled={importing}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-secondary block mb-1.5">Hero image URL <span className="font-normal text-gray-400">(optional — defaults to the website hero)</span></label>
              <Input value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)} placeholder="https://…" disabled={importing} />
            </div>

            {importing && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Importing recipients…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-secondary font-semibold">
                <Users className="w-4 h-4 text-primary" />
                {audience.length} recipients selected
              </div>
              <Button onClick={handleCreate} disabled={importing || !audience.length} className="bg-primary text-white hover:bg-primary/90">
                {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</> : "Create Campaign"}
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </DialogContent>
    </Dialog>
  );
}
