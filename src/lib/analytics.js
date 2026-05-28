/**
 * GA4 event tracking helpers for AI Design Preview tool engagement.
 * Uses window.gtag — loaded via index.html Google Tag snippet.
 */

export function trackEvent(eventName, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

// AI Design Preview specific events
export const DesignPreviewEvents = {
  /** User opened the Design Preview / Start Project flow */
  toolOpened: (projectType) =>
    trackEvent('design_preview_opened', { project_type: projectType }),

  /** User clicked "Generate AI Design" */
  generateStarted: (projectType, hasBeforePhoto, hasInspirationPhoto) =>
    trackEvent('design_generate_started', {
      project_type: projectType,
      has_before_photo: hasBeforePhoto,
      has_inspiration_photo: hasInspirationPhoto,
    }),

  /** AI design image was successfully generated */
  generateCompleted: (projectType, designCount) =>
    trackEvent('design_generate_completed', {
      project_type: projectType,
      total_designs: designCount,
    }),

  /** User failed to generate (error) */
  generateFailed: (projectType) =>
    trackEvent('design_generate_failed', { project_type: projectType }),

  /** User clicked on a design to view lightbox */
  designViewed: (designIndex) =>
    trackEvent('design_viewed', { design_index: designIndex }),

  /** User downloaded a design image */
  designDownloaded: (designIndex) =>
    trackEvent('design_downloaded', { design_index: designIndex }),

  /** User clicked "Customize Your Design" */
  customizationOpened: () =>
    trackEvent('design_customization_opened'),

  /** User submitted project customizations */
  customizationSaved: (projectType) =>
    trackEvent('design_customization_saved', { project_type: projectType }),

  /** User sent design to the company (conversion) */
  designShared: (projectType) =>
    trackEvent('design_shared_with_company', { project_type: projectType }),
};