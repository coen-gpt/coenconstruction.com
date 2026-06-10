import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

const SQM_TO_SQFT = 10.7639;

// Google Solar API building insights for the Roof Measurement tool: actual
// measured roof area, segment count, and predominant pitch from aerial data.
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    await verifyAdminSession(req, 'can_access_estimates', body);

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: "lat and lng are required" }, { status: 400 });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || Deno.env.get("VITE_GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "GOOGLE_MAPS_API_KEY is not configured (Solar API requires it)." }, { status: 503 });
    }

    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const message = data?.error?.message || "Solar API request failed";
      const notFound = res.status === 404;
      return Response.json(
        { error: notFound ? "No roof data available for this location (Solar API coverage gap)." : message },
        { status: notFound ? 404 : 502 },
      );
    }

    const solar = data.solarPotential || {};
    const segments = solar.roofSegmentStats || [];
    const wholeAreaM2 = solar.wholeRoofStats?.areaMeters2 || 0;

    // Predominant pitch: area-weighted average of segment pitch in degrees,
    // converted to the nearest x/12 carpenter pitch
    let pitchTwelfths = null;
    if (segments.length) {
      const totalArea = segments.reduce((s, seg) => s + (seg.stats?.areaMeters2 || 0), 0) || 1;
      const avgDegrees = segments.reduce((s, seg) => s + (seg.pitchDegrees || 0) * (seg.stats?.areaMeters2 || 0), 0) / totalArea;
      pitchTwelfths = Math.max(1, Math.min(16, Math.round(Math.tan((avgDegrees * Math.PI) / 180) * 12)));
    }

    return Response.json({
      success: true,
      roof_area_sqft: Math.round(wholeAreaM2 * SQM_TO_SQFT),
      roof_squares: Math.round((wholeAreaM2 * SQM_TO_SQFT) / 100 * 10) / 10,
      ground_area_sqft: solar.buildingStats?.areaMeters2 ? Math.round(solar.buildingStats.areaMeters2 * SQM_TO_SQFT) : null,
      segment_count: segments.length,
      predominant_pitch: pitchTwelfths ? `${pitchTwelfths}/12` : null,
      max_panel_area_sqft: solar.maxArrayAreaMeters2 ? Math.round(solar.maxArrayAreaMeters2 * SQM_TO_SQFT) : null,
      imagery_date: data.imageryDate ? `${data.imageryDate.year}-${String(data.imageryDate.month).padStart(2, "0")}-${String(data.imageryDate.day).padStart(2, "0")}` : null,
      imagery_quality: data.imageryQuality || null,
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
