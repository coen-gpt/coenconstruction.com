import { Mail, ShieldCheck, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoiceConnectPanel({ onConnect }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Mail className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">Connect Gmail Inbox</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
        Connect the Gmail account to scan for invoices, proposals, quotes, and bills. Once connected, all admin users share the same inbox — no need to reconnect per user.
      </p>
      <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm text-gray-600">
        <div className="flex items-center gap-1.5"><FileSearch className="w-4 h-4 text-primary" /> Auto-detects attachments</div>
        <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" /> Read-only access</div>
        <div className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-primary" /> Shared across all admins</div>
      </div>
      <Button onClick={onConnect} className="px-6">
        <Mail className="w-4 h-4" /> Connect Gmail Account
      </Button>
    </div>
  );
}