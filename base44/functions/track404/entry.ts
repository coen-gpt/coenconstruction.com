import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * track404 — records a 404 hit for admin monitoring.
 * Writes to AppSettings as a rolling JSON log (last 200 entries).
 * Admins can view via Admin > SEO > 404 Tracker panel.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { path, referrer } = await req.json();

    if (!path) return Response.json({ ok: false, error: "No path" }, { status: 400 });

    // Use service role to write (no auth required — 404s happen for all users)
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: "404_log" });
    const record = existing[0];

    const log = record?.value ? JSON.parse(record.value) : [];

    // Deduplicate: increment count if same path was already logged today
    const today = new Date().toISOString().slice(0, 10);
    const existingEntry = log.find(e => e.path === path && e.date === today);

    if (existingEntry) {
      existingEntry.count = (existingEntry.count || 1) + 1;
      existingEntry.last_seen = new Date().toISOString();
      if (referrer && !existingEntry.referrers?.includes(referrer)) {
        existingEntry.referrers = [...(existingEntry.referrers || []), referrer].slice(0, 5);
      }
    } else {
      log.unshift({
        path,
        date: today,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        count: 1,
        referrers: referrer ? [referrer] : [],
      });
    }

    // Keep last 200 unique entries
    const trimmed = log.slice(0, 200);
    const value = JSON.stringify(trimmed);

    if (record?.id) {
      await base44.asServiceRole.entities.AppSettings.update(record.id, { value });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: "404_log", value });
    }

    return Response.json({ ok: true });
  } catch (error) {
    // Never expose error details
    return Response.json({ ok: false }, { status: 500 });
  }
});