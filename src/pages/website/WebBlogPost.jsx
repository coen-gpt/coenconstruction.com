import { useParams, Link } from "react-router-dom";
import { Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import RegionsStrip from "@/components/website/RegionsStrip";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import SEOHead from "@/components/SEOHead";
// ArrowRight used in related articles section
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";
import ContactForm from "@/components/website/ContactForm";
import ReviewCarousel from "@/components/website/ReviewCarousel";
import { blogPosts } from "@/data/blogPosts";


export default function WebBlogPost() {
  const { slug } = useParams();

  const { data: dbPosts = [] } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => base44.entities.BlogPost.filter({ slug }),
  });

  const { data: allPosts = [] } = useQuery({
    queryKey: ["blog-all-posts"],
    queryFn: () => base44.entities.BlogPost.filter({ published: true }),
  });

  const dbPost = dbPosts[0];
  const staticPost = blogPosts.find(p => p.slug === slug);
  const rawPost = dbPost || staticPost;

  const post = rawPost
    ? {
        ...rawPost,
        date: new Date(rawPost.created_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      }
    : {
        title: slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        date: "2026",
        category: "General Contractor",
        img: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80",
        content: "Full article content coming soon. Contact us for expert advice on this topic.",
        related: [],
      };

  // Related posts: match by shared tags, fall back to same category
  const relatedPosts = (() => {
    const currentTags = post.tags || [];
    const candidates = allPosts.filter(p => p.slug !== slug);
    if (currentTags.length > 0) {
      const scored = candidates.map(p => ({
        ...p,
        score: (p.tags || []).filter(t => currentTags.includes(t)).length,
      })).filter(p => p.score > 0).sort((a, b) => b.score - a.score);
      if (scored.length > 0) return scored.slice(0, 3);
    }
    // Fallback: same category
    return candidates.filter(p => p.category === post.category).slice(0, 3);
  })();

  return (
    <>
      <SEOHead
        title={`${post.title} | Coen Construction Blog`}
        description={post.content.substring(0, 160)}
        canonicalUrl={`https://www.coenconstruction.com/blog/${slug}`}
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Home", url: "https://www.coenconstruction.com" },
          { name: "Blog", url: "https://www.coenconstruction.com/blog" },
          { name: post.title, url: `https://www.coenconstruction.com/blog/${slug}` }
        ]), {
          "@context": "https://schema.org", "@type": "BlogPosting",
          "headline": post.title, "datePublished": post.date, "dateModified": post.date,
          "description": post.excerpt || post.content?.substring(0, 160),
          "image": post.img, "url": `https://www.coenconstruction.com/blog/${slug}`,
          "author": { "@type": "Organization", "name": "Coen Construction", "url": "https://www.coenconstruction.com" },
          "publisher": { "@type": "Organization", "name": "Coen Construction", "logo": { "@type": "ImageObject", "url": "https://www.coenconstruction.com/logo.png" } },
          "mainEntityOfPage": { "@type": "WebPage", "@id": `https://www.coenconstruction.com/blog/${slug}` }
        }]}
      />

      <div className="h-72 relative overflow-hidden">
        <img src={post.img} alt={post.title} width="1400" height="400" loading="eager" decoding="sync" fetchPriority="high" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75 flex items-end">
          <div className="max-w-4xl mx-auto w-full px-4 pb-8">
            <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded mb-3 inline-block">{post.category}</span>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">{post.title}</h1>
            <div className="flex items-center gap-2 mt-3 text-white/70 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{post.date}</span>
              <span>·</span>
              <span>Coen Construction</span>
            </div>
          </div>
        </div>
      </div>

      <section className="py-14 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <Link to="/blog" className="inline-flex items-center gap-1 text-primary text-sm mb-6 hover:underline">
              <ArrowLeft className="w-3 h-3" /> Back to Blog
            </Link>

            {/* Top CTA */}
            <div className="mb-8">
              <DesignPreviewCTA variant="inline" />
            </div>

            <div
              className="prose prose-lg max-w-none text-gray-600 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-secondary [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-secondary [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-primary [&_a]:font-medium [&_a]:hover:underline [&_strong]:font-normal [&_strong]:text-gray-600 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_li]:mb-1"
              dangerouslySetInnerHTML={{ __html: post.content.replace(/\n\n/g, "</p><p>").replace(/^/, "<p>").replace(/$/, "</p>").replace(/## (.+)/g, '</p><h2>$1</h2><p>').replace(/### (.+)/g, '</p><h3>$1</h3><p>').replace(/\*\*(.+?)\*\*/g, '$1').replace(/<p><\/p>/g, '') }}
            />

            {/* Tags */}
            {post.tags?.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mr-3">Tags:</span>
                {post.tags.map(tag => (
                  <span key={tag} className="inline-block bg-muted text-gray-600 text-xs font-medium px-3 py-1 rounded-full mr-2 mb-2 border border-gray-200">{tag}</span>
                ))}
              </div>
            )}

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-lg font-bold text-secondary mb-4">Related Articles</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedPosts.map(r => (
                    <Link key={r.slug} to={`/blog/${r.slug}`} className="group block border border-gray-200 rounded-xl overflow-hidden hover:border-primary transition-colors">
                       {r.img && <img src={r.img} alt={r.title} width="400" height="112" loading="lazy" decoding="async" className="w-full h-28 object-cover" />}
                      <div className="p-3">
                        <span className="text-xs text-primary font-semibold">{r.category}</span>
                        <p className="text-sm font-semibold text-secondary mt-1 group-hover:text-primary leading-snug line-clamp-2">{r.title}</p>
                        <span className="text-xs text-primary mt-2 inline-flex items-center gap-1 font-medium">Read more <ArrowRight className="w-3 h-3" /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-muted rounded-xl p-6">
              <ContactForm title="Free Estimate" subtitle="No obligation. Respond within 1 day." compact />
            </div>
            <div className="bg-secondary text-white rounded-xl p-6 text-center">
              <h3 className="font-bold mb-2">See It Before You Build It</h3>
              <p className="text-white/70 text-sm mb-4">Try our free AI Design Preview tool</p>
              <Link to="/start" className="block bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors">Free Design Preview</Link>
            </div>
            <ReviewCarousel />
          </div>
          </div>
          </section>

          <RegionsStrip bg="muted" />

          </>
          );
          }