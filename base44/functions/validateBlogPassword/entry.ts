Deno.serve(async () => {
  return Response.json({ error: 'Legacy password login is disabled. Please use the secure admin login.' }, { status: 410 });
});