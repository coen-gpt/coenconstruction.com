import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, AlertCircle, ExternalLink, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function QuickBooksSyncPanel({ project, estimate }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleSyncToQuickBooks = async () => {
    if (!estimate) {
      toast({
        title: "No Estimate Found",
        description: "Please create an estimate before syncing to QuickBooks.",
        variant: "destructive"
      });
      return;
    }

    if (estimate.status !== 'approved') {
      toast({
        title: "Estimate Not Approved",
        description: "Only approved estimates can be synced to QuickBooks.",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);

    try {
      const response = await base44.functions.invoke('syncEstimateToQuickBooks', {
        estimate_id: estimate.id,
        project_id: project.id
      });

      if (response.data.success) {
        toast({
          title: "QuickBooks Sync Successful",
          description: `Invoice #${response.data.quickbooks_invoice_number} created in QuickBooks.`,
          variant: "default"
        });

        // Refresh project data
        window.location.reload();
      } else {
        throw new Error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast({
        title: "QuickBooks Sync Failed",
        description: error.message || 'An error occurred while syncing to QuickBooks.',
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getSyncStatusBadge = () => {
    const syncStatus = estimate?.quickbooks_sync_status || project?.quickbooks_sync_status || 'not_synced';
    
    switch (syncStatus) {
      case 'synced':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Synced
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            Not Synced
          </Badge>
        );
    }
  };

  const getQuickBooksUrl = (invoiceId) => {
    const realmId = '123146589054320'; // This should be from CompanyProfile or config
    return `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>QuickBooks Integration</span>
          {getSyncStatusBadge()}
        </CardTitle>
        <CardDescription>
          Sync approved estimates to QuickBooks for invoicing and accounting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Customer Name:</span>
              <p className="font-medium">{project.client_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">QuickBooks ID:</span>
              <p className="font-medium">
                {project.quickbooks_customer_id || 'Not synced yet'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p className="font-medium">{project.client_email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Phone:</span>
              <p className="font-medium">{project.client_phone}</p>
            </div>
          </div>
        </div>

        {/* Last Sync Info */}
        {project.quickbooks_last_sync && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Sync History</h4>
            <div className="text-sm">
              <span className="text-muted-foreground">Last Synced:</span>
              <p className="font-medium">
                {new Date(project.quickbooks_last_sync).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Estimate Info */}
        {estimate && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Estimate Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Estimate Total:</span>
                <p className="font-medium">${estimate.grand_total?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">QuickBooks Invoice:</span>
                <p className="font-medium">
                  {estimate.quickbooks_invoice_number || 'Not synced'}
                </p>
              </div>
              {estimate.quickbooks_synced_at && (
                <div>
                  <span className="text-muted-foreground">Synced At:</span>
                  <p className="font-medium">
                    {new Date(estimate.quickbooks_synced_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* View in QuickBooks Link */}
            {estimate.quickbooks_invoice_id && (
              <a
                href={getQuickBooksUrl(estimate.quickbooks_invoice_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Invoice in QuickBooks
              </a>
            )}
          </div>
        )}

        {/* Sync Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleSyncToQuickBooks}
            disabled={isSyncing || !estimate || estimate.status !== 'approved'}
            className="w-full"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing to QuickBooks...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {estimate?.quickbooks_invoice_id ? 'Re-sync to QuickBooks' : 'Sync to QuickBooks'}
              </>
            )}
          </Button>

          {estimate && estimate.status !== 'approved' && (
            <p className="text-xs text-muted-foreground mt-2">
              * Estimate must be approved before syncing to QuickBooks
            </p>
          )}
        </div>

        {/* Field Mapping Info */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">Field Mapping</h4>
          <div className="text-xs space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Client Name → QuickBooks Customer.DisplayName</span>
            </div>
            <div className="flex justify-between">
              <span>Client Email → QuickBooks Customer.PrimaryEmailAddr</span>
            </div>
            <div className="flex justify-between">
              <span>Estimate Line Items → QuickBooks Invoice.Line</span>
            </div>
            <div className="flex justify-between">
              <span>Estimate Total → QuickBooks Invoice.TotalAmt</span>
            </div>
            <div className="flex justify-between">
              <span>Project Address → QuickBooks Customer.BillAddr</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}