import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_blog');

    const body = await req.json().catch(() => ({}));
    const { enabled, days, time } = body;

    // Convert time from ET to UTC (EST = UTC-5)
    const [hStr, mStr] = (time || "09:00").split(":");
    const hourET = parseInt(hStr);
    const hourUTC = (hourET + 5) % 24;
    const minute = parseInt(mStr || "0");

    // Build cron expression
    const dayStr = (days && days.length > 0) ? days.join(",") : "1";
    const cronExpression = `${minute} ${hourUTC} * * ${dayStr}`;

    // Save settings to AppSettings for UI to load back
    const settingsRecords = await base44.asServiceRole.entities.AppSettings.filter({ key: "blog_schedule_settings" });
    const settingsValue = JSON.stringify({ enabled, days: days || [], time: time || "09:00", cronExpression });

    if (settingsRecords[0]?.id) {
      await base44.asServiceRole.entities.AppSettings.update(settingsRecords[0].id, { value: settingsValue });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: "blog_schedule_settings", value: settingsValue });
    }

    return Response.json({ success: true, cronExpression, enabled });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
