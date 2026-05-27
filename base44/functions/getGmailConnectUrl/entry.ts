import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// App user connector for Gmail - each team member connects their own account
const CONNECTOR_ID = "69d54a88eda656e7e3d1f856"; // Team Gmail - Invoice Scanner

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get OAuth URL for this app user connector
    // The redirect URI is automatically handled by Base44 platform
    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});