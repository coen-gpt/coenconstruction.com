import { Star, Quote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import React, { useEffect } from "react";
import StarRating from "./StarRating";
import { reviewsSchema } from "@/lib/seoSchemas";

const staticReviews = [
  { name: "Mary H.", location: "South Boston, MA", text: "Our experience with Coen Construction for a bathroom ceiling restoration project was exceptional. Scott reviewed the project requirements and provided a detailed proposal. Completed promptly and professionally. We highly recommend Coen Construction!", rating: 5 },
  { name: "Glenroy G.", location: "Medford, MA", text: "My rear porch needed structural and cosmetic improvements. Scott provided a proposal outlining the scope of work. His crew showed up early. Whenever an issue arose, it was resolved without impacting the budget. They do quality work in a timely manner.", rating: 5 },
  { name: "Rose L.", location: "Somerville, MA", text: "They are all pleasant and made the process easy for us. They are able to do all the work and I would highly recommend Coen Construction!", rating: 5 },
  { name: "Jeffrey R.", location: "Chelsea, MA", text: "It was beautiful. They went far beyond what we expected. What they did was incredible — a huge project. They said they would do it and they did it. They were great.", rating: 5 },
];

class TestimonialsErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { /* suppress console error from external scripts */ }
  render() {
    if (this.state.hasError) return <TestimonialsInner useStatic />;
    return this.props.children;
  }
}

function TestimonialsInner({ useStatic = false }) {
  // Fetch live data just for overall rating/count
  const { data: liveData } = useQuery({
    queryKey: ["google-reviews-meta"],
    queryFn: () => base44.functions.invoke("getGoogleReviews", {}).then(r => r.data),
    staleTime: 1000 * 60 * 60,
    retry: false,
    enabled: !useStatic,
  });

  // Primary: cached 5-star reviews from GoogleReview entity
  const { data: cachedReviews = [], isLoading } = useQuery({
    queryKey: ["cached-google-reviews-public"],
    queryFn: () => base44.entities.GoogleReview.filter(
      { approved: true, hidden: false, rating: 5 },
      "featured,-sort_order,-review_time",
      20
    ),
    staleTime: 1000 * 60 * 10,
    enabled: !useStatic,
  });

  const overallRating = liveData?.overall_rating ?? null;
  const totalReviews = liveData?.total_reviews ?? null;

  // Map cached records to display shape; fall back to static if cache is empty
  let displayReviews;
  if (!useStatic && cachedReviews.length >= 2) {
    displayReviews = cachedReviews.map(r => ({
      name: r.author_name,
      avatar: r.author_photo_url,
      rating: r.rating,
      text: r.text,
      time: r.relative_time_description || r.review_time,
    }));
  } else if (!useStatic && !isLoading) {
    // Cache empty — fall back to static
    displayReviews = staticReviews;
  } else {
    displayReviews = staticReviews;
  }

  // Build JSON-LD schema from displayed reviews (guard against schema helper errors)
  let schema = null;
  try {
    const validReviews = displayReviews.filter(r => r && typeof r === "object" && r.name && r.text);
    schema = reviewsSchema(
      validReviews.map(r => ({ name: r.name, text: r.text, rating: r.rating || 5 })),
      overallRating && totalReviews ? { ratingValue: overallRating, reviewCount: totalReviews } : null
    );
  } catch { schema = null; }

  // Inject JSON-LD schema via a <script> tag directly
  useEffect(() => {
    if (!schema) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "testimonials-schema";
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => { document.getElementById("testimonials-schema")?.remove(); };
  }, [schema]);

  return (
    <section
      className="py-16 px-4 bg-white"
      itemScope
      itemType="https://schema.org/GeneralContractor"
    >


      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">5-Star Reviews</span>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary mt-2">What Our Customers Say</h2>
          {overallRating ? (
            <div className="flex justify-center mt-3">
              <StarRating value={overallRating} count={totalReviews} size="md" />
            </div>
          ) : (
            <p className="text-gray-600 mt-3 max-w-xl mx-auto">Hundreds of satisfied homeowners across Greater Boston trust Coen Construction.</p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
                <div className="flex gap-1 mb-3">{[...Array(5)].map((_, j) => <div key={j} className="w-4 h-4 bg-gray-200 rounded" />)}</div>
                <div className="h-4 bg-gray-200 rounded mb-2 w-full" />
                <div className="h-4 bg-gray-200 rounded mb-4 w-3/4" />
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-200 rounded-full" />
                  <div><div className="h-3 bg-gray-200 rounded w-24 mb-1" /><div className="h-3 bg-gray-200 rounded w-16" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayReviews.filter(r => r && typeof r === "object" && typeof r.name === "string" && r.name.trim().length > 0 && typeof r.text === "string" && r.text.trim().length > 0).map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative"
                itemScope
                itemType="https://schema.org/Review"
                itemProp="review"
              >
                <meta itemProp="datePublished" content={(r && r.time) || new Date().toISOString().split("T")[0]} />
                <Quote className="absolute top-4 right-4 w-6 h-6 text-primary/10" aria-hidden="true" />

                {/* Rating with schema microdata */}
                <div itemScope itemType="https://schema.org/Rating" itemProp="reviewRating" className="mb-3">
                  <meta itemProp="ratingValue" content={String(r.rating || 5)} />
                  <meta itemProp="bestRating" content="5" />
                  <meta itemProp="worstRating" content="1" />
                  <div className="flex gap-1" aria-label={`${r.rating || 5} out of 5 stars`} role="img">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} aria-hidden="true" className={`w-4 h-4 ${j < (r.rating || 5) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                </div>

                <p className="text-gray-700 text-sm leading-relaxed mb-4 italic line-clamp-4" itemProp="reviewBody">"{r.text || ""}"</p>

                <div className="flex items-center gap-3">
                  {r.avatar ? (
                    <img src={r.avatar} alt={r.name || "Reviewer"} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" aria-hidden="true">
                      {((r && typeof r.name === "string" && r.name) || "G")[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-secondary text-sm">{r.name || "Anonymous"}</div>
                    <div className="text-gray-400 text-xs">{r.location || (r.time ? String(r.time) : "Google Review")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <a
            href="https://www.google.com/maps/search/?api=1&query=Coen+Construction"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline"
          >
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            See all reviews on Google
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Testimonials(props) {
  return (
    <TestimonialsErrorBoundary>
      <TestimonialsInner {...props} />
    </TestimonialsErrorBoundary>
  );
}