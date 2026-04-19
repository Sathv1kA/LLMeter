import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronDown, GitBranch, KeyRound } from "lucide-react";
import { providerMeta } from "../lib/providers";

/**
 * Landing page — editorial layout inspired by the cost-clarity-hub design:
 * asymmetric hero, monospaced `github.com/` prefix input, three-step
 * explainer, live model catalog, sample CTA.
 */

const SAMPLE_REPOS = [
  { label: "langchain-ai/langchain", url: "https://github.com/langchain-ai/langchain" },
  { label: "run-llama/llama_index", url: "https://github.com/run-llama/llama_index" },
  { label: "anthropics/anthropic-sdk-python", url: "https://github.com/anthropics/anthropic-sdk-python" },
];

interface PricingModel {
  id: string;
  display_name: string;
  provider: string;
  input_price_per_mtoken: number;
  output_price_per_mtoken: number;
}

export default function Home() {
  const navigate = useNavigate();
  const [repoFragment, setRepoFragment] = useState("");
  const [token, setToken] = useState("");
  const [callsPerDay, setCallsPerDay] = useState(1000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [error, setError] = useState("");

  // Live pricing catalog — populates the Models section + the coverage card.
  const [models, setModels] = useState<PricingModel[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(
      (
        ((import.meta.env.VITE_API_BASE as string | undefined) ??
          (import.meta.env.DEV ? "" : "/_/backend"))
      ).replace(/\/$/, "") + "/pricing",
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("pricing"))))
      .then((data: PricingModel[]) => {
        if (!cancelled) setModels(data);
      })
      .catch(() => {
        /* silent — landing still works without the catalog */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Normalize "owner/repo", full URLs, and paths like "owner/repo/tree/main"
  // into the canonical `https://github.com/owner/repo` the backend expects.
  function normalize(raw: string): string | null {
    const t = raw.trim().replace(/\.git$/, "").replace(/\/+$/, "");
    if (!t) return null;
    if (t.startsWith("http")) {
      if (!t.includes("github.com/")) return null;
      return t;
    }
    if (!t.includes("/")) return null;
    return `https://github.com/${t}`;
  }

  function submit(raw: string) {
    const url = normalize(raw);
    if (!url) {
      setError("Enter a repo as owner/repo or a full github.com URL.");
      return;
    }
    if (useAi && !aiKey.trim()) {
      setError("Provide an Anthropic API key, or turn off the AI recommender.");
      return;
    }
    setError("");
    const params = new URLSearchParams({ repo: url, cpd: String(callsPerDay) });
    navigate(`/analysis?${params.toString()}`, {
      state: {
        githubToken: token || null,
        aiRecommender: useAi
          ? { provider: "anthropic" as const, apiKey: aiKey.trim() }
          : null,
      },
    });
  }

  const modelCount = models?.length ?? 0;
  const providerCount = models
    ? new Set(models.map((m) => m.provider)).size
    : 6;

  return (
    <main className="relative min-h-screen text-foreground">
      {/* Top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="size-2 rounded-full bg-primary" />
          <span className="font-display text-[15px] font-semibold tracking-tight">
            tokenlens
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#models" className="transition-colors hover:text-foreground">
            Models
          </a>
          <a
            href="https://github.com/Sathv1kA/ai-cost-modeling-platform"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <GitBranch className="size-4" />
            <span className="hidden sm:inline">Source</span>
          </a>
        </nav>
      </header>

      {/* Hero — editorial, asymmetric */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pt-16 pb-20 md:grid-cols-12 md:pt-24 md:pb-28">
        <div className="md:col-span-8">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            01 — Cost analysis for LLM apps
          </div>
          <h1 className="mt-5 font-display text-5xl font-medium leading-[1.02] tracking-tight md:text-7xl">
            What is your codebase
            <br />
            <span className="font-serif italic text-primary">actually</span>{" "}
            spending on tokens?
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Point us at a GitHub repo. We trace every LLM call, run real
            tokenizers on the prompts we can find, and tell you which models
            you could swap to without changing the output.
          </p>
        </div>

        <aside className="md:col-span-4 md:pt-12">
          <div className="rounded-md border border-border bg-card/60 p-5 text-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Coverage
            </div>
            <div className="mt-2 font-display text-3xl font-medium">
              {modelCount > 0 ? `${modelCount} models` : "60+ models"}
            </div>
            <div className="mt-1 text-muted-foreground">
              across {providerCount} providers · live pricing
            </div>
          </div>
        </aside>

        {/* Input row */}
        <div className="md:col-span-12">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(repoFragment);
            }}
            className="mt-2"
          >
            <div className="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3 px-3">
                <span className="font-mono text-sm text-muted-foreground">
                  github.com/
                </span>
                <input
                  type="text"
                  value={repoFragment}
                  onChange={(e) => setRepoFragment(e.target.value)}
                  placeholder="owner/repo"
                  className="w-full bg-transparent py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/50 sm:text-base"
                  aria-label="GitHub repository"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Analyze
                <ArrowUpRight className="size-4" />
              </button>
            </div>

            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="opacity-60">Try</span>
              {SAMPLE_REPOS.map((s) => (
                <button
                  key={s.url}
                  type="button"
                  onClick={() => {
                    setRepoFragment(s.label);
                    submit(s.url);
                  }}
                  className="font-mono underline-offset-4 hover:text-foreground hover:underline"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Advanced — GitHub token + AI recommender */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={showAdvanced}
              >
                <ChevronDown
                  className={`size-3.5 transition-transform ${showAdvanced ? "" : "-rotate-90"}`}
                />
                Advanced options
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4 rounded-md border border-border bg-card/40 p-4 text-sm">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      GitHub token
                      <span className="ml-2 normal-case opacity-60">
                        optional — lifts rate limits & opens private repos
                      </span>
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_..."
                      className="mt-1 w-full rounded-sm border border-border bg-background/40 px-3 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Daily call volume
                      <span className="ml-2 normal-case opacity-60">
                        for projections
                      </span>
                    </label>
                    <input
                      type="number"
                      value={callsPerDay}
                      onChange={(e) => setCallsPerDay(Number(e.target.value))}
                      min={1}
                      max={10_000_000}
                      className="mt-1 w-full rounded-sm border border-border bg-background/40 px-3 py-2 font-mono text-xs tabular-nums outline-none focus:border-primary/50"
                    />
                  </div>

                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(e) => setUseAi(e.target.checked)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div>
                      <div className="font-medium text-foreground">
                        Use Claude Haiku to pick models
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        One LLM request per unique call shape (not per site).
                        Falls back to the built-in heuristic on any error.
                      </p>
                    </div>
                  </label>

                  {useAi && (
                    <div>
                      <div className="flex items-center gap-2 rounded-sm border border-border bg-background/40 px-3 py-2">
                        <KeyRound className="size-3.5 text-muted-foreground" />
                        <input
                          type="password"
                          value={aiKey}
                          onChange={(e) => setAiKey(e.target.value)}
                          placeholder="sk-ant-…  (Anthropic API key)"
                          autoComplete="off"
                          className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/50"
                          aria-label="Anthropic API key"
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Key rides via in-memory router state — never URL,
                        history, or referer headers.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* How it works — three numbered rows, no icons */}
      <section
        id="how"
        className="mx-auto max-w-6xl border-t border-border/60 px-6 py-16 md:py-24"
      >
        <div className="mb-10 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-medium tracking-tight md:text-3xl">
            Three steps
          </h2>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            02 — How it works
          </span>
        </div>
        <div className="divide-y divide-border/60 border-y border-border/60">
          <Step
            n="01"
            title="Detect"
            body="Static analysis walks Python and TypeScript ASTs to find every OpenAI, Anthropic, Google, Mistral, Meta, and Cohere call site — streaming, embeddings, and notebooks included."
          />
          <Step
            n="02"
            title="Estimate"
            body="Each call's prompts are tokenized with the provider's actual tokenizer. No averages, no fudge factors — costs you can defend in a budget meeting."
          />
          <Step
            n="03"
            title="Recommend"
            body="For every call, we compare against alternative models with comparable quality and surface the swaps that move your monthly bill the most."
          />
        </div>
      </section>

      {/* Models — quiet table-like grid */}
      <section
        id="models"
        className="mx-auto max-w-6xl border-t border-border/60 px-6 py-16 md:py-24"
      >
        <div className="mb-10 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-medium tracking-tight md:text-3xl">
            Pricing the {modelCount > 0 ? modelCount : "60+"} most-used models
          </h2>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            03 — Catalog
          </span>
        </div>
        {models && models.length > 0 ? (
          <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
            {models.slice(0, 24).map((m) => {
              const meta = providerMeta(m.provider);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-card px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.colorVar }}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.display_name}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {m.provider}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    ${m.input_price_per_mtoken}
                    <span className="opacity-50"> / </span>
                    ${m.output_price_per_mtoken}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Pricing catalog loading…
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Per 1M tokens · input / output
        </p>
      </section>

      {/* CTA — calm */}
      <section className="mx-auto max-w-6xl border-t border-border/60 px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h3 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              Run a sample on{" "}
              <span className="font-mono text-primary">langchain</span>.
            </h3>
            <p className="mt-3 text-muted-foreground">
              No signup. The full pipeline on a real OSS LLM project, in about
              ten seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => submit("https://github.com/langchain-ai/langchain")}
            className="inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
          >
            Run sample analysis
            <ArrowUpRight className="size-4" />
          </button>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-border/60 px-6 py-8 text-xs text-muted-foreground">
        <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <div>tokenlens · cost modeling for LLM codebases</div>
          <div className="opacity-70">
            <a
              href="https://github.com/Sathv1kA/ai-cost-modeling-platform"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              Open source →
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="grid gap-4 py-7 md:grid-cols-12 md:gap-8 md:py-9">
      <div className="font-mono text-xs text-muted-foreground md:col-span-2">
        {n}
      </div>
      <div className="md:col-span-3">
        <div className="font-display text-xl font-medium">{title}</div>
      </div>
      <p className="text-muted-foreground md:col-span-7">{body}</p>
    </div>
  );
}
