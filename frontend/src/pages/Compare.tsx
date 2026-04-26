/**
 * Side-by-side comparison of two cached reports.
 *
 * Route:  /compare?a=<reportIdA>&b=<reportIdB>
 *
 * The cache backing /reports/{id} already persists every analysis result,
 * so this page is read-only — it just calls fetchSharedReport(id) twice in
 * parallel and renders a paired view. Useful for "before vs after migration"
 * or "repo X vs repo Y" comparisons.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";
import {
  AnalyzeError,
  fetchSharedReport,
  type AnalyzeErrorKind,
} from "../api/client";
import type { CostReport, ModelCostSummary } from "../types";
import { fmtCost, fmtPercent, fmtTokens } from "../utils/formatters";

type Side = "a" | "b";

interface LoadedSide {
  id: string;
  report: CostReport;
}

interface FailedSide {
  id: string;
  message: string;
  kind: AnalyzeErrorKind;
}

function shortRepo(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "");
}

export default function Compare() {
  const [params] = useSearchParams();
  const idA = params.get("a") ?? "";
  const idB = params.get("b") ?? "";

  // `loading` starts true only when both ids are present — otherwise we skip
  // the effect and render the missing-ids screen. Initializing this way keeps
  // the effect free of synchronous setState calls.
  const haveBoth = Boolean(idA && idB);
  const [a, setA] = useState<LoadedSide | FailedSide | null>(null);
  const [b, setB] = useState<LoadedSide | FailedSide | null>(null);
  const [loading, setLoading] = useState(haveBoth);

  useEffect(() => {
    if (!idA || !idB) return;
    let cancelled = false;

    function loadOne(
      id: string,
      setter: (v: LoadedSide | FailedSide) => void,
    ) {
      return fetchSharedReport(id)
        .then((report) => {
          if (!cancelled) setter({ id, report });
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof AnalyzeError) {
            setter({ id, message: err.message, kind: err.kind });
          } else {
            setter({ id, message: String(err), kind: "unknown" });
          }
        });
    }

    Promise.all([loadOne(idA, setA), loadOne(idB, setB)]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [idA, idB]);

  if (!idA || !idB) {
    return (
      <ErrorScreen
        title="Need two report IDs"
        body="Compare expects /compare?a=ID1&b=ID2 — both query params are required."
      />
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading reports…
      </main>
    );
  }

  // If either side failed to load, show a focused error rather than a half-
  // populated view that's hard to interpret.
  if (a && "message" in a) {
    return (
      <ErrorScreen
        title={`Could not load report A (${a.id})`}
        body={a.message}
      />
    );
  }
  if (b && "message" in b) {
    return (
      <ErrorScreen
        title={`Could not load report B (${b.id})`}
        body={b.message}
      />
    );
  }
  if (!a || !b || !("report" in a) || !("report" in b)) {
    return <ErrorScreen title="Report data missing" body="Try reloading." />;
  }

  return <CompareView a={a} b={b} />;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

function CompareView({ a, b }: { a: LoadedSide; b: LoadedSide }) {
  const repoA = shortRepo(a.report.repo_url);
  const repoB = shortRepo(b.report.repo_url);

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Home
          </Link>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Compare
          </div>
        </div>

        {/* Header — repo names side-by-side */}
        <div className="mb-10 grid gap-4 md:grid-cols-2">
          <SideHeader label="A" repoLabel={repoA} report={a.report} reportId={a.id} />
          <SideHeader label="B" repoLabel={repoB} report={b.report} reportId={b.id} />
        </div>

        {/* Hero deltas */}
        <h2 className="mb-3 font-display text-base font-medium tracking-tight">
          Headline metrics
        </h2>
        <div className="mb-12 overflow-hidden rounded-md border border-border bg-card/40">
          <DeltaRow
            label="Call sites"
            a={a.report.total_call_sites}
            b={b.report.total_call_sites}
            format={(n) => n.toLocaleString()}
            kind="count"
          />
          <DeltaRow
            label="Cost @ declared models"
            a={a.report.actual_total_cost_usd}
            b={b.report.actual_total_cost_usd}
            format={fmtCost}
            kind="cost"
          />
          <DeltaRow
            label="Cost after recommended swaps"
            a={a.report.recommended_total_cost_usd}
            b={b.report.recommended_total_cost_usd}
            format={fmtCost}
            kind="cost"
          />
          <DeltaRow
            label="Potential savings"
            a={a.report.total_potential_savings_usd}
            b={b.report.total_potential_savings_usd}
            format={fmtCost}
            kind="savings"
          />
          <DeltaRow
            label="Total input tokens"
            a={sumTokens(a.report, "input")}
            b={sumTokens(b.report, "input")}
            format={fmtTokens}
            kind="count"
          />
          <DeltaRow
            label="Total output tokens"
            a={sumTokens(a.report, "output")}
            b={sumTokens(b.report, "output")}
            format={fmtTokens}
            kind="count"
          />
        </div>

        {/* SDKs */}
        <h2 className="mb-3 font-display text-base font-medium tracking-tight">
          SDKs detected
        </h2>
        <SdkDiff a={a.report.detected_sdks} b={b.report.detected_sdks} />

        {/* Per-model totals */}
        <h2 className="mt-12 mb-3 font-display text-base font-medium tracking-tight">
          Cost across models — paired
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Same per-model totals you see on each report, lined up so you can
          spot which model gets cheaper, more expensive, or stays flat between
          the two repos.
        </p>
        <PerModelTable a={a.report.per_model_summaries} b={b.report.per_model_summaries} />
      </div>
    </main>
  );
}

