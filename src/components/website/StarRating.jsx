/**
 * StarRating — accessible star display component with schema-compliant data attributes.
 *
 * Usage:
 *   <StarRating value={4.7} count={87} size="md" />
 */

export default function StarRating({ value, count, size = "md", className = "" }) {
  const sizes = { sm: "w-3.5 h-3.5", md: "w-5 h-5", lg: "w-6 h-6" };
  const starSize = sizes[size] || sizes.md;

  const rounded = Math.round(value * 2) / 2; // round to nearest 0.5
  const fullStars = Math.floor(rounded);
  const hasHalf = rounded % 1 !== 0;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="img"
      aria-label={`Rating: ${value} out of 5 stars${count ? `, based on ${count} reviews` : ""}`}
      itemProp="aggregateRating"
      itemScope
      itemType="https://schema.org/AggregateRating"
    >
      {/* Hidden schema microdata */}
      <meta itemProp="ratingValue" content={String(value)} />
      <meta itemProp="bestRating" content="5" />
      <meta itemProp="worstRating" content="1" />
      {count && <meta itemProp="reviewCount" content={String(count)} />}

      {/* Visual stars */}
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(i => {
          const isFull = i <= fullStars;
          const isHalf = !isFull && hasHalf && i === fullStars + 1;
          return (
            <svg key={i} className={`${starSize} shrink-0`} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <defs>
                {isHalf && (
                  <linearGradient id={`half-${i}`} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="50%" stopColor="#facc15" />
                    <stop offset="50%" stopColor="#e5e7eb" />
                  </linearGradient>
                )}
              </defs>
              <polygon
                points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
                fill={isFull ? "#facc15" : isHalf ? `url(#half-${i})` : "#e5e7eb"}
                stroke={isFull || isHalf ? "#f59e0b" : "#d1d5db"}
                strokeWidth="0.5"
              />
            </svg>
          );
        })}
      </span>

      {/* Numeric value */}
      {value != null && (
        <span className="font-bold text-secondary tabular-nums">{Number(value).toFixed(1)}</span>
      )}
      {count != null && (
        <span className="text-gray-400 text-sm">({count.toLocaleString()})</span>
      )}
    </span>
  );
}