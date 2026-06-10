import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * QuickBooks-powered deposit collection (public, portal-token secured).
 *
 * Replaces Stripe. When the customer chooses "Pay Online" in the portal:
 *  1. Ensures the client exists as a QuickBooks Customer (syncs name, email,
 *     phone, address; saves the QBO id on the project).
 *  2. Syncs the approved quote to QuickBooks as an Estimate (once).
 *  3. Creates ONE deposit Invoice with card + ACH online payments enabled and
 *     returns Intuit's hosted payment link — the page is branded with the
 *     company logo configured in QuickBooks, and funds settle through
 *     QuickBooks Payments like every other invoice the business sends.
 *
 * action: "check_status" re-reads the deposit invoice; when QuickBooks shows
 * it paid (balance 0), the project is activated: deposit_paid, portal access,
 * status in_progress, office + customer notified.
 *
 * Env: QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET / QUICKBOOKS_REALM_ID /
 * QUICKBOOKS_REFRESH_TOKEN. Intuit rotates refresh tokens, so the newest one
 * is persisted in SyncState (key "quickbooks_oauth") and preferred over the
 * env seed value.
 */

const QB_BASE = 'https://quickbooks.api.intuit.com';
const MINOR = 'minorversion=65';

async function qbAuth(base44) {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  const realmId = Deno.env.get('QUICKBOOKS_REALM_ID');
  if (!clientId || !clientSecret || !realmId) {
    throw Object.assign(new Error('QuickBooks is not configured'), { httpStatus: 503 });
  }

  const states = await base44.asServiceRole.entities.SyncState.filter({ key: 'quickbooks_oauth' });
  const stored = states[0];
  const refreshToken = stored?.sync_token || Deno.env.get('QUICKBOOKS_REFRESH_TOKEN');
  if (!refreshToken) throw Object.assign(new Error('QuickBooks is not configured'), { httpStatus: 503 });

  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) throw Object.assign(new Error('QuickBooks authentication failed'), { httpStatus: 502 });
  const tok = await res.json();

  // Intuit rotates refresh tokens — persist the newest so we never go stale.
  if (tok.refresh_token && tok.refresh_token !== refreshToken) {
    const payload = { sync_token: tok.refresh_token, last_synced_at: new Date().toISOString() };
    if (stored) await base44.asServiceRole.entities.SyncState.update(stored.id, payload);
    else await base44.asServiceRole.entities.SyncState.create({ key: 'quickbooks_oauth', ...payload });
  }

  return { accessToken: tok.access_token, realmId };
}

