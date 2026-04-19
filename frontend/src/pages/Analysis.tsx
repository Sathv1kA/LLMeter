import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  Download,
  FileJson,
  FileText,
  Clock,
  KeyRound,
  Search,
  Wifi,
  ServerCrash,
  Sparkles,
  FileCode2,
  Zap,
  Layers,
  Cpu,
  X,
} from "lucide-react";
import {
  analyzeRepo,
  AnalyzeError,
  type AnalyzeErrorKind,
  type AiRecommenderConfig,
} from "../api/client";
import type { CostReport, DetectedCall, ProgressEvent } from "../types";
import { providerMeta } from "../lib/providers";
import { CountUp } from "../components/CountUp";
import ReportView from "../components/ReportView";
import ShareButton from "../components/ShareButton";
import { downloadJson, downloadMarkdown } from "../utils/exporters";

type AnalysisNavState = {
  githubToken?: string | null;
  aiRecommender?: AiRecommenderConfig | null;
};

type Phase = "idle" | "fetching" | "scanning" | "done" | "error";

export default function Analysis() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navState = (location.state ?? null) as AnalysisNavState | null;
  const repoUrl = params.get("repo") ?? "";
  const callsPerDay = Number(params.get("cpd") ?? "1000");

  // Secrets come via router state (never URL params — no history/referer leak).
  // Captured into a ref on first render so replacing history state doesn't
  // retrigger the analyze effect.
  const initialToken = navState?.githubToken ?? params.get("token") ?? null;
  const initialAi = navState?.aiRecommender ?? null;
  const secretsRef = useRef<{ token: string | null; ai: AiRecommenderConfig | null }>({
    token: initialToken,
    ai: initialAi,
  });
  const hasToken = !!initialToken;
  const usingAi = !!initialAi;

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [revealedCalls, setRevealedCalls] = useState<DetectedCall[]>([]);
  const [report, setReport] = useState<CostReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorKind, setErrorKind] = useState<AnalyzeErrorKind>("unknown");
  const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!repoUrl) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("fetching");
    setProgress({ done: 0, total: 0 });
    setRevealedCalls([]);

    const { token, ai } = secretsRef.current;
    analyzeRepo(repoUrl, token, callsPerDay, ai, (event) => {
      if (cancelled) return;
      if (event.type === "progress") {
        const p = event as ProgressEvent;
        if (p.stage === "scanning") {
          setPhase("scanning");
        } else if (p.files_scanned !== undefined) {
          setProgress({ done: p.files_scanned, total: p.total ?? p.files_scanned });
        }
      } else if (event.type === "result") {
        // Sneak-peek-feed gets the detected calls; the full report rolls in.
        setRevealedCalls(event.data.calls);
        setReport(event.data);
        setWarning(event.warning);
        setReportId(event.report_id ?? null);
        setPhase("done");
      } else if (event.type === "error") {
        const msg = event.message;
        let kind: AnalyzeErrorKind = "server";
        if (/rate limit/i.test(msg)) kind = "rate_limit";
        else if (/not found|check the url/i.test(msg)) kind = "not_found";
        else if (/token|invalid|expired|access denied/i.test(msg)) kind = "auth";
        else if (/network/i.test(msg)) kind = "network";
        setErrorMsg(msg);
        setErrorKind(kind);
        setPhase("error");
      }
    }).catch((err) => {
      if (cancelled) return;
      if (err instanceof AnalyzeError) {
        setErrorMsg(err.message);
        setErrorKind(err.kind);
        setRetryAfter(err.retryAfterSeconds);
      } else {
        setErrorMsg(String(err));
        setErrorKind("unknown");
      }
      setPhase("error");
    });

    return () => {
      cancelled = true;
    };
  }, [repoUrl, callsPerDay]);

  const repoName = repoUrl.replace("https://github.com/", "");

  // ── Error screen ────────────────────────────────────────────────
  if (phase === "error") {
    const ui = errorUi(errorKind, errorMsg, { retryAfter, hasToken });
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className={`mx-auto mb-4 ${ui.iconClass}`}>{ui.icon}</div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Something went wrong
          </div>
          <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-foreground">
            {ui.title}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{ui.body}</p>
          {ui.hint && (
            <p className="mt-2 text-xs text-muted-foreground/80">{ui.hint}</p>
          )}
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Try another repo
          </Link>
        </div>
      </main>
    );
  }

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const streamPct =
    phase === "scanning" ? 92 : phase === "done" ? 100 : progress.total > 0 ? pct * 0.85 : 8;

  // ── Results screen (phase === "done") ───────────────────────────
  if (phase === "done" && report) {
    return (
      <main className="min-h-screen">
        <StickyHeader
          repoName={repoName}
          done
          usingAi={usingAi}
          progressPct={100}
          rightSlot={
            <div className="flex items-center gap-2">
              {reportId && <ShareButton reportId={reportId} />}
              {report.total_call_sites > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setExportOpen((v) => !v)}
                    onBlur={() => setTimeout(() => setExportOpen(false), 150)}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    aria-haspopup="menu"
                    aria-expanded={exportOpen}
                  >
                    <Download className="size-3.5" />
                    Export
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          downloadJson(report, repoName);
                          setExportOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-card"
                      >
                        <FileJson className="size-3.5" />
                        Download JSON
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          downloadMarkdown(report, repoName);
                          setExportOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-card"
                      >
                        <FileText className="size-3.5" />
                        Download Markdown
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          }
        />

        <section className="mx-auto max-w-6xl px-6 py-10">
          {warning && (
            <div className="mb-6 border-l-2 border-amber/60 bg-card/30 px-4 py-3 text-sm">
              <div className="flex items-start gap-2 text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                {warning}
              </div>
            </div>
          )}

          {report.recommender_fallback_reason && (
            <div className="mb-6 border-l-2 border-amber/60 bg-card/30 px-4 py-3 text-sm">
              <div className="text-foreground">
                AI recommender unavailable — showing heuristic picks.
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {report.recommender_fallback_reason}
              </div>
            </div>
          )}

          {report.recommender_mode === "ai" && !report.recommender_fallback_reason && (
            <div className="mb-6 border-l-2 border-primary/60 bg-card/30 px-4 py-3 text-xs text-muted-foreground">
              Recommendations judged by{" "}
              <span className="font-mono text-foreground">claude-haiku-4-5</span> ·
              one request per unique call shape.
            </div>
          )}

          <div className="mb-10">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              04 — Report
            </div>
            <h1 className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              Cost breakdown
            </h1>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              github.com/{repoName}
              <span className="ml-2 opacity-60">·</span>
              <span className="ml-2">
                {report.files_scanned} files · {report.total_call_sites} calls
              </span>
            </div>
          </div>

          <ReportView report={report} initialCallsPerDay={callsPerDay} />
        </section>
      </main>
    );
  }

  // ── Streaming / progress screen ─────────────────────────────────
  return (
    <main className="min-h-screen">
      <StickyHeader
        repoName={repoName}
        done={false}
        usingAi={usingAi}
        progressPct={streamPct}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1fr_1.1fr]">
        {/* Left: status + counters */}
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 font-mono text-xs text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-amber" />
              {phase === "scanning" ? "scanning" : "fetching"} {repoName || "repo"}
            </div>
            <h1 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight md:text-4xl">
              Tracing every <span className="text-gradient">LLM call</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Walking the AST, matching SDK signatures, and estimating tokens
              with each provider&apos;s tokenizer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Counter
              label="Files scanned"
              value={progress.done}
              icon={<FileCode2 className="size-4" />}
              tint="from-[oklch(0.62_0.24_285)] to-[oklch(0.66_0.28_340)]"
            />
            <Counter
              label="Calls detected"
              value={revealedCalls.length}
              icon={<Zap className="size-4" />}
              tint="from-[oklch(0.66_0.28_340)] to-[oklch(0.78_0.18_70)]"
            />
            <Counter
              label="Providers"
              value={new Set(revealedCalls.map((c) => c.sdk)).size}
              icon={<Layers className="size-4" />}
              tint="from-[oklch(0.78_0.18_70)] to-[oklch(0.74_0.2_150)]"
            />
            <Counter
              label="Projected daily calls"
              value={callsPerDay}
              icon={<Cpu className="size-4" />}
              tint="from-[oklch(0.78_0.15_200)] to-[oklch(0.62_0.24_285)]"
              format={(n) => Math.round(n).toLocaleString()}
              colSpan="col-span-2 sm:col-span-3"
            />
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-gradient-card p-5">
            <PhaseRow label="Connecting to GitHub" active={phase === "fetching" && progress.total === 0} done={phase !== "idle" && phase !== "fetching" || progress.total > 0} />
            <PhaseRow
              label="Fetching source files"
              active={phase === "fetching" && progress.total > 0 && pct < 100}
              done={phase === "scanning" || phase === "done"}
            />
            <PhaseRow
              label="Detecting LLM SDK calls"
              active={phase === "scanning"}
              done={phase === "done"}
            />
            <PhaseRow
              label="Estimating tokens & costs"
              active={false}
              done={phase === "done"}
            />
          </div>
        </div>

        {/* Right: live feed */}
        <div className="flex flex-col rounded-2xl border border-border bg-card/40 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="font-mono text-xs text-muted-foreground">
              live feed
            </div>
            <div className="font-mono text-xs text-muted-foreground tabular-nums">
              {progress.total > 0 ? `${progress.done} / ${progress.total}` : "…"}
            </div>
          </div>
          <div className="max-h-[60vh] flex-1 overflow-auto p-3">
            {phase === "scanning" && revealedCalls.length === 0 && (
              <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                Scanning files for SDK signatures…
              </div>
            )}
            {phase === "fetching" && (
              <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                {progress.total > 0
                  ? `Fetching ${progress.total - progress.done} more files…`
                  : "Waking up the parser…"}
              </div>
            )}
            {revealedCalls
              .slice(-25)
              .reverse()
              .map((c) => {
                const meta = providerMeta(c.sdk);
                return (
                  <div
                    key={c.id}
                    className="mb-2 flex animate-fade-in-row items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3 text-sm transition-colors hover:bg-background/70"
                  >
                    <div
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: meta.colorVar,
                        boxShadow: `0 0 8px ${meta.colorVar}`,
                      }}
                    />
                    <div className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                      {c.file_path}
                      <span className="text-foreground/60">:{c.line_number}</span>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-card/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.sdk}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </section>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────
// Building blocks

function StickyHeader({
  repoName,
  done,
  usingAi,
  progressPct,
  rightSlot,
}: {
  repoName: string;
  done: boolean;
  usingAi: boolean;
  progressPct: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            aria-label="Back to home"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-hero">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{done ? "Analysis complete" : "Analyzing repository"}</span>
                {usingAi && (
                  <span className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-primary">
                    AI
                  </span>
                )}
              </div>
              <div className="truncate font-mono text-sm font-semibold">
                {repoName || "…"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {rightSlot}
          {!done && (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <X className="size-3.5" />
              Cancel
            </Link>
          )}
          <div className="hidden items-center gap-2 sm:flex">
            <span
              className={`size-2 rounded-full ${done ? "bg-success" : "animate-pulse bg-amber"}`}
            />
            <span className="text-xs text-muted-foreground">
              {done ? "Done" : "Live"}
            </span>
          </div>
        </div>
      </div>

      <div className="h-0.5 w-full overflow-hidden bg-border/30">
        <div
          className="h-full bg-gradient-hero transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </header>
  );
}

function Counter({
  label,
  value,
  icon,
  tint,
  format,
  colSpan,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
  format?: (n: number) => string;
  colSpan?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-4 ${colSpan ?? ""}`}
    >
      <div
        className={`mb-3 inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${tint} text-primary-foreground`}
      >
        {icon}
      </div>
      <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">
        <CountUp value={value} format={format} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PhaseRow({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className={`size-2 shrink-0 rounded-full transition-colors ${
          done
            ? "bg-success"
            : active
              ? "animate-pulse bg-amber"
              : "bg-border"
        }`}
        style={
          done
            ? { boxShadow: "0 0 8px var(--success)" }
            : active
              ? { boxShadow: "0 0 8px var(--amber)" }
              : undefined
        }
      />
      <div
        className={`text-sm transition-colors ${
          done || active ? "text-foreground" : "text-muted-foreground/60"
        }`}
      >
        {label}
      </div>
      {active && (
        <div className="ml-auto font-mono text-xs text-amber">running…</div>
      )}
      {done && (
        <div className="ml-auto font-mono text-xs text-success">done</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Error UI helper

type ErrorUi = {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  body: string;
  hint?: string;
};

function errorUi(
  kind: AnalyzeErrorKind,
  rawMsg: string,
  opts: { retryAfter?: number; hasToken: boolean },
): ErrorUi {
  const red = "text-destructive";
  const amber = "text-amber";
  const muted = "text-muted-foreground";

  switch (kind) {
    case "rate_limit": {
      const wait = opts.retryAfter
        ? `Try again in about ${Math.ceil(opts.retryAfter / 60)} minute${opts.retryAfter >= 120 ? "s" : ""}.`
        : "Wait a few minutes before trying again.";
      return {
        icon: <Clock size={36} />,
        iconClass: amber,
        title: "Rate limit reached",
        body: rawMsg,
        hint: wait,
      };
    }
    case "not_found":
      return {
        icon: <Search size={36} />,
        iconClass: muted,
        title: "Repository not found",
        body: rawMsg,
        hint: opts.hasToken
          ? "Double-check the URL. Your token may not have access to this repo."
          : "Double-check the URL. If it's a private repo, add a GitHub token in Advanced options.",
      };
    case "auth":
      return {
        icon: <KeyRound size={36} />,
        iconClass: red,
        title: "Authentication problem",
        body: rawMsg,
        hint: "Verify your GitHub token has `repo` scope and hasn't expired.",
      };
    case "network":
      return {
        icon: <Wifi size={36} />,
        iconClass: red,
        title: "Can't reach the server",
        body: rawMsg,
        hint: "Check your connection, or the backend may be down.",
      };
    case "stream":
      return {
        icon: <Wifi size={36} />,
        iconClass: amber,
        title: "Connection dropped",
        body: rawMsg,
        hint: "The analysis was interrupted. Try running it again.",
      };
    case "validation":
      return {
        icon: <AlertTriangle size={36} />,
        iconClass: amber,
        title: "Invalid request",
        body: rawMsg,
      };
    case "server":
      return {
        icon: <ServerCrash size={36} />,
        iconClass: red,
        title: "Server error",
        body: rawMsg,
        hint: "Something went wrong on our end. Try again in a moment.",
      };
    default:
      return {
        icon: <AlertTriangle size={36} />,
        iconClass: red,
        title: "Analysis failed",
        body: rawMsg,
      };
  }
}
