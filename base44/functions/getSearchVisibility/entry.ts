import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_seo');

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_search_console');

    const body = await req.json().catch(() => ({}));
    const siteUrl = body.siteUrl || 'https://www.coenconstruction.com/';
    const days = body.days || 28;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const fmt = (d) => d.toISOString().split('T')[0];

    // Fetch top queries
    const queriesRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['query'],
          rowLimit: 25,
          orderBy: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
        }),
      }
    );
    const queriesData = await queriesRes.json();

    // Fetch top pages
    const pagesRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['page'],
          rowLimit: 20,
          orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
        }),
      }
    );
    const pagesData = await pagesRes.json();

    // Fetch daily totals for chart
    const dailyRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['date'],
          rowLimit: 90,
        }),
      }
    );
    const dailyData = await dailyRes.json();

    // Aggregate totals
    const rows = queriesData.rows || [];
    const totals = rows.reduce((acc, r) => ({
      clicks: acc.clicks + r.clicks,
      impressions: acc.impressions + r.impressions,
    }), { clicks: 0, impressions: 0 });

    return Response.json({
      success: true,
      period: { startDate: fmt(startDate), endDate: fmt(endDate), days },
      totals,
      queries: queriesData.rows || [],
      pages: pagesData.rows || [],
      daily: dailyData.rows || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
