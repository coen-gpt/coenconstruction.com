import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileSpreadsheet, Loader2, Users, ShieldCheck } from "lucide-react";
import { detectAndParse, looksBinary } from "@/lib/leadsImport";
import { campaignApi } from "@/api/emailCampaignsApi";

// Small chunks + per-chunk retries: large imports (1,500+) hit transient
// function timeouts / rate limits, and a single failure must not strand a
// partial campaign. add_recipients is idempotent server-side, so retries are
// always safe.
const CHUNK_SIZE = 50;
const CHUNK_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const COOLDOWN_OPTIONS = [
  { value: "0", label: "Ever (all time)" },
  { value: "30", label: "In the last 30 days" },
  { value: "60", label: "In the last 60 days" },
  { value: "90", label: "In the last 90 days" },
  { value: "180", label: "In the last 180 days" },
  { value: "365", label: "In the last year" },
];

const SKIP_LABELS = {
  duplicate: "prior campaign",
  active_client: "active clients",
  open_lead: "open leads",
  household: "same household",
  unsubscribed: "unsubscribed",
};

function skipSummary(counts) {
  return Object.entries(SKIP_LABELS)
    .map(([key, label]) => (counts[key] ? `${counts[key]} ${label}` : null))
    .filter(Boolean)
    .join(", ");
}

