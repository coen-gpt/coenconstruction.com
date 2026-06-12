/**
 * Shared classification for InvoiceRecords: material receipts (Home Depot etc.)
 * are project costs (Invoices > Project Costs), never gated sub payments.
 * The same rules are mirrored in base44/functions/computeInvoiceGates.
 */
export const isHomeDepot = (r) =>
  /homedepot\.com/i.test(r.vendor_email || '') || /home depot/i.test(r.vendor_name || '');

export const isMaterialReceipt = (r) => r.document_type === 'receipt' || isHomeDepot(r);
