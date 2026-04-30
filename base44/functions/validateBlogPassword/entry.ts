import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { password } = await req.json();
  const adminPassword = Deno.env.get("ADMIN_BLOG_PASSWORD");

  if (!adminPassword) {
    return Response.json({ error: "Blog admin password not configured" }, { status: 500 });
  }

  return Response.json({ valid: password === adminPassword });
});