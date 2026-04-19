import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import type { DetectedCall, ModelCostSummary } from "../types";
import { fmtCost, fmtTokens } from "../utils/formatters";
import { providerMeta } from "../lib/providers";

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

const TASK_ACCENT: Record<string, string> = {
  summarization: "border-[oklch(0.72_0.14_180_/_0.35)] bg-[oklch(0.72_0.14_180_/_0.12)] text-[oklch(0.82_0.14_180)]",
  classification: "border-[oklch(0.66_0.18_265_/_0.35)] bg-[oklch(0.66_0.18_265_/_0.12)] text-[oklch(0.78_0.16_265)]",
  rag: "border-[oklch(0.82_0.16_75_/_0.35)] bg-[oklch(0.82_0.16_75_/_0.12)] text-[oklch(0.86_0.14_75)]",
  coding: "border-[oklch(0.68_0.2_20_/_0.35)] bg-[oklch(0.68_0.2_20_/_0.12)] text-[oklch(0.78_0.18_20)]",
  reasoning: "border-[oklch(0.66_0.22_290_/_0.35)] bg-[oklch(0.66_0.22_290_/_0.12)] text-[oklch(0.78_0.18_290)]",
  chat: "border-border bg-background/60 text-muted-foreground",
  embedding: "border-[oklch(0.72_0.14_200_/_0.35)] bg-[oklch(0.72_0.14_200_/_0.12)] text-[oklch(0.82_0.14_200)]",
};

type SortKey = "file" | "sdk" | "task" | "cost";

