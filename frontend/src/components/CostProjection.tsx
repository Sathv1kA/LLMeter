import { useMemo } from "react";
import type { ModelCostSummary } from "../types";
import { fmtCost } from "../utils/formatters";

interface Props {
  summaries: ModelCostSummary[];
  callSites: number;
  initialCallsPerDay: number;
  onCallsPerDayChange: (v: number) => void;
}

// Log-scale slider: value 0–100 maps to 1–1_000_000
function sliderToValue(s: number): number {
  return Math.round(Math.pow(10, (s / 100) * 6));
}
function valueToSlider(v: number): number {
  return Math.round((Math.log10(Math.max(1, v)) / 6) * 100);
}

export default function CostProjection({ summaries, callSites, initialCallsPerDay, onCallsPerDayChange }: Props) {
  const sliderVal = valueToSlider(initialCallsPerDay);

  const projections = useMemo(() => {
    if (callSites === 0) return [];
    return summaries.map((s) => {
      const perCall = s.total_cost_usd / callSites;
      const daily = perCall * initialCallsPerDay;
      return {
        model_id: s.model_id,
        display_name: s.display_name,
        daily,
        monthly: daily * 30,
      };
    });
  }, [summaries, callSites, initialCallsPerDay]);

  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-base font-medium tracking-tight">Cost projection</h2>
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Volume
        </span>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Daily call volume
          </label>
          <span className="font-mono text-sm font-medium tabular-nums text-foreground">
            {initialCallsPerDay.toLocaleString()}
            <span className="ml-1 text-xs text-muted-foreground">calls/day</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={sliderVal}
          onChange={(e) => onCallsPerDayChange(sliderToValue(Number(e.target.value)))}
          className="w-full accent-primary"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground/70">
          <span>1</span>
          <span>1K</span>
          <span>10K</span>
          <span>100K</span>
          <span>1M</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 text-right font-medium">Daily</th>
              <th className="pb-2 text-right font-medium">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {projections.slice(0, 8).map((p, i) => (
              <tr
                key={p.model_id}
                className="border-b border-border/40 transition-colors hover:bg-card/50"
              >
                <td className="py-2 text-xs text-foreground">
                  <span className="inline-flex items-center gap-2">
                    {i === 0 && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                    {p.display_name}
                  </span>
                </td>
                <td className="py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {fmtCost(p.daily)}
                </td>
                <td
                  className={`py-2 text-right font-mono text-xs font-semibold tabular-nums ${
                    i === 0 ? "text-primary" : "text-foreground"
                  }`}
                >
                  {fmtCost(p.monthly)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        Based on {callSites} detected call site{callSites !== 1 ? "s" : ""} · estimates ±30%
      </p>
    </div>
  );
}
