import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { audit_id } = await req.json();
    if (!audit_id) return Response.json({ error: 'audit_id required' }, { status: 400 });

    const audit = await base44.asServiceRole.entities.SeoAudit.get(audit_id);
    if (!audit) return Response.json({ error: 'Audit not found' }, { status: 404 });

    const key = `seo_meta_${audit.page}`;

    // Save current live state to revert_history before overwriting
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key });
    let previousState = null;
    if (existing.length > 0) {
      try { previousState = JSON.parse(existing[0].value); } catch (_) {}
    }

    const revertEntry = {
      applied_at: new Date().toISOString(),
      applied_by: user.email,
      title: previousState?.title || audit.current_title || '',
      description: previousState?.description || audit.current_description || '',
      keywords: previousState?.keywords || [],
      version: audit.applied_version || 0,
    };

    const newValue = JSON.stringify({
      title: audit.suggested_title,
      description: audit.suggested_description,
      keywords: audit.keywords,
    });

    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { key, value: newValue });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key, value: newValue });
    }

    const updatedHistory = [...(audit.revert_history || []), revertEntry];
    const newVersion = (audit.applied_version || 0) + 1;

    await base44.asServiceRole.entities.SeoAudit.update(audit_id, {
      status: 'applied',
      applied_version: newVersion,
      revert_history: updatedHistory,
    });

    return Response.json({
      success: true,
      message: `SEO suggestions for "${audit.page}" applied successfully. Version ${newVersion} is now live.`,
      version: newVersion,
    });
  } catch (error) {
    console.error('Apply SEO error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});