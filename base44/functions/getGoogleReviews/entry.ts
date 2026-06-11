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

// Cache every review Google returns (any rating) so none are silently lost.
// Only 5-star reviews are auto-approved for the public wall; the rest stay
// unapproved so the admin can see them and opt in.
async function upsertReviewsToCache(base44, placeId, rawReviews) {
  let newCount = 0;
  for (const r of rawReviews) {
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
        rating: r.rating,
        text: r.text,
        review_time: reviewTime,
        relative_time_description: r.relative_time_description || "",
        language: r.language || "en",
        source: "google",
        approved: r.rating === 5,
        featured: false,
        hidden: false,
        sort_order: 0,
        cached_at: now,
        last_seen_at: now,
      });
      newCount++;
    }
  }
  return { processed: rawReviews.length, newCount };
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

  // Google's Place Details API hard-caps at 5 reviews per request. Fetching
  // with both supported sort orders yields up to 10 unique reviews per sync;
  // older ones accumulate in the GoogleReview cache across repeated syncs.
  const detailsUrl = (sort) =>
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&reviews_sort=${sort}&key=${apiKey}`;

  const [newestRes, relevantRes] = await Promise.all([
    fetch(detailsUrl("newest")).then(r => r.json()),
    fetch(detailsUrl("most_relevant")).then(r => r.json()).catch(() => null),
  ]);

  if (newestRes.status !== "OK") {
    return Response.json({ error: newestRes.status, message: newestRes.error_message || "Places API error" }, { status: 500 });
  }

  const data = newestRes;
  const seen = new Set();
  const rawReviews = [];
  for (const r of [...(newestRes.result.reviews || []), ...(relevantRes?.status === "OK" ? relevantRes.result.reviews || [] : [])]) {
    const key = hashString(`${r.author_name}|${r.time}|${r.text}`);
    if (seen.has(key)) continue;
    seen.add(key);
    rawReviews.push(r);
  }

  // Upsert all fetched reviews into cache (best-effort, don't fail the whole request)
  let cached = 0;
  let newCount = 0;
  try {
    const result = await upsertReviewsToCache(base44, placeId, rawReviews);
    cached = result.processed;
    newCount = result.newCount;
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
    new_count: newCount,
  });
});