import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Mail, Loader2, Trash2, Users, Send } from "lucide-react";
import { campaignApi } from "@/api/emailCampaignsApi";
import NewCampaignWizard from "@/components/admin/campaigns/NewCampaignWizard";
import CampaignDetail from "@/components/admin/campaigns/CampaignDetail";

const STATUS_BADGE = {
  draft: "bg-gray-100 text-gray-600",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
};

export default function EmailCampaigns() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    try {
      const { campaigns: rows } = await campaignApi("list_campaigns");
      setCampaigns(rows || []);
    } catch (err) {
      toast({ title: "Couldn't load campaigns", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Delete draft campaign "${campaign.name}" and its recipients?`)) return;
    try {
      await campaignApi("delete_campaign", { campaign_id: campaign.id });
      toast({ title: "Campaign deleted" });
      load();
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  if (selectedId) {
    return <CampaignDetail campaignId={selectedId} onBack={() => { setSelectedId(null); load(); }} />;
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
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all w-full"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-secondary truncate">{c.name}</span>
                    <Badge className={`${STATUS_BADGE[c.status] || STATUS_BADGE.draft} border-0 capitalize shrink-0`}>{c.status}</Badge>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Created {new Date(c.created_date).toLocaleDateString()}
                    {c.sent_at ? ` · sent ${new Date(c.sent_at).toLocaleDateString()}` : ""}
                    {c.last_nudge_at ? ` · last nudge ${new Date(c.last_nudge_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-5 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5" title="Recipients"><Users className="w-4 h-4 text-gray-400" /> {c.recipient_count || 0}</span>
                  <span className="flex items-center gap-1.5" title="Sent"><Send className="w-4 h-4 text-gray-400" /> {c.sent_count || 0}</span>
                  {c.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <NewCampaignWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => { setWizardOpen(false); setSelectedId(id); }}
      />
    </div>
  );
}
