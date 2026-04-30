import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let bodyPlaceId = null;
  try {
    const body = await req.json();
    bodyPlaceId = body?.place_id || null;
  } catch (_) {}

  const placeId = bodyPlaceId || Deno.env.get("GOOGLE_PLACE_ID");
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

  if (!placeId || !apiKey) {
    return Response.json({ error: "Missing GOOGLE_PLACE_ID or VITE_GOOGLE_MAPS_API_KEY secret." }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&reviews_sort=newest&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    return Response.json({ error: data.status, message: data.error_message || "Places API error" }, { status: 500 });
  }

  const reviews = (data.result.reviews || []).map(r => ({
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
  });
});