function SideHeader({
  label,
  repoLabel,
  report,
  reportId,
}: {
  label: string;
  repoLabel: string;
  report: CostReport;
  reportId: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <Link
          to={`/r/${reportId}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Open full report <ExternalLink className="size-3" />
        </Link>
      </div>
      <div className="mt-1 font-mono text-sm font-medium text-foreground" title={report.repo_url}>
        {repoLabel}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{report.files_scanned.toLocaleString()} files</span>
        <span>{report.total_call_sites.toLocaleString()} call sites</span>
        <span>{report.detected_sdks.length} SDKs</span>
        <span className="opacity-70">
          {new Date(report.generated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delta row — three numbers (A, B, Δ) with sign-aware coloring.
//   - kind="cost":     B > A is red (more spend),  B < A is green (less spend)
//   - kind="savings":  B > A is green (more saves), B < A is red
//   - kind="count":    neutral (no color), uses signed delta
// ---------------------------------------------------------------------------

function DeltaRow({
  label,
  a,
  b,
  format,
  kind,
}: {
  label: string;
  a: number | null | undefined;
  b: number | null | undefined;
  format: (n: number) => string;
  kind: "cost" | "savings" | "count";
}) {
  const aNum = typeof a === "number" ? a : null;
  const bNum = typeof b === "number" ? b : null;
  const delta = aNum != null && bNum != null ? bNum - aNum : null;
  const ratio = aNum != null && aNum !== 0 && delta != null ? delta / Math.abs(aNum) : null;

  let deltaClass = "text-muted-foreground";
  if (delta != null && delta !== 0) {
    const cheaperIsBetter = kind === "cost";
    const moreIsBetter = kind === "savings";
    if (cheaperIsBetter) {
      deltaClass = delta < 0 ? "text-emerald-400" : "text-rose-400";
    } else if (moreIsBetter) {
      deltaClass = delta > 0 ? "text-emerald-400" : "text-rose-400";
    } else {
      deltaClass = "text-foreground";
    }
  }

  return (
    <div className="grid grid-cols-12 items-baseline gap-4 border-b border-border/40 px-5 py-3 text-sm last:border-0">
      <div className="col-span-12 text-xs uppercase tracking-[0.14em] text-muted-foreground sm:col-span-3">
        {label}
      </div>
      <div className="col-span-4 text-right font-mono tabular-nums text-foreground sm:col-span-3">
        {aNum != null ? format(aNum) : "—"}
      </div>
      <div className="col-span-4 text-right font-mono tabular-nums text-foreground sm:col-span-3">
        {bNum != null ? format(bNum) : "—"}
      </div>
      <div className={`col-span-4 text-right font-mono text-xs tabular-nums sm:col-span-3 ${deltaClass}`}>
        {delta == null
          ? "—"
          : delta === 0
            ? "no change"
            : `${delta > 0 ? "+" : "−"}${format(Math.abs(delta))}${
                ratio != null ? ` (${delta > 0 ? "+" : "−"}${fmtPercent(Math.abs(ratio))})` : ""
              }`}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-model paired table
// ---------------------------------------------------------------------------

function PerModelTable({
  a,
  b,
}: {
  a: ModelCostSummary[];
  b: ModelCostSummary[];
}) {
  // Union of model_ids, ordered by min(A, B) cost so the cheapest in either
  // report bubbles up. We always show a row even if one side is missing it.
  const aMap = new Map(a.map((s) => [s.model_id, s]));
  const bMap = new Map(b.map((s) => [s.model_id, s]));
  const ids = Array.from(new Set([...aMap.keys(), ...bMap.keys()]));
  ids.sort((x, y) => {
    const xMin = Math.min(
      aMap.get(x)?.total_cost_usd ?? Infinity,
      bMap.get(x)?.total_cost_usd ?? Infinity,
    );
    const yMin = Math.min(
      aMap.get(y)?.total_cost_usd ?? Infinity,
      bMap.get(y)?.total_cost_usd ?? Infinity,
    );
    return xMin - yMin;
  });

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-normal">Model</th>
            <th className="px-3 py-3 text-right font-normal">A</th>
            <th className="px-3 py-3 text-right font-normal">B</th>
            <th className="px-4 py-3 text-right font-normal">Δ</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const ar = aMap.get(id);
            const br = bMap.get(id);
            const display = ar?.display_name ?? br?.display_name ?? id;
            const provider = ar?.provider ?? br?.provider ?? "";
            const aCost = ar?.total_cost_usd ?? null;
            const bCost = br?.total_cost_usd ?? null;
            const delta = aCost != null && bCost != null ? bCost - aCost : null;
            const ratio =
              aCost != null && aCost > 0 && delta != null ? delta / aCost : null;
            let deltaClass = "text-muted-foreground";
            if (delta != null && delta !== 0) {
              deltaClass = delta < 0 ? "text-emerald-400" : "text-rose-400";
            }
            return (
              <tr key={id} className="border-b border-border/30 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="text-foreground">{display}</div>
                  <div className="text-xs capitalize text-muted-foreground">{provider}</div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">
                  {aCost != null ? fmtCost(aCost) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">
                  {bCost != null ? fmtCost(bCost) : "—"}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono text-xs tabular-nums ${deltaClass}`}>
                  {delta == null
                    ? "—"
                    : delta === 0
                      ? "0"
                      : `${delta > 0 ? "+" : "−"}${fmtCost(Math.abs(delta))}${
                          ratio != null
                            ? ` (${delta > 0 ? "+" : "−"}${fmtPercent(Math.abs(ratio))})`
                            : ""
                        }`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SDK diff — three buckets: A only / both / B only
// ---------------------------------------------------------------------------

function SdkDiff({ a, b }: { a: string[]; b: string[] }) {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const both: string[] = [];
  const onlyA: string[] = [];
  const onlyB: string[] = [];
  for (const s of aSet) {
    if (bSet.has(s)) both.push(s);
    else onlyA.push(s);
  }
  for (const s of bSet) {
    if (!aSet.has(s)) onlyB.push(s);
  }
  both.sort();
  onlyA.sort();
  onlyB.sort();

  function chip(name: string, variant: "neutral" | "addA" | "addB") {
    const cls =
      variant === "neutral"
        ? "border-border bg-card/60 text-foreground"
        : variant === "addA"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    return (
      <span
        key={name}
        className={`rounded-full border px-2 py-0.5 font-mono text-xs ${cls}`}
      >
        {name}
      </span>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-amber-300/80">
            Only in A
          </div>
          <div className="flex flex-wrap gap-1.5">
            {onlyA.length === 0 ? (
              <span className="text-xs text-muted-foreground/60">—</span>
            ) : (
              onlyA.map((s) => chip(s, "addA"))
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            In both
          </div>
          <div className="flex flex-wrap gap-1.5">
            {both.length === 0 ? (
              <span className="text-xs text-muted-foreground/60">—</span>
            ) : (
              both.map((s) => chip(s, "neutral"))
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-emerald-300/80">
            Only in B
          </div>
          <div className="flex flex-wrap gap-1.5">
            {onlyB.length === 0 ? (
              <span className="text-xs text-muted-foreground/60">—</span>
            ) : (
              onlyB.map((s) => chip(s, "addB"))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumTokens(report: CostReport, kind: "input" | "output"): number {
  // Each per_model_summary holds the same totals (just multiplied by that
  // model's price). Picking the first is fine — they all share the same
  // input/output token sums.
  const first = report.per_model_summaries[0];
  if (!first) return 0;
  return kind === "input" ? first.total_input_tokens : first.total_output_tokens;
}

function ErrorScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto mb-4 size-6 text-amber-300" />
        <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{body}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" /> Home
        </Link>
      </div>
    </main>
  );
}

// Side type is exported for the entry-point link in Analysis.tsx etc.
export type { Side };
