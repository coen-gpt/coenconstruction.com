import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Send, Loader2, Eye, MailOpen, MousePointerClick, CalendarCheck,
  UserX, RefreshCw, BellRing, Users, ExternalLink,
} from "lucide-react";
import { campaignApi } from "@/api/emailCampaignsApi";

const ENGAGEMENT_FILTERS = [
  { value: "all", label: "All recipients" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "walkthrough", label: "Requested walkthrough" },
  { value: "not_opened", label: "Didn't open" },
  { value: "not_engaged", label: "Opened, didn't click" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "failed", label: "Send failed" },
];

function engagementOf(r) {
  if (r.unsubscribed) return "unsubscribed";
  if (r.walkthrough_requested_at) return "walkthrough";
  if (r.clicked_at) return "clicked";
  if (r.opened_at) return "opened";
  return "none";
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <div className="text-2xl font-bold text-secondary">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const ENGAGEMENT_BADGES = {
  walkthrough: { label: "Walkthrough", className: "bg-green-100 text-green-700 border-green-200" },
  clicked: { label: "Clicked", className: "bg-blue-100 text-blue-700 border-blue-200" },
  opened: { label: "Opened", className: "bg-amber-100 text-amber-700 border-amber-200" },
  unsubscribed: { label: "Unsubscribed", className: "bg-gray-100 text-gray-500 border-gray-200" },
  none: { label: "—", className: "bg-gray-50 text-gray-400 border-gray-100" },
};

export default function CampaignDetail({ campaignId, onBack }) {
  const { toast } = useToast();
  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);
  const [nudging, setNudging] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeMode, setNudgeMode] = useState("not_engaged");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);

  const load = async () => {
    try {
      const [{ campaign: c }, { recipients: r }] = await Promise.all([
        campaignApi("get_campaign", { campaign_id: campaignId }),
        campaignApi("list_recipients", { campaign_id: campaignId }),
      ]);
      setCampaign(c);
      setRecipients(r || []);
    } catch (err) {
      toast({ title: "Couldn't load campaign", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); load(); }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const sent = recipients.filter((r) => r.send_status === "sent");
    const opened = sent.filter((r) => r.opened_at);
    const clicked = sent.filter((r) => r.clicked_at);
    const walkthroughs = recipients.filter((r) => r.walkthrough_requested_at);
    const leads = recipients.filter((r) => r.lead_id);
    const unsubscribed = recipients.filter((r) => r.unsubscribed);
    const failed = recipients.filter((r) => r.send_status === "failed");
    const pct = (n) => (sent.length ? `${Math.round((n / sent.length) * 100)}%` : "—");
    return { sent, opened, clicked, walkthroughs, leads, unsubscribed, failed, pct };
  }, [recipients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (q && !`${r.client_name} ${r.email} ${r.line_items}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "opened": return Boolean(r.opened_at);
        case "clicked": return Boolean(r.clicked_at);
        case "walkthrough": return Boolean(r.walkthrough_requested_at);
        case "not_opened": return r.send_status === "sent" && !r.opened_at && !r.unsubscribed;
        case "not_engaged": return r.send_status === "sent" && Boolean(r.opened_at) && !r.clicked_at && !r.unsubscribed;
        case "unsubscribed": return r.unsubscribed;
        case "failed": return r.send_status === "failed";
        default: return true;
      }
    });
  }, [recipients, search, filter]);

  const pendingCount = recipients.filter((r) => r.send_status === "pending").length;

  const handleSend = async () => {
    if (!window.confirm(`Send this campaign to ${pendingCount} recipients now?`)) return;
    setSending(true);
    let totalSent = 0;
    let totalFailed = 0;
    try {
      let done = false;
      while (!done) {
        const res = await campaignApi("send", { campaign_id: campaignId });
        totalSent += res.sent;
        totalFailed += res.failed;
        done = res.done;
        setSendProgress({ sent: totalSent, failed: totalFailed });
      }
      toast({ title: "Broadcast complete", description: `${totalSent} emails sent${totalFailed ? `, ${totalFailed} failed` : ""}.` });
    } catch (err) {
      toast({ title: "Send stopped", description: `${err.message} — ${totalSent} were sent. You can hit Send again to resume.`, variant: "destructive" });
    } finally {
      setSending(false);
      setSendProgress(null);
      load();
    }
  };

  const nudgeTargets = useMemo(() => {
    return recipients.filter((r) =>
      r.send_status === "sent" && !r.unsubscribed && !r.walkthrough_requested_at &&
      (nudgeMode === "not_opened" ? !r.opened_at : !r.clicked_at)
    );
  }, [recipients, nudgeMode]);

  const handleNudge = async () => {
    setNudging(true);
    let total = 0;
    try {
      const ids = nudgeTargets.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 25) {
        const res = await campaignApi("nudge", { campaign_id: campaignId, recipient_ids: ids.slice(i, i + 25) });
        total += res.sent;
      }
      toast({ title: "Nudges sent", description: `${total} reminder emails on their way.` });
      setNudgeOpen(false);
    } catch (err) {
      toast({ title: "Nudge stopped", description: `${err.message} — ${total} were sent.`, variant: "destructive" });
    } finally {
      setNudging(false);
      load();
    }
  };

  const openPreview = async (recipient) => {
    setPreview({ loading: true, name: recipient.client_name });
    try {
      const res = await campaignApi("preview", { campaign_id: campaignId, recipient_id: recipient.id });
      setPreview({ ...res, name: recipient.client_name });
    } catch (err) {
      setPreview(null);
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!campaign) return null;

  const statusBadge = {
    draft: "bg-gray-100 text-gray-600",
    sending: "bg-amber-100 text-amber-700",
    sent: "bg-green-100 text-green-700",
  }[campaign.status] || "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Campaigns</Button>
        <h1 className="text-2xl font-bold text-secondary">{campaign.name}</h1>
        <Badge className={`${statusBadge} border-0 capitalize`}>{campaign.status}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1.5" /> Refresh</Button>
          {stats.sent.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setNudgeOpen(true)}>
              <BellRing className="w-4 h-4 mr-1.5" /> Nudge
            </Button>
          )}
          {pendingCount > 0 && (
            <Button size="sm" onClick={handleSend} disabled={sending} className="bg-primary text-white hover:bg-primary/90">
              {sending
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending… {sendProgress ? `${sendProgress.sent}` : ""}</>
                : <><Send className="w-4 h-4 mr-1.5" /> Send to {pendingCount}</>}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Recipients" value={recipients.length} sub={pendingCount ? `${pendingCount} pending` : undefined} />
        <StatCard icon={Send} label="Sent" value={stats.sent.length} sub={stats.failed.length ? `${stats.failed.length} failed` : undefined} />
        <StatCard icon={MailOpen} label="Opened" value={stats.opened.length} sub={stats.pct(stats.opened.length)} />
        <StatCard icon={MousePointerClick} label="Clicked" value={stats.clicked.length} sub={stats.pct(stats.clicked.length)} />
        <StatCard icon={CalendarCheck} label="Walkthroughs" value={stats.walkthroughs.length} sub={stats.leads.length ? `${stats.leads.length} leads created` : undefined} />
        <StatCard icon={UserX} label="Unsubscribed" value={stats.unsubscribed.length} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <Input placeholder="Search name, email, or project…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Quote Status</th>
                <th className="px-4 py-2.5 font-semibold">Engagement</th>
                <th className="px-4 py-2.5 font-semibold">Nudges</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((r) => {
                const eng = engagementOf(r);
                const badge = ENGAGEMENT_BADGES[eng];
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-secondary">{r.client_name}</div>
                      <div className="text-xs text-gray-400">{r.email}{r.city ? ` · ${r.city}` : ""}</div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[220px]">
                      <div className="truncate text-gray-600" title={r.line_items}>{(r.line_item_names || []).join(", ") || "—"}</div>
                      <div className="text-xs text-gray-400 capitalize">{r.segment}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {r.quote_status || "—"}
                      {r.send_status === "failed" && <div className="text-xs text-red-500" title={r.failed_reason}>send failed</div>}
                      {r.send_status === "pending" && <div className="text-xs text-gray-400">not sent yet</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{r.nudge_count || 0}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {r.lead_id && (
                        <a href="/admin/leads" className="inline-flex items-center text-xs text-primary font-semibold mr-3 hover:underline">
                          Lead <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openPreview(r)} title="Preview email">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No recipients match.</td></tr>
              )}
            </tbody>
          </table>
          {filtered.length > 300 && (
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">Showing first 300 — refine the search to see more.</div>
          )}
        </div>
      </div>

      {/* Email preview */}
      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email preview — {preview?.name}</DialogTitle>
            {preview?.subject && <DialogDescription>Subject: {preview.subject}</DialogDescription>}
          </DialogHeader>
          {preview?.loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <iframe title="Email preview" srcDoc={preview?.html} className="w-full flex-1 min-h-[60vh] border border-gray-200 rounded-lg bg-white" sandbox="" />
          )}
        </DialogContent>
      </Dialog>

      {/* Nudge dialog */}
      <Dialog open={nudgeOpen} onOpenChange={(o) => !nudging && setNudgeOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nudge non-engaged recipients</DialogTitle>
            <DialogDescription>Sends a short, friendly reminder with the walkthrough link. Unsubscribed customers and anyone who already requested a walkthrough are always skipped.</DialogDescription>
          </DialogHeader>
          <Select value={nudgeMode} onValueChange={setNudgeMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_engaged">Everyone who hasn't clicked ({recipients.filter((r) => r.send_status === "sent" && !r.unsubscribed && !r.walkthrough_requested_at && !r.clicked_at).length})</SelectItem>
              <SelectItem value="not_opened">Only those who never opened ({recipients.filter((r) => r.send_status === "sent" && !r.unsubscribed && !r.walkthrough_requested_at && !r.opened_at).length})</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNudgeOpen(false)} disabled={nudging}>Cancel</Button>
            <Button onClick={handleNudge} disabled={nudging || !nudgeTargets.length} className="bg-primary text-white hover:bg-primary/90">
              {nudging ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending…</> : <>Send {nudgeTargets.length} nudges</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
