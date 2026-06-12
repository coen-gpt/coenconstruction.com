import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Mail, Loader2, Trash2, Users, Send, MailOpen, MousePointerClick,
  CalendarCheck, UserX, AlertTriangle, Zap, UserPlus,
} from "lucide-react";
import { campaignApi } from "@/api/emailCampaignsApi";
import NewCampaignWizard from "@/components/admin/campaigns/NewCampaignWizard";
import CampaignDetail from "@/components/admin/campaigns/CampaignDetail";

const STATUS_BADGE = {
  draft: "bg-gray-100 text-gray-600",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
};

const pct = (n, base) => (base ? `${Math.round((n / base) * 100)}%` : "—");

function SummaryCard({ icon: Icon, label, value, sub }) {
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

function MetricChip({ icon: Icon, label, value, sub, tone = "text-gray-600" }) {
  return (
    <div className="flex items-center gap-1.5 text-sm" title={label}>
      <Icon className={`w-4 h-4 ${tone === "text-gray-600" ? "text-gray-400" : tone}`} />
      <span className={`font-semibold ${tone}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
      <span className="text-xs text-gray-400 hidden xl:inline">{label}</span>
    </div>
  );
}

export default function EmailCampaigns() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [statsById, setStatsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    try {
      const { campaigns: rows } = await campaignApi("list_campaigns");
      setCampaigns(rows || []);
      setLoading(false);
      // Engagement stats load per campaign after the list renders — each call
      // aggregates server-side, so big recipient lists never hit the browser.
      (rows || []).forEach(async (c) => {
        try {
          const { stats } = await campaignApi("campaign_stats", { campaign_id: c.id });
          setStatsById((prev) => ({ ...prev, [c.id]: stats }));
        } catch {
          /* stats are progressive enhancement — the card still renders */
        }
      });
    } catch (err) {
      setLoading(false);
      toast({ title: "Couldn't load campaigns", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const loaded = campaigns.map((c) => statsById[c.id]).filter(Boolean);
    const sum = (key) => loaded.reduce((acc, s) => acc + (s[key] || 0), 0);
    return {
      loaded: loaded.length === campaigns.length && campaigns.length > 0,
      recipients: sum("recipients"),
      sent: sum("sent"),
      pending: sum("pending"),
      opened: sum("opened"),
      clicked: sum("clicked"),
      walkthroughs: sum("walkthroughs"),
      leads: sum("leads"),
      unsubscribed: sum("unsubscribed"),
    };
  }, [campaigns, statsById]);

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Delete draft campaign "${campaign.name}" and its recipients?`)) return;
    setDeletingId(campaign.id);
    try {
      // The server deletes recipients in bounded chunks so big drafts can't
      // time out — loop until it confirms the campaign itself is gone.
      let guard = 0;
      let done = false;
      while (!done) {
        if (++guard > 50) throw new Error("Delete is taking unusually long — refresh and try again");
        const res = await campaignApi("delete_campaign", { campaign_id: campaign.id });
        done = Boolean(res.deleted);
      }
      toast({ title: "Campaign deleted" });
    } catch (err) {
      toast({ title: "Delete didn't finish", description: `${err.message} — refresh the page; clicking delete again resumes safely.`, variant: "destructive" });
    } finally {
      setDeletingId(null);
      load();
    }
  };

  if (selectedId) {
    return (
      <CampaignDetail
        campaignId={selectedId}
        onBack={() => { setSelectedId(null); load(); }}
        onOpenCampaign={(id) => setSelectedId(id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Email Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Personalized broadcasts from your Jobber quote history — with open, click, and walkthrough tracking.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="bg-primary text-white hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1.5" /> New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !campaigns.length ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Mail className="w-10 h-10 mx-auto text-gray-300 mb-4" />
          <h2 className="font-semibold text-secondary text-lg">No campaigns yet</h2>
          <p className="text-sm text-gray-500 mt-1 mb-5 max-w-md mx-auto">
            Upload a Jobber quotes export and we'll build a personalized email for every customer —
            tailored to their exact project line items — with one-click walkthrough scheduling.
          </p>
          <Button onClick={() => setWizardOpen(true)} className="bg-primary text-white hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" /> Create your first campaign
          </Button>
        </div>
      ) : (
        <>
          {/* All-time totals across every campaign */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard icon={Users} label="Recipients" value={totals.loaded ? totals.recipients : "…"} sub={totals.pending ? `${totals.pending} pending` : undefined} />
            <SummaryCard icon={Send} label="Sent" value={totals.loaded ? totals.sent : "…"} />
            <SummaryCard icon={MailOpen} label="Opened" value={totals.loaded ? totals.opened : "…"} sub={totals.loaded ? pct(totals.opened, totals.sent) : undefined} />
            <SummaryCard icon={MousePointerClick} label="Clicked" value={totals.loaded ? totals.clicked : "…"} sub={totals.loaded ? pct(totals.clicked, totals.sent) : undefined} />
            <SummaryCard icon={CalendarCheck} label="Walkthroughs" value={totals.loaded ? totals.walkthroughs : "…"} sub={totals.loaded && totals.leads ? `${totals.leads} leads` : undefined} />
            <SummaryCard icon={UserX} label="Unsubscribed" value={totals.loaded ? totals.unsubscribed : "…"} />
          </div>

          <div className="grid gap-3">
            {campaigns.map((c) => {
              const s = statsById[c.id];
              const recipients = s?.recipients ?? c.recipient_count ?? 0;
              const sent = s?.sent ?? c.sent_count ?? 0;
              const pending = s?.pending ?? 0;
              const failed = s?.failed ?? c.failed_count ?? 0;
              const progress = recipients ? Math.min(100, Math.round((sent / recipients) * 100)) : 0;
              const sentToday = c.drip_day === new Date().toISOString().slice(0, 10) ? c.drip_sent_today || 0 : 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all w-full"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-secondary truncate">{c.name}</span>
                        <Badge className={`${STATUS_BADGE[c.status] || STATUS_BADGE.draft} border-0 capitalize shrink-0`}>{c.status}</Badge>
                        {c.drip_enabled && c.status === "sending" && (
                          <Badge className="bg-blue-100 text-blue-700 border-0 shrink-0">
                            <Zap className="w-3 h-3 mr-1" />
                            Auto-drip {c.wave_size === 0 ? "· unlimited" : `· ${c.wave_size || 200}/day`}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Created {new Date(c.created_date).toLocaleDateString()}
                        {c.sent_at ? ` · finished ${new Date(c.sent_at).toLocaleDateString()}` : ""}
                        {c.last_wave_at && !c.sent_at ? ` · last wave ${new Date(c.last_wave_at).toLocaleDateString()}` : ""}
                        {c.last_nudge_at ? ` · last nudge ${new Date(c.last_nudge_at).toLocaleDateString()}` : ""}
                        {sentToday ? ` · ${sentToday} sent today` : ""}
                      </div>
                    </div>
                    {c.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-gray-400 hover:text-red-500"
                        disabled={deletingId === c.id}
                        onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                      >
                        {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>

                  {/* Delivery progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                      <span>{sent} of {recipients} sent{pending ? ` · ${pending} pending` : ""}{failed ? ` · ${failed} failed` : ""}</span>
                      <span className="font-semibold text-gray-500">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progress >= 100 ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Engagement metrics */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {s ? (
                      <>
                        <MetricChip icon={MailOpen} label="opened" value={s.opened} sub={pct(s.opened, s.sent)} />
                        <MetricChip icon={MousePointerClick} label="clicked" value={s.clicked} sub={pct(s.clicked, s.sent)} />
                        <MetricChip icon={CalendarCheck} label="walkthroughs" value={s.walkthroughs} tone={s.walkthroughs ? "text-green-600" : "text-gray-600"} />
                        <MetricChip icon={UserPlus} label="leads" value={s.leads} tone={s.leads ? "text-green-600" : "text-gray-600"} />
                        <MetricChip icon={UserX} label="unsubscribed" value={s.unsubscribed} />
                        {s.failed > 0 && <MetricChip icon={AlertTriangle} label="failed" value={s.failed} tone="text-red-500" />}
                      </>
                    ) : (
                      <span className="text-xs text-gray-300 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading engagement…
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <NewCampaignWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => { setWizardOpen(false); setSelectedId(id); }}
      />
    </div>
  );
}