function SortBtn({
  sortKey,
  label,
  activeKey,
  onSelect,
}: {
  sortKey: SortKey;
  label: string;
  activeKey: SortKey;
  onSelect: (k: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      onClick={() => onSelect(sortKey)}
      className={`pb-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

interface Props {
  calls: DetectedCall[];
  summaries: ModelCostSummary[];
}

function langFor(path: string): string {
  if (path.endsWith(".py") || path.endsWith(".ipynb")) return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "jsx";
  return "markup";
}

export default function CallBreakdown({ calls, summaries }: Props) {
  const [sort, setSort] = useState<SortKey>("cost");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterSdk, setFilterSdk] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const cheapest = summaries[0];
  const cheapestInputRate = cheapest ? cheapest.input_price_per_mtoken / 1_000_000 : 0;
  const cheapestOutputRate = cheapest ? cheapest.output_price_per_mtoken / 1_000_000 : 0;

  const sdks = useMemo(() => Array.from(new Set(calls.map((c) => c.sdk))), [calls]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (filterSdk !== "all" && c.sdk !== filterSdk) return false;
      if (!needle) return true;
      return (
        c.file_path.toLowerCase().includes(needle) ||
        (c.model_hint?.toLowerCase().includes(needle) ?? false) ||
        c.task_type.toLowerCase().includes(needle) ||
        c.sdk.toLowerCase().includes(needle) ||
        c.raw_match.toLowerCase().includes(needle) ||
        (c.prompt_snippet?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [calls, filterSdk, search]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      if (sort === "file")
        return a.file_path.localeCompare(b.file_path) || a.line_number - b.line_number;
      if (sort === "sdk") return a.sdk.localeCompare(b.sdk);
      if (sort === "task") return a.task_type.localeCompare(b.task_type);
      const ca =
        a.estimated_input_tokens * cheapestInputRate +
        a.estimated_output_tokens * cheapestOutputRate;
      const cb =
        b.estimated_input_tokens * cheapestInputRate +
        b.estimated_output_tokens * cheapestOutputRate;
      return cb - ca;
    });
    return out;
  }, [filtered, sort, cheapestInputRate, cheapestOutputRate]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-medium tracking-tight">Call breakdown</h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {filtered.length}
            {filtered.length !== calls.length ? ` of ${calls.length}` : ""} call sites
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search path, model, task…"
              className="w-56 rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </div>

          <select
            value={filterSdk}
            onChange={(e) => {
              setFilterSdk(e.target.value);
              setPage(0);
            }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All SDKs</option>
            {sdks.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {calls.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No LLM call sites detected in this repository.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="w-5 pb-2 pr-3"></th>
                  <th className="pb-2 pr-3">
                    <SortBtn sortKey="file" label="File / Line" activeKey={sort} onSelect={setSort} />
                  </th>
                  <th className="pb-2 pr-3">
                    <SortBtn sortKey="sdk" label="SDK" activeKey={sort} onSelect={setSort} />
                  </th>
                  <th className="pb-2 pr-3">
                    <SortBtn sortKey="task" label="Task" activeKey={sort} onSelect={setSort} />
                  </th>
                  <th className="pb-2 pr-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Tokens (in/out)
                  </th>
                  <th className="pb-2 text-right">
                    <SortBtn
                      sortKey="cost"
                      label={`Cost (${cheapest?.display_name ?? "cheapest"})`}
                      activeKey={sort}
                      onSelect={setSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((call) => {
                  const callCost =
                    call.estimated_input_tokens * cheapestInputRate +
                    call.estimated_output_tokens * cheapestOutputRate;
                  const isOpen = expanded.has(call.id);
                  const meta = providerMeta(SDK_TO_PROVIDER[call.sdk]);
                  return (
                    <Fragment key={call.id}>
                      <tr
                        className="cursor-pointer border-b border-border/40 transition-colors hover:bg-card/50"
                        onClick={() => toggleExpand(call.id)}
                      >
                        <td className="py-2 pr-1 text-muted-foreground/70">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="max-w-[220px] truncate font-mono text-xs text-foreground">
                            {call.file_path}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground/70">
                            line {call.line_number}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}
                            >
                              <span
                                className="size-1 rounded-full"
                                style={{ backgroundColor: meta.colorVar }}
                              />
                              {call.sdk}
                            </span>
                            {call.in_loop && (
                              <span
                                title={`Detected in a loop — cost estimated at ${call.call_multiplier}× a single call`}
                                className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                              >
                                ×{call.call_multiplier}
                              </span>
                            )}
                            {call.has_vision && (
                              <span
                                title="Vision input detected — token estimate increased"
                                className="rounded-full border border-[oklch(0.66_0.22_340_/_0.35)] bg-[oklch(0.66_0.22_340_/_0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[oklch(0.78_0.16_340)]"
                              >
                                vision
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                              TASK_ACCENT[call.task_type] ?? TASK_ACCENT.chat
                            }`}
                          >
                            {call.task_type}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtTokens(call.estimated_input_tokens)} / {fmtTokens(call.estimated_output_tokens)}
                        </td>
                        <td className="py-2 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                          {fmtCost(callCost)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-background/40">
                          <td colSpan={6} className="px-4 py-4 text-sm">
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                                {call.model_hint && (
                                  <Detail
                                    label="Model in code"
                                    value={
                                      <code className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-xs text-foreground">
                                        {call.model_hint}
                                      </code>
                                    }
                                  />
                                )}
                                {call.resolved_model_id && (
                                  <Detail
                                    label="Resolved to"
                                    value={
                                      <code className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                                        {call.resolved_model_id}
                                      </code>
                                    }
                                  />
                                )}
                                <Detail
                                  label="Call type"
                                  value={<span className="text-foreground">{call.call_type}</span>}
                                />
                                {call.actual_cost_usd != null && (
                                  <Detail
                                    label="Cost (declared model)"
                                    value={
                                      <span className="font-mono font-semibold tabular-nums text-foreground">
                                        {fmtCost(call.actual_cost_usd)}
                                      </span>
                                    }
                                  />
                                )}
                              </div>

                              {call.recommended_model_id &&
                                call.potential_savings_usd &&
                                call.potential_savings_usd > 0 && (
                                  <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-2.5 text-xs">
                                    <Sparkles size={13} className="mt-0.5 shrink-0 text-primary" />
                                    <div className="text-foreground">
                                      Try{" "}
                                      <code className="rounded bg-primary/20 px-1 py-0.5 font-mono text-primary">
                                        {call.recommended_model_id}
                                      </code>{" "}
                                      — saves{" "}
                                      <span className="font-semibold text-primary">
                                        {fmtCost(call.potential_savings_usd)}
                                      </span>{" "}
                                      per call at this estimated usage.
                                    </div>
                                  </div>
                                )}

                              {call.prompt_snippet && (
                                <div>
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                    Prompt snippet
                                  </div>
                                  <div className="rounded border border-border/60 bg-background/60 p-2.5 font-serif text-xs italic text-muted-foreground">
                                    "{call.prompt_snippet.slice(0, 300)}"
                                  </div>
                                </div>
                              )}

                              <div>
                                <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                  Matched code
                                </div>
                                <Highlight
                                  theme={themes.vsDark}
                                  code={call.raw_match}
                                  language={langFor(call.file_path)}
                                >
                                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                                    <pre
                                      className={`${className} overflow-x-auto rounded border border-border/60 px-3 py-2 text-xs`}
                                      style={style}
                                    >
                                      {tokens.map((line, i) => (
                                        <div key={i} {...getLineProps({ line })}>
                                          {line.map((token, j) => (
                                            <span key={j} {...getTokenProps({ token })} />
                                          ))}
                                        </div>
                                      ))}
                                    </pre>
                                  )}
                                </Highlight>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paginated.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No calls match the current filter.
            </p>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-border px-3 py-1 text-xs text-foreground transition-colors hover:bg-card/60 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md border border-border px-3 py-1 text-xs text-foreground transition-colors hover:bg-card/60 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}{" "}
      </span>
      {value}
    </div>
  );
}