// Pass `resumeCampaign` (a draft campaign record) to reopen the wizard against
// an existing draft — e.g. when a browser session died mid-import and the
// in-dialog resume state was lost. add_recipients skips emails already in the
// campaign, so re-uploading the same file only imports the missing tail.
export default function NewCampaignWizard({ open, onClose, onCreated, resumeCampaign = null }) {
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
  // Once a campaign exists, retries resume into it instead of creating a new one.
  const [resumeCampaignId, setResumeCampaignId] = useState(null);
  const [importError, setImportError] = useState(null);
  const [cooldownDays, setCooldownDays] = useState("0");
  const [allowRecontact, setAllowRecontact] = useState(false);
  const [subjectA, setSubjectA] = useState("");
  const [subjectB, setSubjectB] = useState("");
  // Server-side dry-run of the suppression rules — shows who will be skipped
  // before anything is created.
  const [audit, setAudit] = useState(null);
  const [auditing, setAuditing] = useState(false);

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

  // Resume mode: target the existing draft from the start and mirror its saved
  // dedupe settings so the dry-run preview matches what import will enforce.
  useEffect(() => {
    if (!open || !resumeCampaign) return;
    setResumeCampaignId(resumeCampaign.id);
    setName(resumeCampaign.name || "Campaign");
    setCooldownDays(String(resumeCampaign.dedupe_window_days || 0));
    setAllowRecontact(Boolean(resumeCampaign.allow_recontact));
  }, [open, resumeCampaign]);

  // Debounced dry-run: one check_audience call covers the whole audience
  // (only contact fields travel), re-run whenever the audience or the
  // suppression options change.
  useEffect(() => {
    if (!parsed || !audience.length || importing) return undefined;
    let cancelled = false;
    setAuditing(true);
    const timer = setTimeout(async () => {
      try {
        const res = await campaignApi("check_audience", {
          recipients: audience.map((c) => ({ email: c.email, phone: c.phone, address: c.address, zip: c.zip })),
          campaign_id: resumeCampaignId || undefined,
          dedupe_window_days: Number(cooldownDays) || 0,
          allow_recontact: allowRecontact,
        });
        if (!cancelled) setAudit(res.breakdown);
      } catch {
        if (!cancelled) setAudit(null); // preview is best-effort — import still enforces
      } finally {
        if (!cancelled) setAuditing(false);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [parsed, audience, cooldownDays, allowRecontact, importing, resumeCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setImportError(null);
    try {
      const dedupeParams = {
        dedupe_window_days: Number(cooldownDays) || 0,
        allow_recontact: allowRecontact,
      };
      let campaignId = resumeCampaignId;
      if (!campaignId) {
        const { campaign } = await campaignApi("create_campaign", {
          name: name.trim(),
          custom_note: customNote.trim(),
          hero_image_url: heroUrl.trim(),
          subject_a: subjectA.trim(),
          subject_b: subjectB.trim(),
          ...dedupeParams,
        });
        campaignId = campaign.id;
        setResumeCampaignId(campaignId);
      }
      let imported = 0;
      const skips = { duplicate: 0, active_client: 0, open_lead: 0, household: 0 };
      for (let i = 0; i < audience.length; i += CHUNK_SIZE) {
        const chunk = audience.slice(i, i + CHUNK_SIZE).map(({ internal, ...c }) => c);
        // Server-side import is idempotent (already-imported emails are
        // skipped), so retrying a chunk that died partway never duplicates.
        let lastErr = null;
        let res = null;
        for (let attempt = 1; attempt <= CHUNK_RETRIES; attempt++) {
          try {
            res = await campaignApi("add_recipients", { campaign_id: campaignId, recipients: chunk, ...dedupeParams });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < CHUNK_RETRIES) await sleep(attempt * 1500);
          }
        }
        if (lastErr) throw lastErr;
        if (res?.failed) throw new Error(`${res.failed} recipients in this batch couldn't be saved`);
        skips.duplicate += res?.skipped_duplicates || 0;
        skips.active_client += res?.skipped_active_clients || 0;
        skips.open_lead += res?.skipped_open_leads || 0;
        skips.household += res?.skipped_household || 0;
        const chunkSkipped = (res?.skipped_duplicates || 0) + (res?.skipped_active_clients || 0)
          + (res?.skipped_open_leads || 0) + (res?.skipped_household || 0);
        imported += (res?.created || 0) + (res?.skipped_existing || 0) + chunkSkipped;
        setProgress(Math.min(100, Math.round((imported / audience.length) * 100)));
      }
      const totalSkipped = skips.duplicate + skips.active_client + skips.open_lead + skips.household;
      toast({
        title: resumeCampaign ? "Recipients imported" : "Campaign created",
        description: totalSkipped
          ? `${audience.length - totalSkipped} recipients imported — ${totalSkipped} skipped (${skipSummary(skips)}).`
          : `${audience.length} recipients imported.`,
      });
      const createdId = campaignId;
      reset();
      onCreated?.(createdId);
    } catch (err) {
      setImportError(err.message);
      toast({
        title: "Import paused",
        description: `${err.message}. Nothing was lost — hit "Resume import" to continue where it left off.`,
        variant: "destructive",
      });
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
    setResumeCampaignId(null);
    setImportError(null);
    setCooldownDays("0");
    setAllowRecontact(false);
    setSubjectA("");
    setSubjectB("");
    setAudit(null);
    setAuditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) { reset(); onClose?.(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resumeCampaign ? `Add Recipients — ${resumeCampaign.name}` : "New Email Campaign"}</DialogTitle>
          <DialogDescription>
            {resumeCampaign
              ? "Re-upload the original export (or a new one) to finish an interrupted import. Anyone already in this campaign is skipped automatically, so it's always safe to upload the same file again."
              : "Upload a quotes or leads export — each customer gets an email personalized around their project details. Prior campaign recipients, active clients, and open leads are skipped automatically (matched by email, phone, or address)."}
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

            {!resumeCampaign && (
              <div>
                <label className="text-sm font-semibold text-secondary block mb-1.5">Campaign name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={importing} />
              </div>
            )}

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

            <div className="border border-gray-200 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
                <ShieldCheck className="w-4 h-4 text-primary" /> Duplicate protection
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span>Skip anyone we already emailed</span>
                <Select value={cooldownDays} onValueChange={setCooldownDays} disabled={importing || allowRecontact}>
                  <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COOLDOWN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox checked={allowRecontact} onCheckedChange={(v) => setAllowRecontact(Boolean(v))} disabled={importing} className="mt-0.5" />
                <span className="text-gray-600">
                  Allow re-contacting prior campaign recipients
                  <span className="block text-xs text-gray-400">For intentional follow-ups. Unsubscribes, active clients, and open leads are always skipped regardless.</span>
                </span>
              </label>
              {audience.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2 text-xs text-gray-600">
                  {auditing || !audit ? (
                    <span className="flex items-center gap-1.5 text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Checking the audience against past campaigns, clients, and leads…</span>
                  ) : (
                    <>
                      <span className="font-semibold text-secondary">{audit.ok} of {audit.total} will be imported.</span>
                      {audit.total - audit.ok - audit.invalid - audit.already_imported > 0 && (
                        <span> Skipped: {skipSummary(audit)}.</span>
                      )}
                      {audit.already_imported > 0 && <span> {audit.already_imported} already in this campaign.</span>}
                      {audit.invalid > 0 && <span> {audit.invalid} without a valid email.</span>}
                    </>
                  )}
                </div>
              )}
            </div>

            {!resumeCampaign && (<>
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

            <div>
              <label className="text-sm font-semibold text-secondary block mb-1.5">
                Subject lines <span className="font-normal text-gray-400">(optional — blank uses smart per-customer subjects; fill both to A/B test)</span>
              </label>
              <div className="space-y-2">
                <Input value={subjectA} onChange={(e) => setSubjectA(e.target.value)} placeholder={'A — e.g. "Still planning your {project}, {first_name}?"'} disabled={importing} maxLength={150} />
                <Input value={subjectB} onChange={(e) => setSubjectB(e.target.value)} placeholder={'B — e.g. "{first_name}, let\'s get your {project} on the calendar"'} disabled={importing} maxLength={150} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {"{first_name}"} and {"{project}"} fill in per recipient. With both lines set, recipients split 50/50 and the campaign reports opens per variant.
              </p>
            </div>
            </>)}

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

            {importError && !importing && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                The import was interrupted ({importError}). Your progress is saved — resuming picks up exactly where it stopped, with no duplicates.
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-secondary font-semibold">
                <Users className="w-4 h-4 text-primary" />
                {audience.length} recipients selected
              </div>
              <Button onClick={handleCreate} disabled={importing || !audience.length} className="bg-primary text-white hover:bg-primary/90">
                {importing
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</>
                  : importError ? "Resume Import"
                  : resumeCampaign ? "Import Recipients"
                  : resumeCampaignId ? "Resume Import" : "Create Campaign"}
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
