import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Map page labels to their live URLs
const PAGE_URLS = {
  "Home": "/",
  "Services": "/services",
  "Services: Home Additions": "/services/home-additions",
  "Services: Decks, Porches & Pergolas": "/services/decks-porches-pergolas",
  "Services: Siding": "/services/siding",
  "Services: Kitchen Remodel": "/services/kitchen-remodeling",
  "Services: Custom Cabinetry": "/services/custom-carpentry",
  "Services: Snow Removal": "/services/snow-removal",
  "About": "/about",
  "Our Work": "/gallery",
  "Contact": "/contact",
  "Service Areas": "/service-areas",
  "Estimator": "/budget-estimator",
  "Design Preview": "/start",
  "Financing": "/financing",
  "Blog": "/blog",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { audit_id, selected_suggestions, apply } = await req.json();
    if (!audit_id) return Response.json({ error: 'audit_id required' }, { status: 400 });

    const audits = await base44.asServiceRole.entities.SeoAudit.filter({ id: audit_id });
    const audit = audits[0];
    if (!audit) return Response.json({ error: 'Audit not found' }, { status: 404 });

    const pageUrl = `https://www.coenconstruction.com${PAGE_URLS[audit.page] || '/'}`;

    // Fetch live page HTML to check what's already implemented
    let pageHtml = '';
    try {
      const pageRes = await fetch(pageUrl, { signal: AbortSignal.timeout(10000) });
      pageHtml = await pageRes.text();
      // Trim to avoid token limits — take first 15k chars which covers head + above fold
      pageHtml = pageHtml.substring(0, 15000);
    } catch (e) {
      console.log('Could not fetch live page:', e.message);
    }

    // Build the full suggestion list from audit
    const allSuggestions = [];

    if (audit.issues?.length) {
      audit.issues.forEach((text, i) => allSuggestions.push({ id: `issue_${i}`, category: 'Critical Issue', text, priority: 'critical' }));
    }
    if (audit.recommendations?.length) {
      audit.recommendations.forEach((text, i) => allSuggestions.push({ id: `rec_${i}`, category: 'SEO Recommendation', text, priority: 'high' }));
    }
    if (audit.local_seo_tips?.length) {
      audit.local_seo_tips.forEach((text, i) => allSuggestions.push({ id: `local_${i}`, category: 'Local SEO', text, priority: 'high' }));
    }
    if (audit.lead_gen_tips?.length) {
      audit.lead_gen_tips.forEach((text, i) => allSuggestions.push({ id: `lead_${i}`, category: 'Lead Generation', text, priority: 'medium' }));
    }
    if (audit.cro_suggestions?.length) {
      audit.cro_suggestions.forEach((text, i) => allSuggestions.push({ id: `cro_${i}`, category: 'CRO', text, priority: 'medium' }));
    }
    if (audit.schema_markup_suggestions?.length) {
      audit.schema_markup_suggestions.forEach((text, i) => allSuggestions.push({ id: `schema_${i}`, category: 'Schema Markup', text, priority: 'medium' }));
    }
    if (audit.backlink_opportunities?.length) {
      audit.backlink_opportunities.forEach((text, i) => allSuggestions.push({ id: `backlink_${i}`, category: 'Backlink Opportunity', text, priority: 'low' }));
    }
    if (audit.internal_link_suggestions?.length) {
      audit.internal_link_suggestions.forEach((text, i) => allSuggestions.push({ id: `internal_${i}`, category: 'Internal Links', text, priority: 'low' }));
    }

    // If just requesting the list (no apply), return all suggestions
    if (!apply) {
      // Run AI review to check what's already implemented
      const reviewPrompt = `You are an expert SEO auditor. Review the following live page HTML for the "${audit.page}" page of Coen Construction (https://www.coenconstruction.com) and evaluate each SEO suggestion to determine if it is ALREADY IMPLEMENTED in the page or not.

PAGE HTML (first 15k chars):
${pageHtml || '(Could not fetch live page)'}

CURRENT META:
Title: ${audit.current_title}
Description: ${audit.current_description}

SEO SUGGESTIONS TO EVALUATE:
${allSuggestions.map((s, i) => `${i + 1}. [${s.category}] ${s.text}`).join('\n')}

For each suggestion, return one of:
- "already_implemented": The suggestion is clearly already done on this page
- "pending": Not yet implemented, should be applied
- "manual_required": Requires manual developer work (e.g. adding actual content, photos, physical schema changes)

Also provide a brief 1-sentence ai_notes explaining your finding.

Return ONLY JSON array matching input order:
[
  { "id": "...", "status": "pending|already_implemented|manual_required", "ai_notes": "..." },
  ...
]`;

      const reviewRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: reviewPrompt,
      });

      let reviewItems = [];
      try {
        const match = (typeof reviewRaw === 'string' ? reviewRaw : JSON.stringify(reviewRaw)).match(/\[[\s\S]*\]/);
        if (match) reviewItems = JSON.parse(match[0]);
      } catch (e) {
        console.log('Review parse error:', e.message);
      }

      // Merge review results into suggestions
      const reviewed = allSuggestions.map((s, i) => {
        const r = reviewItems[i] || {};
        return { ...s, status: r.status || 'pending', ai_notes: r.ai_notes || '' };
      });

      // Save review to audit record
      await base44.asServiceRole.entities.SeoAudit.update(audit_id, {
        suggestion_review: {
          reviewed_at: new Date().toISOString(),
          items: reviewed,
        }
      });

      return Response.json({ success: true, suggestions: reviewed });
    }

    // APPLY mode — apply selected suggestions
    const selectedIds = new Set(selected_suggestions || []);
    const existingReview = audit.suggestion_review?.items || allSuggestions.map(s => ({ ...s, status: 'pending' }));

    const toApply = existingReview.filter(s => selectedIds.has(s.id) && s.status !== 'already_implemented');

    // For meta-tag applicable suggestions, update AppSettings
    const metaApplicable = toApply.filter(s =>
      s.category === 'Critical Issue' || s.category === 'SEO Recommendation' || s.category === 'Schema Markup'
    );

    // Apply meta title/description if suggested
    const metaKey = `seo_meta_${audit.page.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const existingMeta = await base44.asServiceRole.entities.AppSettings.filter({ key: metaKey });

    const metaValue = JSON.stringify({
      title: audit.suggested_title || audit.current_title,
      description: audit.suggested_description || audit.current_description,
      keywords: audit.keywords || [],
      applied_suggestions: toApply.map(s => s.text),
      applied_at: new Date().toISOString(),
    });

    if (existingMeta.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existingMeta[0].id, { value: metaValue });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: metaKey, value: metaValue });
    }

    // Save schema JSON-LD markup to AppSettings
    if (audit.schema_json) {
      const schemaKey = `schema_json_${audit.page_path?.replace(/\//g, '_').replace(/^_/, '') || 'home'}`;
      const existingSchema = await base44.asServiceRole.entities.AppSettings.filter({ key: schemaKey });
      if (existingSchema.length > 0) {
        await base44.asServiceRole.entities.AppSettings.update(existingSchema[0].id, { value: audit.schema_json });
      } else {
        await base44.asServiceRole.entities.AppSettings.create({ key: schemaKey, value: audit.schema_json });
      }
      console.log('Schema JSON saved to AppSettings:', schemaKey);
    }

    // Save hyperlinked keywords to AppSettings
    if (audit.hyperlinked_keywords?.length) {
      const linksKey = `hyperlinked_keywords_${audit.page_path?.replace(/\//g, '_').replace(/^_/, '') || 'home'}`;
      const existingLinks = await base44.asServiceRole.entities.AppSettings.filter({ key: linksKey });
      const linksVal = JSON.stringify(audit.hyperlinked_keywords);
      if (existingLinks.length > 0) {
        await base44.asServiceRole.entities.AppSettings.update(existingLinks[0].id, { value: linksVal });
      } else {
        await base44.asServiceRole.entities.AppSettings.create({ key: linksKey, value: linksVal });
      }
      console.log('Hyperlinked keywords saved:', audit.hyperlinked_keywords.length, 'entries');
    }

    // Also update the global seo_overrides key used by applySeoSuggestions
    // Mark applied suggestions in review
    const updatedItems = existingReview.map(s => {
      if (selectedIds.has(s.id) && s.status !== 'already_implemented') {
        return { ...s, status: 'applied', applied_at: new Date().toISOString() };
      }
      return s;
    });

    const prevHistory = audit.revert_history || [];
    await base44.asServiceRole.entities.SeoAudit.update(audit_id, {
      status: 'applied',
      applied_version: (audit.applied_version || 0) + 1,
      suggestion_review: {
        ...audit.suggestion_review,
        items: updatedItems,
      },
      revert_history: [...prevHistory, {
        applied_at: new Date().toISOString(),
        applied_by: user.email,
        title: audit.current_title,
        description: audit.current_description,
        keywords: audit.keywords,
        version: audit.applied_version || 0,
      }],
    });

    return Response.json({
      success: true,
      applied_count: toApply.length,
      applied: toApply.map(s => s.id),
      message: `Applied ${toApply.length} suggestion${toApply.length !== 1 ? 's' : ''} to ${audit.page}`,
    });

  } catch (error) {
    console.error('reviewAndApplySeoSuggestions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});