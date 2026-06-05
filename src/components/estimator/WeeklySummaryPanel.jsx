import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RefreshCw, CalendarDays, Bell, BellOff, CheckCircle2 } from "lucide-react";

export default function WeeklySummaryPanel() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState(null);
  const [enabled, setEnabled] = useState(true);

  const handleSendNow = async () => {
    setSending(true);
    try {
      const result = await base44.functions.invoke("sendWeeklyPMSummary", {});
      setLastSent(new Date().toISOString());
      toast({
        title: "Summary sent!",
        description: `${result.summariesSent} PM(s) received their weekly summary`,
      });
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const toggleNotifications = async () => {
    setEnabled(!enabled);
    toast({
      title: enabled ? "Notifications paused" : "Notifications enabled",
      description: enabled ? "You won't receive weekly summaries until re-enabled" : "Weekly summaries will be sent every Monday at 8am",
    });
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-secondary flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          Weekly Summary Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${enabled ? "bg-green-50" : "bg-gray-100"}`}>
              {enabled ? <Bell className="w-5 h-5 text-green-600" /> : <BellOff className="w-5 h-5 text-gray-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Email Notifications</p>
              <p className="text-xs text-gray-500">
                {enabled ? "Active - Every Monday at 8am" : "Paused"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleNotifications}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              enabled ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {enabled ? "Pause" : "Enable"}
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDays className="w-4 h-4" />
              <span>Next scheduled: Monday, 8:00 AM</span>
            </div>
            {lastSent && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Last sent: {new Date(lastSent).toLocaleDateString()}
              </Badge>
            )}
          </div>

          <Button
            onClick={handleSendNow}
            disabled={sending || !enabled}
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-white"
          >
            {sending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
            ) : (
              <><Mail className="w-4 h-4" /> Send Summary Now</>
            )}
          </Button>

          {!enabled && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Enable notifications to send manual summaries
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-semibold mb-1">What's included:</p>
          <ul className="text-xs text-blue-600 space-y-1">
            <li>• Active projects with current stage</li>
            <li>• Open and in-progress tasks</li>
            <li>• Subcontractors with pending documents</li>
            <li>• Quick stats and dashboard link</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}