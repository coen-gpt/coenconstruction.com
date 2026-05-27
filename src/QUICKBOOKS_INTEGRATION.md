# QuickBooks Integration Guide

## Overview

The QuickBooks integration automatically syncs approved estimates and customer data from the Coen Construction app to QuickBooks Online, creating invoices and customers for seamless accounting workflows.

## Features

### 1. **Automatic Customer Creation**
- Creates new customers in QuickBooks if they don't exist
- Maps client information from ContractorProject entity
- Stores QuickBooks Customer ID for future reference

### 2. **Estimate to Invoice Conversion**
- Converts approved estimates into QuickBooks invoices
- Preserves line items, quantities, and pricing
- Includes project details in invoice memos

### 3. **Field Mapping**

| App Field | QuickBooks Field |
|-----------|------------------|
| `client_name` | Customer.DisplayName |
| `client_email` | Customer.PrimaryEmailAddr.Address |
| `client_phone` | Customer.PrimaryPhone.FreeFormNumber |
| `client_address` | Customer.BillAddr.Line1 |
| `client_city` | Customer.BillAddr.City |
| `client_zipcode` | Customer.BillAddr.PostalCode |
| `estimate.line_items` | Invoice.Line |
| `estimate.grand_total` | Invoice.TotalAmt |
| `project.project_type` | Customer.Notes |

### 4. **Sync Status Tracking**
- Real-time sync status on estimates and projects
- Timestamps for last sync
- Error handling and logging

## Setup

### Required Secrets

Configure the following secrets in your Base44 dashboard:

1. **QUICKBOOKS_CLIENT_ID** - Your QuickBooks OAuth client ID
2. **QUICKBOOKS_CLIENT_SECRET** - Your QuickBooks OAuth client secret
3. **QUICKBOOKS_REALM_ID** - Your QuickBooks company ID (Realm ID)
4. **QUICKBOOKS_REFRESH_TOKEN** - OAuth refresh token for API access

### Getting QuickBooks Credentials

1. Go to [Intuit Developer Portal](https://developer.intuit.com/)
2. Create a new app or select existing
3. Navigate to Keys & OAuth
4. Copy Client ID and Client Secret
5. Connect to your QuickBooks company to get Realm ID
6. Use OAuth playground or flow to get refresh token

## Usage

### For Estimators

1. **Create and Approve Estimate**
   - Navigate to a project
   - Create estimate with line items
   - Mark estimate as "approved"

2. **Sync to QuickBooks**
   - Go to "QuickBooks" tab in project detail
   - Click "Sync to QuickBooks" button
   - Wait for confirmation message

3. **View Synced Invoice**
   - Click "View Invoice in QuickBooks" link
   - Opens invoice in QuickBooks Online

### For Admins

- Monitor sync status across all projects
- View sync history in project overview
- Troubleshoot failed syncs via error messages

## API Endpoint

### `syncEstimateToQuickBooks`

**Function:** `functions/syncEstimateToQuickBooks`

**Payload:**
```json
{
  "estimate_id": "string",
  "project_id": "string"
}
```

**Response (Success):**
```json
{
  "success": true,
  "quickbooks_invoice_id": "123",
  "quickbooks_invoice_number": "1001",
  "quickbooks_customer_id": "456",
  "message": "Estimate synced to QuickBooks successfully"
}
```

**Response (Error):**
```json
{
  "error": "QuickBooks sync failed",
  "details": "Error message here",
  "sync_status": "error"
}
```

## Entity Changes

### ContractorProject Entity

Added fields:
- `quickbooks_customer_id` (string) - QuickBooks Customer ID
- `quickbooks_last_sync` (string) - ISO datetime of last sync
- `quickbooks_sync_status` (enum) - not_synced | synced | error | pending

### Estimate Entity

Added fields:
- `quickbooks_invoice_id` (string) - QuickBooks Invoice ID
- `quickbooks_invoice_number` (string) - QuickBooks Invoice Number
- `quickbooks_synced_at` (string) - ISO datetime when synced
- `quickbooks_sync_status` (enum) - not_synced | synced | error | pending

## Error Handling

### Common Errors

1. **"QuickBooks credentials not configured"**
   - Solution: Add required secrets in dashboard

2. **"QuickBooks authentication failed"**
   - Solution: Refresh token may be expired, re-authorize

3. **"Estimate Not Approved"**
   - Solution: Only approved estimates can be synced

4. **"Failed to create QuickBooks customer"**
   - Solution: Check customer data completeness

5. **"Failed to create QuickBooks invoice"**
   - Solution: Verify line items have valid amounts

### Graceful Degradation

- Sync failures don't block app functionality
- Error details logged for debugging
- Users can retry sync after fixing issues
- Sync status clearly visible in UI

## Component: QuickBooksSyncPanel

**Location:** `components/estimator/QuickBooksSyncPanel`

**Props:**
- `project` - ContractorProject object
- `estimate` - Estimate object (optional)

**Features:**
- Real-time sync status badge
- Customer information display
- Sync history timeline
- Direct link to QuickBooks invoice
- Field mapping documentation
- One-click sync button

## Testing

### Test Flow

1. Create test project with sample client data
2. Generate estimate with multiple line items
3. Approve estimate
4. Click "Sync to QuickBooks"
5. Verify customer created in QuickBooks
6. Verify invoice created with correct amounts
7. Check sync status updates in app

### Test Data

Use test company/sandbox mode in QuickBooks for initial testing to avoid creating real invoices.

## Future Enhancements

- [ ] Bi-directional sync (payments from QB to app)
- [ ] Automatic sync on estimate approval
- [ ] Support for multiple estimate versions
- [ ] Payment tracking and reconciliation
- [ ] Expense categorization
- [ ] Recurring invoice templates
- [ ] Multi-company support

## Support

For issues or questions:
1. Check error logs in function execution
2. Verify QuickBooks credentials are valid
3. Ensure estimate is in "approved" status
4. Contact QuickBooks API support for API-specific issues

## Security

- All API calls use OAuth 2.0 authentication
- Refresh tokens stored securely as secrets
- No QuickBooks credentials exposed in frontend
- User authentication required for sync operations
- Admin role verification for sensitive operations