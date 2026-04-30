import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ImageIcon, AlertCircle, Play } from "lucide-react";

export default function AdminGenerateBlogImages() {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState([]);

  const runBatch = async (batchStart, batchSize = 3) => {
    const res = await base44.functions.invoke("generateBlogImages", { batchStart, batchSize });
    return res.data;
  };

  const handleStart = async () => {
    setRunning(true);
    setDone(false);
    setProcessed(0);
    setLog([]);
    setErrors([]);

    // Get total first with batch 0
    const first = await runBatch(0, 3);
    setTotal(first.total);
    setProcessed(first.processed);
    setLog(first.results.map(r => r.title));
    setErrors(first.errors || []);

    let current = first.processed;
    const tot = first.total;

    while (current < tot) {
      const result = await runBatch(current, 3);
      setProcessed(result.processed);
      setLog(prev => [...prev, ...result.results.map(r => r.title)]);
      setErrors(prev => [...prev, ...(result.errors || [])]);
      current = result.processed;
      if (result.remaining === 0) break;
    }

    setDone(true);
    setRunning(false);
  };

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <ImageIcon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-secondary">Generate Blog Hero Images</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Generates a unique AI image for every blog post based on its title and topic, with a New England / Boston theme.
        This runs in batches of 3 and may take several minutes for all {total || "~67"} posts.
      </p>

      {!running && !done && (
        <Button onClick={handleStart} className="gap-2">
          <Play className="w-4 h-4" /> Start Generating All Images
        </Button>
      )}

      {(running || done) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{processed} / {total} posts updated</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-3" />

          {done && (
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle className="w-5 h-5" /> All blog images have been generated!
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <AlertCircle className="w-4 h-4" /> {errors.length} errors
              </div>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">{e.title}: {e.error}</p>
              ))}
            </div>
          )}

          <div className="bg-muted rounded-lg p-3 max-h-64 overflow-y-auto space-y-1">
            {log.map((title, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                {title}
              </div>
            ))}
            {running && (
              <div className="text-xs text-muted-foreground animate-pulse">Generating next batch…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}