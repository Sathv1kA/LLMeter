import { useMemo, useState } from "react";
import { ArrowRight, Sparkles, TrendingDown } from "lucide-react";
import type { CostReport, DetectedCall, Recommendation } from "../types";
import { fmtCost } from "../utils/formatters";

interface Props {
  report: CostReport;
}

export default function Recommendations({ report }: Props) {
  const [showAll, setShowAll] = useState(false);
  const callsById = useMemo(() => {
    const m = new Map<string, DetectedCall>();
    for (const c of report.calls) m.set(c.id, c);
    return m;
  }, [report.calls]);

  const sorted = useMemo(
    () => [...report.recommendations].sort((a, b) => b.savings_usd - a.savings_usd),
    [report.recommendations],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card/40 p-6">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <h2 className="font-display text-base font-medium tracking-tight">Recommendations</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          No swap recommendations — either you're already using the cheapest suitable model for each
          task, or we couldn't resolve the declared models.
        </p>
      </div>
    );
  }

  const displayed = showAll ? sorted : sorted.slice(0, 8);
  const totalSavings = report.total_potential_savings_usd ?? 0;
  const isAi = report.recommender_mode === "ai";

  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className={isAi ? "text-[oklch(0.66_0.22_340)]" : "text-primary"} />
          <h2 className="font-display text-base font-medium tracking-tight">
            Swap recommendations
          </h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? "opportunity" : "opportunities"}
          </span>
          {isAi && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[oklch(0.66_0.22_340_/_0.4)] bg-[oklch(0.66_0.22_340_/_0.12)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[oklch(0.78_0.16_340)]">
              <Sparkles size={9} />
              AI
            </span>
          )}
        </div>
        {totalSavings > 0 && (
          <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-primary">
            <TrendingDown size={12} />
            Save {fmtCost(totalSavings)} total
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {displayed.map((r) => (
          <Row key={r.call_id} rec={r} call={callsById.get(r.call_id)} />
        ))}
      </div>

      {sorted.length > 8 && (
        <button
          className="mt-4 text-xs text-primary hover:underline"
          onClick={() => setShowAll((x) => !x)}
        >
          {showAll ? "Show fewer" : `Show all ${sorted.length} recommendations`}
        </button>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground/70">
        Recommendations match by task type strengths. Always validate quality before switching.
      </p>
    </div>
  );
}

function Row({ rec, call }: { rec: Recommendation; call?: DetectedCall }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2.5 transition-colors hover:bg-card/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {call && (
          <span className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
            {call.file_path}:{call.line_number}
          </span>
        )}
        <div className="flex items-center gap-2">
          <code className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {rec.current_model_id ?? "unknown"}
          </code>
          <ArrowRight size={12} className="text-muted-foreground/70" />
          <code className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-medium text-primary">
            {rec.recommended_display_name}
          </code>
        </div>
        <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {rec.current_cost_usd != null ? fmtCost(rec.current_cost_usd) : "—"}{" "}
          →{" "}
          <span className="font-semibold text-primary">
            {fmtCost(rec.recommended_cost_usd)}
          </span>
          {rec.savings_usd > 0 && (
            <span className="ml-2 font-semibold text-primary">
              (−{fmtCost(rec.savings_usd)})
            </span>
          )}
        </span>
      </div>
      <p className="mt-1.5 font-serif text-xs italic text-muted-foreground/80">{rec.rationale}</p>
    </div>
  );
}
