// Server-side Cloudflare Turnstile verification.
//
// Frontend forms call this with the widget token before creating records.
// If TURNSTILE_SECRET_KEY is not configured yet, verification is skipped so
// forms keep working until the Cloudflare keys are added as app secrets.
Deno.serve(async (req) => {
  // Returned to the caller so forms can persist the IP on SMS consent records.
  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();

    const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!secret) {
      return Response.json({ success: true, skipped: true, ip: clientIp });
    }

    if (!token || token === "turnstile-not-configured") {
      return Response.json(
        { success: false, error: "Please complete the security check." },
        { status: 400 },
      );
    }

    const form = new URLSearchParams({ secret, response: token });
    if (clientIp) form.set("remoteip", clientIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const data = await res.json();

    if (!data.success) {
      return Response.json(
        { success: false, error: "Security check failed. Please try again.", codes: data["error-codes"] || [] },
        { status: 400 },
      );
    }
    return Response.json({ success: true, ip: clientIp });
  } catch (error) {
    // Cloudflare unreachable — don't brick public forms over a transient outage.
    return Response.json({ success: true, skipped: true, warning: error.message, ip: clientIp });
  }
});
