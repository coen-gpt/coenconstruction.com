import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, parsedBody) {
  const base44 = createClientFromRequest(req);
  const body = parsedBody || await req.clone().json().catch(() => ({}));
  const auth = req.headers.get('authorization') || '';
  const token = String(body.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates');

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { estimate_id, project_id } = await req.json();

    if (!estimate_id || !project_id) {
      return Response.json({ error: 'estimate_id and project_id are required' }, { status: 400 });
    }

    // QuickBooks credentials: client id/secret from secrets; refresh token and
    // realm id come from the in-app Connect QuickBooks flow (SyncState key
    // "quickbooks_oauth"), with env vars as a fallback.
    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");
    const qbStates = await base44.asServiceRole.entities.SyncState.filter({ key: 'quickbooks_oauth' });
    const qbStored = qbStates[0];
    let realmId = Deno.env.get("QUICKBOOKS_REALM_ID");
    if (!realmId && qbStored?.data) {
      try { realmId = JSON.parse(qbStored.data).realm_id; } catch (_) {}
    }
    const refreshToken = qbStored?.sync_token || Deno.env.get("QUICKBOOKS_REFRESH_TOKEN");

    if (!clientId || !clientSecret || !realmId || !refreshToken) {
      return Response.json({ error: 'QuickBooks credentials not configured' }, { status: 500 });
    }

    // Get estimate and project data
    const estimate = await base44.asServiceRole.entities.Estimate.get(estimate_id);
    const project = await base44.asServiceRole.entities.ContractorProject.get(project_id);

    if (!estimate || !project) {
      return Response.json({ error: 'Estimate or project not found' }, { status: 404 });
    }

    // Get or create QuickBooks access token
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('QuickBooks token refresh failed', { status: tokenResponse.status, intuit_tid: tokenResponse.headers.get('intuit_tid') });
      return Response.json({ error: 'QuickBooks authentication failed', details: error }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Intuit rotates refresh tokens — persist the newest so we never go stale.
    if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
      const rotated = { sync_token: tokenData.refresh_token, last_synced_at: new Date().toISOString() };
      if (qbStored) await base44.asServiceRole.entities.SyncState.update(qbStored.id, rotated);
      else await base44.asServiceRole.entities.SyncState.create({ key: 'quickbooks_oauth', ...rotated, data: JSON.stringify({ realm_id: realmId }) });
    }

    // Map estimate line items to QuickBooks format
    const lineItems = estimate.line_items.map((item, index) => ({
      Description: item.description || item.title,
      Amount: item.total || 0,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: {
          value: '1', // Default service item - should be configurable
          name: 'Construction Services'
        },
        Qty: item.quantity || 1,
        UnitPrice: item.unit_cost || item.total || 0,
        TaxCodeRef: {
          value: 'NON' // Non-taxable by default
        }
      }
    }));

    // Add subtotal line
    lineItems.push({
      DetailType: 'SubTotalLineDetail',
      SubTotalLineDetail: {}
    });

    // Create QuickBooks Invoice payload
    const invoicePayload = {
      CustomerRef: {
        value: project.quickbooks_customer_id || '1' // Will create customer if doesn't exist
      },
      Line: lineItems,
      CustomerMemo: `Project: ${project.client_name} - ${project.project_type}`,
      BillAddr: {
        Line1: project.client_address || '',
        City: project.client_city || '',
        PostalCode: project.client_zipcode || '',
        Country: 'USA'
      },
      EmailRef: {
        Address: project.client_email || ''
      },
      DocNumber: `EST-${estimate_id.substring(0, 8).toUpperCase()}`,
      PrivateNote: `Estimate Version ${estimate.version} - ${estimate.type}`,
      DueDate: estimate.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      TxnDate: new Date().toISOString().split('T')[0]
    };

    // Create or update customer in QuickBooks if needed
    let customerId = project.quickbooks_customer_id;

    if (!customerId) {
      // Create new customer
      const customerPayload = {
        DisplayName: project.client_name,
        GivenName: project.client_name.split(' ')[0],
        FamilyName: project.client_name.split(' ').slice(1).join(' '),
        PrimaryEmailAddr: {
          Address: project.client_email
        },
        PrimaryPhone: {
          FreeFormNumber: project.client_phone
        },
        BillAddr: {
          Line1: project.client_address || '',
          City: project.client_city || '',
          PostalCode: project.client_zipcode || '',
          Country: 'USA'
        },
        Notes: `Project Type: ${project.project_type}\nAddress: ${project.client_address}, ${project.client_city}, ${project.client_zipcode}`
      };

      const customerResponse = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realmId}/customer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(customerPayload)
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.json();
        return Response.json({ error: 'Failed to create QuickBooks customer', details: error }, { status: 500 });
      }

      const customerData = await customerResponse.json();
      customerId = customerData.Customer.Id;

      // Update project with QuickBooks customer ID
      await base44.asServiceRole.entities.ContractorProject.update(project.id, {
        quickbooks_customer_id: customerId
      });
    }

    // Update invoice payload with customer ID
    invoicePayload.CustomerRef.value = customerId;

    // Create invoice in QuickBooks
    const invoiceResponse = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!invoiceResponse.ok) {
      const error = await invoiceResponse.json();
      return Response.json({ error: 'Failed to create QuickBooks invoice', details: error }, { status: 500 });
    }

    const invoiceData = await invoiceResponse.json();
    const quickbooksInvoiceId = invoiceData.Invoice.Id;
    const quickbooksInvoiceNumber = invoiceData.Invoice.DocNumber;

    // Update estimate with QuickBooks sync data
    await base44.asServiceRole.entities.Estimate.update(estimate.id, {
      quickbooks_invoice_id: quickbooksInvoiceId,
      quickbooks_invoice_number: quickbooksInvoiceNumber,
      quickbooks_synced_at: new Date().toISOString(),
      quickbooks_sync_status: 'synced'
    });

    // Create sync log
    await base44.asServiceRole.entities.ContractorProject.update(project.id, {
      quickbooks_last_sync: new Date().toISOString(),
      quickbooks_sync_status: 'synced'
    });

    return Response.json({
      success: true,
      quickbooks_invoice_id: quickbooksInvoiceId,
      quickbooks_invoice_number: quickbooksInvoiceNumber,
      quickbooks_customer_id: customerId,
      message: 'Estimate synced to QuickBooks successfully'
    });

  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ 
      error: 'QuickBooks sync failed', 
      details: error.message,
      sync_status: 'error'
    }, { status });
  }
});