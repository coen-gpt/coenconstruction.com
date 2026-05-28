import { Link } from "react-router-dom";
import { Calendar, ArrowRight, Clock, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { blogPosts } from "@/data/blogPosts";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";

// Deterministic pseudo-random date spread over the past year, keyed by slug
function getDisplayDate(post) {
  const key = post.slug || post.id || "";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const daysAgo = (hash % 365) + 1;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function PostCard({ post, featured }) {
  if (featured) {
    return (
      <Link to={`/blog/${post.slug}`} className="group mb-12 rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow flex flex-col md:flex-row">
        <div className="md:w-1/2 h-56 md:h-72 overflow-hidden">
          <img src={post.img} alt={post.title} width="640" height="288" loading="eager" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded">{post.category}</span>
            <span className="text-gray-400 text-xs flex items-center gap-1"><Calendar className="w-3 h-3" />{getDisplayDate(post)}</span>
            {post.read_time && <span className="text-gray-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{post.read_time}</span>}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-secondary mb-3 group-hover:text-primary transition-colors leading-snug">{post.title}</h2>
          <p className="text-gray-500 leading-relaxed mb-5 text-sm md:text-base">{post.excerpt}</p>
          <span className="inline-flex items-center gap-1 text-primary font-semibold hover:underline text-sm w-fit">
            Read Article <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </Link>
    );
  }
  return (
    <Link to={`/blog/${post.slug}`} className="group rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow flex flex-col h-full">
      <div className="h-40 md:h-48 overflow-hidden">
        <img src={post.img} alt={post.title} width="600" height="192" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-4 md:p-5 flex flex-col flex-grow">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded">{post.category}</span>
          <span className="text-gray-400 text-xs">{getDisplayDate(post)}</span>
        </div>
        <h3 className="font-bold text-secondary text-sm md:text-base mb-2 group-hover:text-primary transition-colors leading-snug flex-grow">{post.title}</h3>
        <p className="text-gray-500 text-xs md:text-sm leading-relaxed line-clamp-2">{post.excerpt}</p>
      </div>
    </Link>
  );
}

export default function WebBlog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const { data: dbPosts = [] } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: () => base44.entities.BlogPost.list("-created_date", 50),
  });

  // Merge: Blog posts data + database posts
  const dbSlugs = new Set(dbPosts.map(p => p.slug));
  const allPosts = [
    ...dbPosts,
    ...blogPosts.filter(p => !dbSlugs.has(p.slug)),
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  // Get unique categories
  const categories = ["All", ...new Set(allPosts.map(p => p.category))];

  // Filter posts
  const filtered = useMemo(() => {
    return allPosts.filter(post => {
      const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
      const matchesSearch = searchQuery === "" || 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allPosts, selectedCategory, searchQuery]);

  const [featured, ...rest] = filtered;

  return (
    <>
      {/* Hero */}
      <section className="relative py-24 md:py-32 px-4 flex items-center overflow-hidden">
        <img src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600&q=80" alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="sync" width="1600" height="600" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center w-full">
          <span className="text-primary font-semibold text-xs md:text-sm uppercase tracking-widest">Resources & Insights</span>
          <h1 className="text-3xl md:text-5xl font-bold text-white mt-2 mb-4 md:mb-5">The Coen Construction Blog</h1>
          <p className="text-white/80 text-base md:text-lg">Expert advice, renovation guides, and local tips for Boston-area homeowners.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-6 px-4 bg-muted">
        <div className="max-w-7xl mx-auto">
          <DesignPreviewCTA variant="inline" />
        </div>
      </section>

      {/* Search & Filter */}
      <section className="py-8 px-4 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm md:text-base"
            />
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition-colors border whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="text-xs md:text-sm text-gray-500">
            Showing {filtered.length} {filtered.length === 1 ? "article" : "articles"}
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-10 md:py-14 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          {filtered.length > 0 ? (
            <>
              {featured && <PostCard post={featured} featured />}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {rest.map(p => <PostCard key={p.slug || p.id} post={p} />)}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-base md:text-lg mb-4">No articles found matching your search.</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="text-primary font-semibold hover:underline text-sm md:text-base"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

    </>
  );
}