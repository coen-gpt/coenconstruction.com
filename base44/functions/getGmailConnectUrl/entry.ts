import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONNECTOR_ID = "69d7eb8b559525f8d2292321"; // Inbox & Quote Scanning

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // connectAppUser requires the user to be authenticated via the request context
    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    return Response.json({ url });
  } catch (error) {
    console.error('Gmail connect error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to generate Gmail connection URL'
    }, { status: 500 });
  }
});