import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { password } = await req.json();
    
    const adminPassword = Deno.env.get("ADMIN_LEADS_PASSWORD");
    const isValid = password === adminPassword;
    
    return Response.json({ valid: isValid });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});