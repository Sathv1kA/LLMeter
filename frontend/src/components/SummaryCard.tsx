import { TrendingDown } from "lucide-react";
import type { CostReport } from "../types";
import { fmtCost, fmtPercent } from "../utils/formatters";
import { providerMeta } from "../lib/providers";

// SDK id → provider key used by providerMeta. Some of these (langchain,
// llamaindex) aren't really providers but we show them as "other" tints.
const SDK_TO_PROVIDER: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  gemini: "google",
  google: "google",
  cohere: "cohere",
  mistral: "mistral",
  meta: "meta",
  xai: "xai",
  deepseek: "deepseek",
  groq: "groq",
};

interface Props {
  report: CostReport;
}

export default function SummaryCard({ report }: Props) {
  const actual = report.actual_total_cost_usd;
  const recommended = report.recommended_total_cost_usd;
  const savings = report.total_potential_savings_usd;
  const savingsRatio =
    actual != null && savings != null && actual > 0 ? savings / actual : null;
  const resolvedCoverage =
    report.total_call_sites > 0
      ? report.resolved_call_count / report.total_call_sites
      : 0;

  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-base font-medium tracking-tight">Summary</h2>
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Overview
        </span>
      </div>

      <div className="mb-6 grid gap-px overflow-hidden border border-border bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Files scanned" value={report.files_scanned.toLocaleString()} />
        <Stat
          label="LLM call sites"
          value={report.total_call_sites.toLocaleString()}
          sub={`${report.files_with_calls} file${report.files_with_calls === 1 ? "" : "s"}`}
        />
        <Stat
          label="Cost at declared models"
          value={fmtCost(actual)}
          sub={
            report.total_call_sites > 0
              ? `${report.resolved_call_count}/${report.total_call_sites} resolved (${fmtPercent(resolvedCoverage)})`
              : undefined
          }
        />
        <Stat
          label="Potential savings"
          value={savings != null ? fmtCost(savings) : "—"}
          sub={
            savingsRatio != null
              ? `≈ ${fmtPercent(savingsRatio)} cheaper at recommended`
              : "Run recommender for hints"
          }
          accent
          icon={<TrendingDown size={12} />}
        />
      </div>

      {actual != null && recommended != null && actual > 0 && (
        <div className="mb-5">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Actual → Recommended</span>
            <span>
              <span className="font-mono text-foreground tabular-nums">{fmtCost(actual)}</span>
              {" → "}
              <span className="font-mono font-semibold text-primary tabular-nums">{fmtCost(recommended)}</span>
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-border/60">
            <div className="absolute inset-y-0 left-0 w-full bg-muted-foreground/40" />
            <div
              className="absolute inset-y-0 left-0 bg-primary"
              style={{ width: `${Math.max(2, (recommended / actual) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {report.detected_sdks.length > 0 && (
        <div>
          <span className="mr-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Detected SDKs
          </span>
          <div className="mt-2 inline-flex flex-wrap gap-1.5">
            {report.detected_sdks.map((sdk) => {
              const meta = providerMeta(SDK_TO_PROVIDER[sdk]);
              return (
                <span
                  key={sdk}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.chip}`}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: meta.colorVar }}
                  />
                  {sdk}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-background p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 flex items-center gap-1 font-mono text-2xl font-medium tracking-tight tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
      >
        {icon}
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}
