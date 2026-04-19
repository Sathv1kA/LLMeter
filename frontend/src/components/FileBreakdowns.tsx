import { Fragment, useState } from "react";
import { FileCode } from "lucide-react";
import type { CostReport, FileBreakdown, DetectedCall } from "../types";
import { fmtCost, fmtTokens } from "../utils/formatters";
import { providerMeta } from "../lib/providers";

interface Props {
  report: CostReport;
}

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

export default function FileBreakdowns({ report }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = report.file_breakdowns.filter((f) =>
    f.file_path.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const callsByFile = new Map<string, DetectedCall[]>();
  for (const c of report.calls) {
    if (!callsByFile.has(c.file_path)) callsByFile.set(c.file_path, []);
    callsByFile.get(c.file_path)!.push(c);
  }

  if (report.file_breakdowns.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-primary" />
          <h2 className="font-display text-base font-medium tracking-tight">
            Files with LLM calls
          </h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {filtered.length}
            {filtered.length !== report.file_breakdowns.length && ` of ${report.file_breakdowns.length}`}
          </span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter file path…"
          className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">File</th>
              <th className="pb-2 pr-3 text-right font-medium">Calls</th>
              <th className="pb-2 pr-3 text-right font-medium">Tokens</th>
              <th className="pb-2 pr-3 font-medium">SDKs</th>
              <th className="pb-2 text-right font-medium">Cost (declared)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((fb) => {
              const isOpen = expanded === fb.file_path;
              return (
                <Fragment key={fb.file_path}>
                  <tr
                    className="cursor-pointer border-b border-border/40 transition-colors hover:bg-card/50"
                    onClick={() => setExpanded(isOpen ? null : fb.file_path)}
                  >
                    <td className="py-2 pr-3">
                      <div className="break-all font-mono text-xs text-foreground">
                        {fb.file_path}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fb.call_count}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fmtTokens(fb.total_input_tokens)}/{fmtTokens(fb.total_output_tokens)}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {fb.sdks.map((s) => {
                          const meta = providerMeta(SDK_TO_PROVIDER[s]);
                          return (
                            <span
                              key={s}
                              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}
                            >
                              <span
                                className="size-1 rounded-full"
                                style={{ backgroundColor: meta.colorVar }}
                              />
                              {s}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                      {fb.actual_cost_usd > 0 ? fmtCost(fb.actual_cost_usd) : "—"}
                    </td>
                  </tr>
                  {isOpen && <ExpandedCalls calls={callsByFile.get(fb.file_path) ?? []} fb={fb} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && search && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No files match "{search}".
        </p>
      )}
    </div>
  );
}

function ExpandedCalls({ calls, fb }: { calls: DetectedCall[]; fb: FileBreakdown }) {
  return (
    <tr className="bg-background/40">
      <td colSpan={5} className="px-4 py-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {calls.length} call{calls.length === 1 ? "" : "s"} in{" "}
          <span className="font-mono normal-case tracking-normal">{fb.file_path}</span>
        </p>
        <ul className="space-y-1 font-mono text-xs text-foreground">
          {calls.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="text-muted-foreground/70">line {c.line_number}</span>
              <span className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {c.sdk}
              </span>
              {c.model_hint && (
                <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {c.model_hint}
                </span>
              )}
              <span className="truncate text-muted-foreground">{c.raw_match}</span>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}
