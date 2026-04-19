import { useMemo, useState } from "react";
import { BarChart2, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ModelCostSummary } from "../types";
import { fmtCost, fmtPercent, fmtTokens } from "../utils/formatters";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "oklch(0.74 0.16 155)",
  anthropic: "oklch(0.74 0.15 55)",
  google: "oklch(0.7 0.15 240)",
  groq: "oklch(0.74 0.17 155)",
  mistral: "oklch(0.7 0.18 25)",
  meta: "oklch(0.66 0.17 265)",
  cohere: "oklch(0.68 0.17 320)",
  xai: "oklch(0.66 0.22 340)",
  deepseek: "oklch(0.74 0.12 210)",
};

const BAR_COLORS = {
  declared: "oklch(0.5 0.01 270)",
  selected: "oklch(0.78 0.16 70)",
  benchmark: "oklch(0.74 0.17 155)",
} as const;

interface Props {
  summaries: ModelCostSummary[];
  /** Sum of costs at models declared in code (when calls resolved). */
  actualTotalCostUsd: number | null;
}

function truncateLabel(s: string, max = 26): string {
  const t = s.replace(" (Groq)", "");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

const DEFAULT_VISIBLE_ROWS = 10;

export default function CostTable({ summaries, actualTotalCostUsd }: Props) {
  const [view, setView] = useState<"table" | "chart">("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const cheapest = summaries[0];
  const hiddenCount = Math.max(0, summaries.length - DEFAULT_VISIBLE_ROWS);
  const visibleSummaries = showAll ? summaries : summaries.slice(0, DEFAULT_VISIBLE_ROWS);
  const selected = useMemo(
    () => summaries.find((s) => s.model_id === selectedId) ?? null,
    [summaries, selectedId],
  );

  const chartData = summaries.slice(0, 10).map((s) => ({
    model_id: s.model_id,
    name: s.display_name.replace(" (Groq)", ""),
    cost: s.total_cost_usd,
    provider: s.provider,
  }));

  const comparisonData = useMemo(() => {
    if (!selected || !cheapest) return [];
    const rows: { key: string; label: string; value: number; kind: keyof typeof BAR_COLORS }[] = [];
    if (actualTotalCostUsd != null && actualTotalCostUsd > 0) {
      rows.push({
        key: "declared",
        label: "Declared in code",
        value: actualTotalCostUsd,
        kind: "declared",
      });
    }
    rows.push({
      key: "whatif",
      label: `${truncateLabel(selected.display_name)} (what-if)`,
      value: selected.total_cost_usd,
      kind: "selected",
    });
    if (selected.model_id !== cheapest.model_id) {
      rows.push({
        key: "cheapest",
        label: `${truncateLabel(cheapest.display_name)} (cheapest)`,
        value: cheapest.total_cost_usd,
        kind: "benchmark",
      });
    }
    return rows;
  }, [selected, cheapest, actualTotalCostUsd]);

  function toggleSelect(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
  }

  function handleBarClick(entry: { model_id?: string } | undefined) {
    if (entry?.model_id) toggleSelect(entry.model_id);
  }

  /** Recharts Bar onClick passes BarRectangleItem with `payload` = chart row. */
  function onBarRectangleClick(item: { payload?: { model_id?: string } }) {
    handleBarClick(item.payload);
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-base font-medium tracking-tight">Cost per model</h2>
        <div className="inline-flex overflow-hidden border border-border text-xs">
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1 transition-colors ${
              view === "table"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setView("chart")}
            className={`inline-flex items-center gap-1 px-3 py-1 transition-colors ${
              view === "chart"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 size={12} /> Chart
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Each row is the estimated cost for your repo&apos;s token volume at that model&apos;s list price.
        {view === "table" ? " Click a row" : " Click a bar"} to compare against declared usage and the cheapest option.
      </p>

      {view === "table" ? (
        <div
          className={`overflow-x-auto ${
            showAll ? "max-h-[28rem] overflow-y-auto" : ""
          }`}
        >
          <table className="w-full text-sm">
            <thead className={showAll ? "sticky top-0 z-10 bg-card" : ""}>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-3 font-normal">Model</th>
                <th className="px-3 py-3 font-normal">Tier</th>
                <th className="px-3 py-3 text-right font-normal">In / 1M</th>
                <th className="px-3 py-3 text-right font-normal">Out / 1M</th>
                <th className="px-3 py-3 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleSummaries.map((s, i) => {
                const isSelected = selectedId === s.model_id;
                const isCheapest = i === 0;
                const meta = PROVIDER_COLORS[s.provider] ?? "var(--muted-foreground)";
                return (
                  <tr
                    key={s.model_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSelect(s.model_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelect(s.model_id);
                      }
                    }}
                    className={`cursor-pointer border-b border-border/30 outline-none transition-colors last:border-0 focus-visible:bg-card/60 hover:bg-card/50 ${
                      isSelected ? "bg-card/60" : ""
                    }`}
                    aria-pressed={isSelected}
                    aria-label={`${s.display_name}, total ${fmtCost(s.total_cost_usd)}. Click to compare.`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: meta }} />
                        <div>
                          <div className="text-foreground">{s.display_name}</div>
                          <div className="text-xs capitalize text-muted-foreground">{s.provider}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <TierBadge tier={s.quality_tier} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      ${s.input_price_per_mtoken.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      ${s.output_price_per_mtoken.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                      {fmtCost(s.total_cost_usd)}
                      {isCheapest && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">
                          cheapest
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {view === "table" && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          aria-expanded={showAll}
        >
          {showAll ? (
            <>
              <ChevronUp size={14} /> Show fewer
            </>
          ) : (
            <>
              <ChevronDown size={14} /> Show all {summaries.length} models ({hiddenCount} more)
            </>
          )}
        </button>
      )}

      {view === "table" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tokens — input: {fmtTokens(summaries[0]?.total_input_tokens ?? 0)} · output:{" "}
          {fmtTokens(summaries[0]?.total_output_tokens ?? 0)}
        </p>
      )}

      {view === "chart" && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => fmtCost(v)}
              tick={{ fontSize: 11, fill: "oklch(0.6 0.01 270)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: "oklch(0.85 0.005 270)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => fmtCost(Number(v))}
              cursor={{ fill: "oklch(0.85 0.18 65 / 0.08)" }}
              contentStyle={{
                background: "oklch(0.2 0.012 270)",
                border: "1px solid oklch(0.32 0.012 270)",
                borderRadius: 4,
                fontSize: 12,
                color: "oklch(0.95 0.005 270)",
              }}
            />
            <Bar dataKey="cost" radius={[0, 2, 2, 0]} cursor="pointer" onClick={onBarRectangleClick}>
              {chartData.map((d) => (
                <Cell
                  key={d.model_id}
                  fill={
                    selectedId === d.model_id
                      ? "var(--primary)"
                      : PROVIDER_COLORS[d.provider] ?? "var(--muted-foreground)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {selected && comparisonData.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-medium text-foreground">
                If you used {selected.display_name}
              </h3>
              <WhatIfNarrative
                selected={selected}
                actualTotalCostUsd={actualTotalCostUsd}
                cheapest={cheapest}
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-card hover:text-foreground"
              aria-label="Close comparison"
            >
              <X size={18} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(140, comparisonData.length * 48)}>
            <BarChart data={comparisonData} layout="vertical" margin={{ left: 4, right: 16 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => fmtCost(v)}
                tick={{ fontSize: 11, fill: "oklch(0.6 0.01 270)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={200}
                tick={{ fontSize: 10, fill: "oklch(0.85 0.005 270)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => fmtCost(Number(v))}
                contentStyle={{
                  background: "oklch(0.2 0.012 270)",
                  border: "1px solid oklch(0.32 0.012 270)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "oklch(0.95 0.005 270)",
                }}
              />
              <Bar dataKey="value" radius={[0, 2, 2, 0]} name="Cost">
                {comparisonData.map((d) => (
                  <Cell key={d.key} fill={BAR_COLORS[d.kind]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted-foreground">
            What-if uses the same estimated input/output tokens (including loop multipliers) as the rest of the report.
          </p>
        </div>
      )}
    </div>
  );
}

function WhatIfNarrative({
  selected,
  actualTotalCostUsd,
  cheapest,
}: {
  selected: ModelCostSummary;
  actualTotalCostUsd: number | null;
  cheapest: ModelCostSummary | undefined;
}) {
  const parts: string[] = [];
  parts.push(`At list price, all detected calls would cost ${fmtCost(selected.total_cost_usd)} on ${selected.display_name}.`);

  if (actualTotalCostUsd != null && actualTotalCostUsd > 0) {
    const ratio = (selected.total_cost_usd - actualTotalCostUsd) / actualTotalCostUsd;
    if (Math.abs(ratio) < 0.005) {
      parts.push(`That is about the same as your declared mix (${fmtCost(actualTotalCostUsd)}).`);
    } else if (ratio > 0) {
      parts.push(
        `That is about ${fmtPercent(ratio)} more than cost at models declared in code (${fmtCost(actualTotalCostUsd)}).`,
      );
    } else {
      parts.push(
        `That is about ${fmtPercent(-ratio)} less than cost at models declared in code (${fmtCost(actualTotalCostUsd)}).`,
      );
    }
  } else {
    parts.push("Declared-model total is unavailable until enough calls resolve to a catalog model.");
  }

  if (cheapest && selected.model_id !== cheapest.model_id) {
    const vsCheap = (selected.total_cost_usd - cheapest.total_cost_usd) / cheapest.total_cost_usd;
    parts.push(
      `The cheapest catalog option for this workload is ${cheapest.display_name} (${fmtCost(cheapest.total_cost_usd)}); your pick is about ${fmtPercent(vsCheap)} more expensive.`,
    );
  } else if (cheapest && selected.model_id === cheapest.model_id) {
    parts.push("This model is already the cheapest option in our catalog for this token volume.");
  }

  return <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{parts.join(" ")}</p>;
}

function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === "premium"
      ? "border-[oklch(0.66_0.22_340/0.4)] bg-[oklch(0.66_0.22_340/0.15)] text-[oklch(0.85_0.2_340)]"
      : tier === "mid"
        ? "border-[oklch(0.7_0.15_240/0.4)] bg-[oklch(0.7_0.15_240/0.15)] text-[oklch(0.85_0.15_240)]"
        : "border-border bg-card text-muted-foreground";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>
      {tier}
    </span>
  );
}
