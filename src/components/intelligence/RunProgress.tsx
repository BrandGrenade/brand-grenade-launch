import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { intelligenceProgress, type IntelligenceProgressInput } from "@/lib/intelligence-progress";

export function RunProgress({ row }: { row: IntelligenceProgressInput }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const progress = intelligenceProgress(row, now ?? 0);
  const quiet = progress.quietSeconds;
  const age = quiet === null ? null : `${Math.floor(quiet / 60)}m ${quiet % 60}s ago`;
  return (
    <section aria-label="Analysis progress" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-body font-medium text-text-primary">Analysis progress</h2>
        <span className="text-sm font-medium text-text-primary">{progress.confirmed} of 10 layers confirmed complete</span>
      </div>
      <p className="text-sm text-text-secondary">
        {progress.queued ? "Queued — awaiting analysis start" : progress.marker === 0 ? "Waiting for first output" : `Estimated output progress: ${progress.marker} of 10`}
      </p>
      <Progress value={progress.marker * 10} aria-label="Estimated output progress" />
      <p className="text-sm text-text-secondary">Individual layer completion: {row.status === "complete" ? "confirmed" : "not reported until the final report is saved"}</p>
      <p className="text-sm text-text-secondary" role="timer">Last saved activity: {now !== null && age ? age : "—"}</p>
    </section>
  );
}