import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Star, RefreshCw, Eye, EyeOff, Pin, PinOff, CheckCircle, XCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminReviews() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-google-reviews"],
    queryFn: () => base44.entities.GoogleReview.list("-featured,-sort_order,-review_time"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GoogleReview.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-google-reviews"] }),
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await base44.functions.invoke("getGoogleReviews", {});
      const count = res.data?.cached_count ?? 0;
      setSyncMsg(`Sync complete — ${count} 5-star review(s) processed from live Google.`);
      qc.invalidateQueries({ queryKey: ["admin-google-reviews"] });
    } catch (e) {
      setSyncMsg("Sync failed: " + (e.message || "unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  const toggle = (review, field) =>
    update.mutate({ id: review.id, data: { [field]: !review[field] } });

  const moveSortOrder = (review, dir) =>
    update.mutate({ id: review.id, data: { sort_order: (review.sort_order || 0) + dir } });

  const fiveStarCount = reviews.filter(r => r.rating === 5 && r.approved && !r.hidden).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Google Reviews Cache</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-semibold text-primary">{fiveStarCount}</span> 5-star reviews showing publicly
            &nbsp;·&nbsp; {reviews.length} total cached
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync reviews now"}
        </Button>
      </div>

      {syncMsg && (
        <div className="mb-4 text-sm px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-800">
          {syncMsg}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No cached reviews yet. Click "Sync reviews now" to pull from Google.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div
              key={r.id}
              className={`bg-white rounded-xl border p-4 flex gap-4 items-start transition-opacity ${
                r.hidden ? "opacity-50" : ""
              } ${r.featured ? "border-yellow-300 bg-yellow-50/30" : "border-gray-200"}`}
            >
              {/* Avatar */}
              <div className="shrink-0">
                {r.author_photo_url ? (
                  <img src={r.author_photo_url} className="w-10 h-10 rounded-full object-cover" alt={r.author_name} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                    {(r.author_name || "G")[0]}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-secondary text-sm">{r.author_name}</span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                  {r.featured && <Badge className="bg-yellow-100 text-yellow-800 text-xs">Featured</Badge>}
                  {!r.approved && <Badge variant="outline" className="text-xs text-red-600 border-red-200">Unapproved</Badge>}
                  {r.hidden && <Badge variant="outline" className="text-xs text-gray-500">Hidden</Badge>}
                  <span className="text-xs text-gray-400 ml-auto">{r.relative_time_description || r.review_time?.split("T")[0]}</span>
                </div>
                <p className="text-gray-600 text-sm line-clamp-3">{r.text}</p>
              </div>

              {/* Controls */}
              <div className="shrink-0 flex flex-col gap-1.5">
                <button
                  title={r.featured ? "Unfeature" : "Feature"}
                  onClick={() => toggle(r, "featured")}
                  className={`p-1.5 rounded-lg transition-colors ${r.featured ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200" : "text-gray-400 hover:bg-gray-100"}`}
                >
                  {r.featured ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                </button>
                <button
                  title={r.approved ? "Unapprove" : "Approve"}
                  onClick={() => toggle(r, "approved")}
                  className={`p-1.5 rounded-lg transition-colors ${r.approved ? "text-green-600 hover:bg-green-50" : "text-red-500 hover:bg-red-50"}`}
                >
                  {r.approved ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </button>
                <button
                  title={r.hidden ? "Show" : "Hide"}
                  onClick={() => toggle(r, "hidden")}
                  className={`p-1.5 rounded-lg transition-colors ${r.hidden ? "text-gray-500 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-100"}`}
                >
                  {r.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <div className="flex flex-col gap-0.5 mt-1">
                  <button onClick={() => moveSortOrder(r, -1)} className="p-1 rounded text-gray-400 hover:bg-gray-100" title="Move up">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveSortOrder(r, 1)} className="p-1 rounded text-gray-400 hover:bg-gray-100" title="Move down">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}