import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONNECTOR_ID = "69d54a88eda656e7e3d1f856"; // Team Gmail - Invoice Scanner

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can connect the shared Gmail account.' }, { status: 403 });
    }

    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});