function qbHeaders(accessToken) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function qbPost(qb, path, payload) {
  const res = await fetch(`${QB_BASE}/v3/company/${qb.realmId}/${path}?${MINOR}`, {
    method: 'POST',
    headers: qbHeaders(qb.accessToken),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.Fault?.Error?.[0]?.Message || data?.Fault?.Error?.[0]?.Detail || res.status;
    throw new Error(`QuickBooks ${path} failed: ${detail}`);
  }
  return data;
}

async function qbQuery(qb, query) {
  const res = await fetch(
    `${QB_BASE}/v3/company/${qb.realmId}/query?query=${encodeURIComponent(query)}&${MINOR}`,
    { headers: qbHeaders(qb.accessToken) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('QuickBooks query failed');
  return data?.QueryResponse || {};
}

async function qbReadInvoice(qb, invoiceId) {
  const res = await fetch(
    `${QB_BASE}/v3/company/${qb.realmId}/invoice/${invoiceId}?${MINOR}&include=invoiceLink`,
    { headers: qbHeaders(qb.accessToken) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Could not read the deposit invoice from QuickBooks');
  return data?.Invoice;
}

// Customer-facing unit price: line total (markup included) / qty.
function customerLines(items) {
  return (items || []).map((item) => {
    const qty = Number(item.quantity) || 1;
    const total = Number(item.total) || 0;
    return {
      Description: [item.title, item.description?.replace(/\*+/g, '')].filter(Boolean).join(' — ').slice(0, 4000),
      Amount: Math.round(total * 100) / 100,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Construction Services' },
        Qty: qty,
        UnitPrice: Math.round((total / qty) * 100) / 100,
        TaxCodeRef: { value: 'NON' },
      },
    };
  });
}

async function ensureCustomer(qb, base44, project) {
  if (project.quickbooks_customer_id) return project.quickbooks_customer_id;

  // Reuse an existing QBO customer with the same display name (avoids
  // Duplicate Name errors for repeat clients).
  const safeName = String(project.client_name || '').replace(/'/g, "\\'");
  const found = await qbQuery(qb, `select Id from Customer where DisplayName = '${safeName}'`);
  let customerId = found?.Customer?.[0]?.Id;

  if (!customerId) {
    const created = await qbPost(qb, 'customer', {
      DisplayName: project.client_name,
      GivenName: project.client_name?.split(' ')[0],
      FamilyName: project.client_name?.split(' ').slice(1).join(' ') || undefined,
      PrimaryEmailAddr: project.client_email ? { Address: project.client_email } : undefined,
      PrimaryPhone: project.client_phone ? { FreeFormNumber: project.client_phone } : undefined,
      BillAddr: {
        Line1: project.client_address || '',
        City: project.client_city || '',
        PostalCode: project.client_zipcode || '',
        Country: 'USA',
      },
      Notes: `Project: ${project.project_type || ''} — synced from coenconstruction.com`,
    });
    customerId = created?.Customer?.Id;
  }

  if (customerId) {
    await base44.asServiceRole.entities.ContractorProject.update(project.id, {
      quickbooks_customer_id: customerId,
    });
  }
  return customerId;
}

async function ensureQboEstimate(qb, base44, project, estimate, customerId) {
  if (!estimate || estimate.quickbooks_estimate_id) return estimate?.quickbooks_estimate_id || null;
  try {
    const created = await qbPost(qb, 'estimate', {
      CustomerRef: { value: customerId },
      Line: customerLines(estimate.line_items),
      DocNumber: `Q-${String(estimate.id).slice(0, 8).toUpperCase()}`,
      TxnDate: new Date().toISOString().split('T')[0],
      ExpirationDate: estimate.valid_until || undefined,
      CustomerMemo: estimate.notes ? { value: String(estimate.notes).slice(0, 1000) } : undefined,
      PrivateNote: `Signed estimate v${estimate.version || 1} — synced automatically from coenconstruction.com`,
      BillEmail: project.client_email ? { Address: project.client_email } : undefined,
    });
    const qboId = created?.Estimate?.Id;
    if (qboId) {
      await base44.asServiceRole.entities.Estimate.update(estimate.id, {
        quickbooks_estimate_id: qboId,
        quickbooks_synced_at: new Date().toISOString(),
        quickbooks_sync_status: 'synced',
      });
      await base44.asServiceRole.entities.ContractorProject.update(project.id, {
        quickbooks_last_sync: new Date().toISOString(),
        quickbooks_sync_status: 'synced',
      });
    }
    return qboId;
  } catch (_) {
    // Estimate sync is best-effort — never block the customer's payment.
    return null;
  }
}

async function markDepositPaid(base44, project, invoice) {
  await base44.asServiceRole.entities.ContractorProject.update(project.id, {
    deposit_paid: true,
    deposit_paid_at: new Date().toISOString(),
    deposit_payment_method: 'quickbooks',
    deposit_transaction_id: `qb_invoice_${invoice.Id}`,
    portal_access_granted: true,
    status: 'in_progress',
  });
  const amount = Number(invoice.TotalAmt) || project.deposit_amount || 0;
  if (project.client_email) {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: project.client_email,
        subject: `Deposit Received — ${project.project_type || 'Your'} Project`,
        body: `Hi ${project.client_name},\n\nThank you! We've received your deposit of $${amount.toLocaleString()} for your ${project.project_type || ''} project.\n\nYour customer portal is now fully active — project updates, photos, and your project manager are one tap away.\n\nWe look forward to building with you!\n\nCoen Construction LLC\n(781) 999-5400`,
      });
    } catch (_) {}
  }
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'scott@coenconstruction.com',
      subject: `💰 Deposit Received — ${project.client_name} ($${amount.toLocaleString()})`,
      body: `Deposit paid through QuickBooks!\n\nClient: ${project.client_name}\nProject: ${project.project_type || ''} at ${project.client_address || ''}\nDeposit: $${amount.toLocaleString()}\nQuickBooks Invoice: #${invoice.DocNumber} (Id ${invoice.Id})\n\nProject status moved to In Progress and the customer portal is fully active.`,
    });
  } catch (_) {}
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, action } = await req.json();
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    // Resolve the project from the customer-portal token — never from the body.
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) return Response.json({ error: 'Invalid portal link' }, { status: 403 });
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: 'This portal link has expired' }, { status: 410 });
    }
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: portal.project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    if (project.deposit_paid) {
      return Response.json({ paid: true, message: 'Deposit already received' });
    }

    // ── action: check_status ─────────────────────────────────────────────────
    if (action === 'check_status') {
      if (!project.quickbooks_deposit_invoice_id) {
        return Response.json({ paid: false, no_invoice: true });
      }
      const qb = await qbAuth(base44);
      const invoice = await qbReadInvoice(qb, project.quickbooks_deposit_invoice_id);
      if (invoice && Number(invoice.Balance) === 0 && Number(invoice.TotalAmt) > 0) {
        await markDepositPaid(base44, project, invoice);
        return Response.json({ paid: true });
      }
      return Response.json({
        paid: false,
        payment_url: invoice?.InvoiceLink || null,
        invoice_number: invoice?.DocNumber || null,
      });
    }

    // ── default: create (or reuse) the deposit invoice and return the link ───
    const qb = await qbAuth(base44);

    // Reuse the existing deposit invoice if one was already created.
    if (project.quickbooks_deposit_invoice_id) {
      const existing = await qbReadInvoice(qb, project.quickbooks_deposit_invoice_id);
      if (existing) {
        if (Number(existing.Balance) === 0 && Number(existing.TotalAmt) > 0) {
          await markDepositPaid(base44, project, existing);
          return Response.json({ paid: true });
        }
        return Response.json({
          payment_url: existing.InvoiceLink || null,
          invoice_number: existing.DocNumber,
          amount: Number(existing.TotalAmt),
        });
      }
    }

    // Deposit amount: set at signing, or company % of the approved estimate.
    const estimates = await base44.asServiceRole.entities.Estimate.filter({ project_id: project.id });
    const original = estimates.find(e => e.type === 'original' && e.status !== 'superseded') || estimates[0];
    let depositAmount = Number(project.deposit_amount) || 0;
    if (!depositAmount) {
      let pct = 33;
      try {
        const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
        pct = Number(profiles[0]?.deposit_percentage) || 33;
      } catch (_) {}
      depositAmount = Math.round((Number(original?.grand_total) || 0) * pct / 100);
    }
    if (!depositAmount || depositAmount <= 0) {
      return Response.json({ error: 'No deposit amount is set for this project yet — please contact us at (781) 999-5400.' }, { status: 400 });
    }

    const customerId = await ensureCustomer(qb, base44, project);
    if (!customerId) return Response.json({ error: 'Could not sync the customer to QuickBooks' }, { status: 502 });

    // Keep QuickBooks complete: the signed quote goes over as a QBO Estimate.
    await ensureQboEstimate(qb, base44, project, original, customerId);

    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const created = await qbPost(qb, 'invoice', {
      CustomerRef: { value: customerId },
      Line: [{
        Description: `Project deposit — ${project.project_type || 'construction project'} at ${project.client_address || project.client_city || ''}`.trim(),
        Amount: depositAmount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: '1', name: 'Construction Services' },
          Qty: 1,
          UnitPrice: depositAmount,
          TaxCodeRef: { value: 'NON' },
        },
      }],
      DocNumber: `DEP-${String(project.id).slice(-6).toUpperCase()}`,
      TxnDate: new Date().toISOString().split('T')[0],
      DueDate: due,
      BillEmail: project.client_email ? { Address: project.client_email } : undefined,
      CustomerMemo: { value: 'Project deposit — paying this activates your project and customer portal. Thank you! — Coen Construction LLC, (781) 999-5400' },
      PrivateNote: 'Deposit invoice created automatically by the customer portal',
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment: true,
    });

    const invoiceId = created?.Invoice?.Id;
    await base44.asServiceRole.entities.ContractorProject.update(project.id, {
      quickbooks_deposit_invoice_id: invoiceId,
      deposit_amount: depositAmount,
      quickbooks_last_sync: new Date().toISOString(),
      quickbooks_sync_status: 'synced',
    });

    // The pay-enabled link comes back on a follow-up read.
    const invoice = await qbReadInvoice(qb, invoiceId);
    return Response.json({
      payment_url: invoice?.InvoiceLink || null,
      invoice_number: invoice?.DocNumber || created?.Invoice?.DocNumber,
      amount: depositAmount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.httpStatus || 500 });
  }
});
