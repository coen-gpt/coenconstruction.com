import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_seo');
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { audit_id, revert_to_version } = await req.json();
    if (!audit_id) return Response.json({ error: 'audit_id required' }, { status: 400 });

    const audit = await base44.asServiceRole.entities.SeoAudit.get(audit_id);
    if (!audit) return Response.json({ error: 'Audit not found' }, { status: 404 });

    const history = audit.revert_history || [];
    if (history.length === 0) {
      return Response.json({ error: 'No revert history available for this audit.' }, { status: 400 });
    }

    // Find the target version entry — default to most recent (last item)
    let targetEntry;
    if (revert_to_version !== undefined) {
      targetEntry = history.find(h => h.version === revert_to_version);
    } else {
      targetEntry = history[history.length - 1];
    }

    if (!targetEntry) {
      return Response.json({ error: 'Revert version not found in history.' }, { status: 404 });
    }

    const key = `seo_meta_${audit.page}`;
    const revertValue = JSON.stringify({
      title: targetEntry.title,
      description: targetEntry.description,
      keywords: targetEntry.keywords || [],
    });

    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { key, value: revertValue });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key, value: revertValue });
    }

    // Remove entries from history up to and including the one we reverted to
    const revertIndex = history.indexOf(targetEntry);
    const trimmedHistory = history.slice(0, revertIndex);

    await base44.asServiceRole.entities.SeoAudit.update(audit_id, {
      status: 'analyzed',
      applied_version: targetEntry.version,
      revert_history: trimmedHistory,
    });

    return Response.json({
      success: true,
      message: `"${audit.page}" successfully reverted to version ${targetEntry.version} (applied ${new Date(targetEntry.applied_at).toLocaleDateString()}).`,
      reverted_to: targetEntry,
    });
  } catch (error) {
    console.error('Revert SEO error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
