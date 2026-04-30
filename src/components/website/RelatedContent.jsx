/**
 * RelatedContent — links to 3-5 related pages or posts with descriptive anchor text.
 *
 * Usage A — static curated links:
 *   <RelatedContent
 *     title="Related Services"
 *     items={[
 *       { label: "Home Additions in Greater Boston", href: "/services/home-additions", description: "Add square footage and value with a custom bump-out or full addition." },
 *       { label: "Custom Deck Construction",         href: "/services/decks-porches-pergolas", description: "Extend your living space outdoors with a handcrafted deck or pergola." },
 *     ]}
 *   />
 *
 * Usage B — dynamic blog posts (pass posts array):
 *   <RelatedContent title="Further Reading" posts={relatedPosts} />
 */

import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Wrench, MapPin } from "lucide-react";

const ICON_MAP = {
  service: Wrench,
  location: MapPin,
  blog: BookOpen,
};

/**
 * @param {object} props
 * @param {string}  [props.title]      – Section heading
 * @param {Array<{label: string, href: string, description?: string, type?: "service"|"location"|"blog"}>} [props.items]
 * @param {Array}   [props.posts]      – BlogPost entity objects (convenience shorthand)
 * @param {number}  [props.max]        – Max items to show (default 5)
 * @param {"grid"|"list"} [props.layout]
 */
export default function RelatedContent({ title = "Related Reading", items, posts, max = 5, layout = "grid" }) {
  // Build normalized items list
  const allItems = items ?? (posts ?? []).map(p => ({
    label:       p.title,
    href:        `/blog/${p.slug}`,
    description: p.excerpt || p.content?.replace(/<[^>]+>/g, "").slice(0, 120),
    type:        "blog",
  }));

  const displayed = allItems.slice(0, max);
  if (displayed.length === 0) return null;

  if (layout === "list") {
    return (
      <aside aria-label={title}>
        <h3 className="text-base font-bold text-secondary mb-3">{title}</h3>
        <ul className="space-y-2">
          {displayed.map((item, i) => {
            const Icon = ICON_MAP[item.type] ?? ArrowRight;
            return (
              <li key={i} className="flex items-start gap-2">
                <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <Link
                    to={item.href}
                    className="text-sm font-medium text-secondary hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    );
  }

  // Default: card grid
  return (
    <aside aria-label={title}>
      <h3 className="text-lg font-bold text-secondary mb-4">{title}</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayed.map((item, i) => {
          const Icon = ICON_MAP[item.type] ?? ArrowRight;
          return (
            <Link
              key={i}
              to={item.href}
              className="group block p-4 border border-gray-200 rounded-xl hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors leading-snug">
                  {item.label}
                </span>
              </div>
              {item.description && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{item.description}</p>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-3">
                Learn more <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}