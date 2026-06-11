import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Phone, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function SubcontractorSmsDialog({ vendor, project }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim() || !vendor?.phone) return;

    setSending(true);
    try {
      const res = await base44.functions.invoke("sendSubcontractorSms", {
        to: vendor.phone,
        body: message,
        project_id: project?.id
      });

      if (res.data.success) {
        setSent(true);
        toast({
          title: "SMS Sent!",
          description: `Message sent to ${vendor.contact_name || vendor.company_name}`,
        });
        
        setTimeout(() => {
          setOpen(false);
          setSent(false);
          setMessage("");
        }, 2000);
      }
    } catch (error) {
      toast({
        title: "Failed to send",
        description: error.response?.data?.details || error.message,
        variant: "destructive",
      });
    }
    setSending(false);
  };

  const quickMessages = [
    "Hi! Your bid has been selected. Please confirm availability to start.",
    "Reminder: Please submit your insurance certificates before work begins.",
    "Project start date confirmed. Please arrive by 8am on Monday.",
    "Please provide an updated timeline for your scope of work.",
    "Invoice received and approved. Payment scheduled for next Friday.",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare className="w-4 h-4" />
          Send SMS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Send SMS to Subcontractor
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <p className="text-lg font-bold text-gray-800">Message Sent!</p>
            <p className="text-gray-500 text-sm mt-1">
              Delivered to {vendor?.phone}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recipient Info */}
            <div className="bg-slate-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-4 h-4 text-primary" />
                <span className="font-bold text-gray-800 text-sm">
                  {vendor?.contact_name || vendor?.company_name}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {vendor?.company_name && <div>{vendor.company_name}</div>}
                <div>{vendor?.phone}</div>
                {vendor?.email && <div>{vendor.email}</div>}
              </div>
            </div>

            {/* Quick Messages */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Quick Messages (optional)
              </label>
              <div className="space-y-2">
                {quickMessages.map((msg, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMessage(msg)}
                    className="w-full text-left text-sm bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 text-gray-600 rounded-xl px-3 py-2.5 transition-colors"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Message */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Or Write Your Own
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="h-24 text-sm"
                maxLength={160}
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-400">
                  {message.length}/160 characters
                </span>
                {message.length > 160 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    May send as multiple messages
                  </Badge>
                )}
              </div>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim() || !vendor?.phone}
              className="w-full bg-primary hover:bg-[#c94522] text-white font-semibold"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}