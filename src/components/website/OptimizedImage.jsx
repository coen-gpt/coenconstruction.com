/**
 * OptimizedImage — drop-in <img> replacement with CWV best practices.
 *
 * Features:
 *   • Explicit width + height → prevents CLS
 *   • loading="lazy" by default (eager for LCP/above-fold images)
 *   • fetchpriority="high" for LCP images
 *   • decoding="async" for off-main-thread decode
 *   • Blur-up placeholder (inline SVG data URI) while image loads
 *   • Graceful error fallback
 *
 * Usage:
 *   <OptimizedImage
 *     src="https://..."
 *     alt="descriptive alt text"
 *     width={800}
 *     height={600}
 *     className="w-full h-48 object-cover"
 *   />
 *
 *   // LCP / above-the-fold image:
 *   <OptimizedImage src="..." alt="..." priority width={1600} height={900} />
 */

import { useState } from "react";

/**
 * Generate a tiny inline SVG as a blur placeholder.
 * Uses the dominant hue extracted from the first pixel of a 1×1 canvas,
 * but since we can't do that SSR/CDN-side, we just use a neutral warm gray
 * that blends well with construction imagery.
 */
function blurDataUrl(w = 8, h = 6, color = "#c8b8a8") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <filter id="b"><feGaussianBlur stdDeviation="2"/></filter>
    <rect width="100%" height="100%" fill="${color}" filter="url(#b)"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const PLACEHOLDER = blurDataUrl();

/**
 * @param {object}  props
 * @param {string}  props.src           - Image URL
 * @param {string}  props.alt           - Alt text (required for a11y + SEO)
 * @param {number}  [props.width]       - Intrinsic width (prevents CLS)
 * @param {number}  [props.height]      - Intrinsic height (prevents CLS)
 * @param {string}  [props.className]   - Tailwind classes
 * @param {boolean} [props.priority]    - true = eager + fetchpriority=high (LCP)
 * @param {string}  [props.fallbackSrc] - Shown on error
 * @param {string}  [props.sizes]       - HTML sizes attribute for responsive images
 * @param {object}  [props.rest]        - Any other img attributes
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
  fallbackSrc,
  sizes,
  ...rest
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const displaySrc = errored ? (fallbackSrc || PLACEHOLDER) : src;

  return (
    <img
      src={displaySrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchpriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      className={`transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      style={{
        backgroundImage: loaded ? undefined : `url(${PLACEHOLDER})`,
        backgroundSize: "cover",
        ...rest.style,
      }}
      onLoad={() => setLoaded(true)}
      onError={() => { setErrored(true); setLoaded(true); }}
      {...rest}
    />
  );
}