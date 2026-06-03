import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Simple stable hash for dedupe key
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function upsertReviewsToCache(base44, placeId, rawReviews) {
  const fiveStarReviews = rawReviews.filter(r => r.rating === 5);
  for (const r of fiveStarReviews) {
    const dedupeKey = hashString(`${r.author_name}|${r.time}|${r.text}`);
    const now = new Date().toISOString();
    const reviewTime = r.time ? new Date(r.time * 1000).toISOString() : now;

    // Try to find existing record
    const existing = await base44.asServiceRole.entities.GoogleReview.filter({ dedupe_key: dedupeKey });
    if (existing && existing.length > 0) {
      // Update last_seen_at, text, relative_time
      await base44.asServiceRole.entities.GoogleReview.update(existing[0].id, {
        last_seen_at: now,
        text: r.text,
        relative_time_description: r.relative_time_description || "",
      });
    } else {
      // Insert new
      await base44.asServiceRole.entities.GoogleReview.create({
        place_id: placeId,
        dedupe_key: dedupeKey,
        author_name: r.author_name,
        author_photo_url: r.profile_photo_url || "",
        author_url: r.author_url || "",
        rating: 5,
        text: r.text,
        review_time: reviewTime,
        relative_time_description: r.relative_time_description || "",
        language: r.language || "en",
        source: "google",
        approved: true,
        featured: false,
        hidden: false,
        sort_order: 0,
        cached_at: now,
        last_seen_at: now,
      });
    }
  }
  return fiveStarReviews.length;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let bodyPlaceId = null;
  let skipCache = false;
  try {
    const body = await req.json();
    bodyPlaceId = body?.place_id || null;
    skipCache = body?.skip_cache || false;
  } catch (_) {}

  const placeId = bodyPlaceId || Deno.env.get("GOOGLE_PLACE_ID");
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

  if (!placeId || !apiKey) {
    return Response.json({ error: "Missing GOOGLE_PLACE_ID or GOOGLE_PLACES_API_KEY secret." }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&reviews_sort=newest&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    return Response.json({ error: data.status, message: data.error_message || "Places API error" }, { status: 500 });
  }

  const rawReviews = data.result.reviews || [];

  // Upsert 5-star reviews into cache (best-effort, don't fail the whole request)
  let cached = 0;
  try {
    cached = await upsertReviewsToCache(base44, placeId, rawReviews);
  } catch (e) {
    console.warn("Cache upsert failed:", e.message);
  }

  const reviews = rawReviews.map(r => ({
    name: r.author_name,
    avatar: r.profile_photo_url,
    rating: r.rating,
    text: r.text,
    time: r.relative_time_description,
  }));

  return Response.json({
    reviews,
    overall_rating: data.result.rating,
    total_reviews: data.result.user_ratings_total,
    cached_count: cached,
  });
});