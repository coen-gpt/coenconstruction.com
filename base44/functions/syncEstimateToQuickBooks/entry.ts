import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const QBO_BASE = 'https://quickbooks.api.intuit.com/v3/company';

// Exchange refresh token for a fresh access token
async function getAccessToken(base44Client) {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  // Use env secret first, fall back to DB-stored token
  let refreshToken = Deno.env.get('QUICKBOOKS_REFRESH_TOKEN');
  if (!refreshToken && base44Client) {
    const stored = await base44Client.asServiceRole.entities.AppSettings.filter({ key: 'qb_refresh_token' });
    refreshToken = stored[0]?.value;
  }
  if (!refreshToken) throw new Error('No QuickBooks refresh token configured. Please add it in Company Profile → QuickBooks Integration.');

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`QBO token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Find or create a QBO customer by email
async function findOrCreateCustomer(accessToken, realmId, project) {
  const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${project.client_email}'`;
  const searchRes = await fetch(
    `${QBO_BASE}/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );
  const searchData = await searchRes.json();
  const existing = searchData?.QueryResponse?.Customer?.[0];
  if (existing) return existing;

  // Create new customer
  const displayName = project.client_name || project.client_email;
  const createRes = await fetch(`${QBO_BASE}/${realmId}/customer?minorversion=65`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      DisplayName: displayName,
      PrimaryEmailAddr: { Address: project.client_email },
      PrimaryPhone: project.client_phone ? { FreeFormNumber: project.client_phone } : undefined,
      BillAddr: project.client_address ? {
        Line1: project.client_address,
        City: project.client_city || '',
        PostalCode: project.client_zipcode || '',
      } : undefined,
    }),
  });
  const createData = await createRes.json();
  if (!createData?.Customer) {
    throw new Error(`Failed to create QBO customer: ${JSON.stringify(createData)}`);
  }
  return createData.Customer;
}

// Build QBO invoice line items from estimate line items
function buildLineItems(lineItems) {
  const lines = (lineItems || [])
    .filter(item => item.title && item.total)
    .map((item, idx) => ({
      Id: String(idx + 1),
      LineNum: idx + 1,
      Description: [item.title, item.description].filter(Boolean).join(' — '),
      Amount: Number((item.total || 0).toFixed(2)),
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        Qty: item.quantity || 1,
        UnitPrice: Number((item.unit_cost || item.total || 0).toFixed(2)),
      },
    }));

  return lines;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // ── Handle token save action ──────────────────────────────────────────
    if (body.action === 'save_tokens') {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
      // Store tokens in AppSettings entity for persistence
      if (body.refresh_token) {
        const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: 'qb_refresh_token' });
        if (existing[0]) {
          await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { value: body.refresh_token });
        } else {
          await base44.asServiceRole.entities.AppSettings.create({ key: 'qb_refresh_token', value: body.refresh_token });
        }
      }
      if (body.access_token) {
        const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: 'qb_access_token' });
        if (existing[0]) {
          await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { value: body.access_token });
        } else {
          await base44.asServiceRole.entities.AppSettings.create({ key: 'qb_access_token', value: body.access_token });
        }
      }
      return Response.json({ success: true, message: 'Tokens saved successfully.' });
    }

    // Accept direct call with estimate_id OR automation payload
    const estimateId = body.estimate_id || body.event?.entity_id;
    if (!estimateId) {
      return Response.json({ error: 'estimate_id is required' }, { status: 400 });
    }

    const realmId = Deno.env.get('QUICKBOOKS_REALM_ID');

    // Load the estimate
    const estimates = await base44.asServiceRole.entities.Estimate.filter({ id: estimateId });
    const estimate = estimates[0];
    if (!estimate) {
      return Response.json({ error: 'Estimate not found' }, { status: 404 });
    }
    if (estimate.status !== 'approved') {
      return Response.json({ message: 'Estimate is not in approved status — skipped.' });
    }

    // Load the linked project
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: estimate.project_id });
    const project = projects[0];
    if (!project) {
      return Response.json({ error: 'Linked project not found' }, { status: 404 });
    }
    if (!project.client_email) {
      return Response.json({ error: 'Project has no client email — cannot map QBO customer.' }, { status: 400 });
    }

    const accessToken = await getAccessToken(base44);

    // Find or create customer in QBO
    const customer = await findOrCreateCustomer(accessToken, realmId, project);

    // Build line items
    const lines = buildLineItems(estimate.line_items);
    if (lines.length === 0) {
      return Response.json({ error: 'Estimate has no valid line items to sync.' }, { status: 400 });
    }

    // Add tax line if applicable
    if (estimate.tax_amount && estimate.tax_amount > 0) {
      lines.push({
        Id: String(lines.length + 1),
        LineNum: lines.length + 1,
        Description: `Tax (${estimate.tax_rate || 0}%)`,
        Amount: Number(estimate.tax_amount.toFixed(2)),
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: Number(estimate.tax_amount.toFixed(2)),
        },
      });
    }

    // Build invoice memo
    const memo = [
      `Coen Construction Estimate #${estimate.version || 1}`,
      project.project_type ? `Project: ${project.project_type}` : null,
      project.client_address ? `Address: ${project.client_address}` : null,
      estimate.notes || null,
    ].filter(Boolean).join('\n');

    // Create the invoice in QBO
    const invoicePayload = {
      CustomerRef: { value: customer.Id, name: customer.DisplayName },
      Line: lines,
      CustomerMemo: { value: memo },
      TxnDate: new Date().toISOString().split('T')[0],
      DueDate: estimate.valid_until || undefined,
      PrivateNote: `Synced from Coen Construction estimate. Project ID: ${project.id}`,
    };

    const invoiceRes = await fetch(`${QBO_BASE}/${realmId}/invoice?minorversion=65`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    const invoiceData = await invoiceRes.json();
    if (!invoiceData?.Invoice) {
      throw new Error(`QBO invoice creation failed: ${JSON.stringify(invoiceData)}`);
    }

    const qboInvoice = invoiceData.Invoice;

    return Response.json({
      success: true,
      qbo_invoice_id: qboInvoice.Id,
      qbo_invoice_number: qboInvoice.DocNumber,
      qbo_customer_id: customer.Id,
      qbo_customer_name: customer.DisplayName,
      total: qboInvoice.TotalAmt,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});