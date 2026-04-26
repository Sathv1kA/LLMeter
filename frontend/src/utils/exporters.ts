import type { CostReport } from "../types";

/**
 * Open a print-styled HTML report in a new window and trigger the browser's
 * native "Save as PDF" dialog. Zero-dependency and produces crisp typography
 * because it's just CSS print rules. The layout is intentionally fixed and
 * deterministic so two reports for different repos can be compared
 * side-by-side: same column order, same row order, same units, same fonts.
 */
export function downloadPdf(report: CostReport, repoName: string) {
  const html = buildPdfHtml(report, repoName);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked — fall back to a Blob download so the user gets something.
    const blob = new Blob([html], { type: "text/html" });
    triggerDownload(blob, `${slug(repoName)}-cost-report.html`);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Wait for fonts/layout to settle, then invoke print. Some browsers race.
  const fire = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* noop — user can still print manually */
    }
  };
  if (win.document.readyState === "complete") {
    setTimeout(fire, 250);
  } else {
    win.addEventListener("load", () => setTimeout(fire, 250));
  }
}

export function downloadJson(report: CostReport, repoName: string) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${slug(repoName)}-cost-report.json`);
}

export function downloadMarkdown(report: CostReport, repoName: string) {
  const md = buildMarkdown(report, repoName);
  const blob = new Blob([md], { type: "text/markdown" });
  triggerDownload(blob, `${slug(repoName)}-cost-report.md`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function slug(s: string) {
  return s
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function fmtCost(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === 0) return "$0.00";
  if (n < 0.000001) return "<$0.000001";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function buildMarkdown(report: CostReport, repoName: string): string {
  const generated = new Date(report.generated_at).toLocaleString();
  const savingsRatio =
    report.actual_total_cost_usd != null &&
    report.total_potential_savings_usd != null &&
    report.actual_total_cost_usd > 0
      ? (report.total_potential_savings_usd / report.actual_total_cost_usd) * 100
      : null;

  const lines: string[] = [];

  lines.push(`# LLM Cost Report: ${repoName}`, "");
  lines.push(`> Generated ${generated} by **TokenLens**`, "");
  lines.push(`**Repository:** ${report.repo_url}`, "");

  lines.push("## Summary", "");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push(`| Files scanned | ${report.files_scanned.toLocaleString()} |`);
  lines.push(`| Files with LLM calls | ${report.files_with_calls.toLocaleString()} |`);
  lines.push(`| LLM call sites | ${report.total_call_sites.toLocaleString()} |`);
  lines.push(
    `| Call sites resolved to known models | ${report.resolved_call_count} / ${report.total_call_sites} |`,
  );
  lines.push(
    `| Cost at declared models | ${fmtCost(report.actual_total_cost_usd)} |`,
  );
  lines.push(
    `| Cost after recommended swaps | ${fmtCost(report.recommended_total_cost_usd)} |`,
  );
  lines.push(
    `| **Potential savings** | **${fmtCost(report.total_potential_savings_usd)}${savingsRatio != null ? ` (${savingsRatio.toFixed(0)}%)` : ""}** |`,
  );
  lines.push(`| Detected SDKs | ${report.detected_sdks.join(", ") || "—"} |`);
  lines.push("");

  if (report.per_model_summaries.length > 0) {
    lines.push("## Cost Comparison Across Models", "");
    lines.push("Total cost if every detected call were routed to each model:", "");
    lines.push("| Model | Provider | Tier | Input $/MTok | Output $/MTok | Total Cost |");
    lines.push("|---|---|---|---|---|---|");
    for (const s of report.per_model_summaries) {
      lines.push(
        `| ${s.display_name} | ${s.provider} | ${s.quality_tier} | $${s.input_price_per_mtoken.toFixed(3)} | $${s.output_price_per_mtoken.toFixed(3)} | ${fmtCost(s.total_cost_usd)} |`,
      );
    }
    lines.push("");
  }

  if (report.recommendations.length > 0) {
    lines.push("## Recommended Swaps", "");
    lines.push("| Current | → | Recommended | Current Cost | Recommended Cost | Savings |");
    lines.push("|---|---|---|---|---|---|");
    const sorted = [...report.recommendations].sort((a, b) => b.savings_usd - a.savings_usd);
    for (const r of sorted) {
      lines.push(
        `| \`${r.current_model_id ?? "unknown"}\` | → | \`${r.recommended_display_name}\` | ${fmtCost(r.current_cost_usd)} | ${fmtCost(r.recommended_cost_usd)} | **${fmtCost(r.savings_usd)}** |`,
      );
    }
    lines.push("");
  }

  if (report.file_breakdowns.length > 0) {
    lines.push("## Files with LLM Calls", "");
    lines.push("| File | Calls | Tokens (in / out) | SDKs | Cost (declared) |");
    lines.push("|---|---|---|---|---|");
    for (const fb of report.file_breakdowns) {
      lines.push(
        `| \`${fb.file_path}\` | ${fb.call_count} | ${fmtTokens(fb.total_input_tokens)} / ${fmtTokens(fb.total_output_tokens)} | ${fb.sdks.join(", ")} | ${fb.actual_cost_usd > 0 ? fmtCost(fb.actual_cost_usd) : "—"} |`,
      );
    }
    lines.push("");
  }

  if (report.calls.length > 0) {
    lines.push("## Detected Calls", "");
    lines.push("| File:Line | SDK | Task | Model in Code | Resolved | Tokens (in / out) | Cost |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const c of report.calls) {
      lines.push(
        `| \`${c.file_path}:${c.line_number}\` | ${c.sdk} | ${c.task_type} | ${c.model_hint ? `\`${c.model_hint}\`` : "—"} | ${c.resolved_model_id ? `\`${c.resolved_model_id}\`` : "—"} | ${fmtTokens(c.estimated_input_tokens)} / ${fmtTokens(c.estimated_output_tokens)} | ${fmtCost(c.actual_cost_usd)} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Token counts estimated using OpenAI's tiktoken library. Pricing from public API rate sheets — verify before making decisions.*");

  return lines.join("\n");
}

/* --------------------------------------------------------------------------
 * PDF (print-styled HTML) builder
 * --------------------------------------------------------------------------
 * Design goals:
 *   - Deterministic layout: every report uses the same column order,
 *     same row order, same units. Place two PDFs side-by-side and the
 *     numbers line up visually.
 *   - Hero block on page 1 carries the four numbers a reader cares about
 *     (call sites, current spend, post-swap spend, savings).
 *   - Tables right-align numerics with tabular-nums so columns align.
 *   - Pure CSS, no external resources, so it renders even offline. */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(0)}%`;
}

function buildPdfHtml(report: CostReport, repoName: string): string {
  const generated = new Date(report.generated_at).toLocaleString();
  const savingsRatio =
    report.actual_total_cost_usd != null &&
    report.total_potential_savings_usd != null &&
    report.actual_total_cost_usd > 0
      ? (report.total_potential_savings_usd / report.actual_total_cost_usd) * 100
      : null;

  const summaries = [...report.per_model_summaries].sort(
    (a, b) => a.total_cost_usd - b.total_cost_usd,
  );
  const cheapest = summaries[0];
  const recs = [...report.recommendations].sort(
    (a, b) => b.savings_usd - a.savings_usd,
  );
  const topFiles = [...report.file_breakdowns]
    .sort((a, b) => b.actual_cost_usd - a.actual_cost_usd)
    .slice(0, 15);

  const sdkChips = report.detected_sdks
    .map((s) => `<span class="chip">${escapeHtml(s)}</span>`)
    .join(" ");

  const styles = `
    @page { size: Letter; margin: 0.6in 0.55in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }
    .page { padding: 0; }
    h1, h2, h3 { font-weight: 600; letter-spacing: -0.01em; margin: 0; }
    h1 { font-size: 24pt; line-height: 1.05; }
    h2 { font-size: 13pt; margin: 22pt 0 8pt; padding-bottom: 4pt; border-bottom: 1px solid #e5e7eb; }
    h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
    .muted { color: #6b7280; }
    .mono, code, td.num, th.num { font-family: "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
    .num { text-align: right; white-space: nowrap; }

    /* Cover header */
    .cover { display: grid; grid-template-columns: 1fr auto; gap: 16pt; align-items: end; margin-bottom: 18pt; padding-bottom: 14pt; border-bottom: 2px solid #111827; }
    .brand { font-size: 10pt; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; }
    .repo { margin-top: 4pt; word-break: break-all; }
    .cover .meta { text-align: right; font-size: 9pt; color: #6b7280; }
    .cover .meta .stamp { font-family: "SFMono-Regular", Menlo, Consolas, monospace; }

    /* Hero metrics — 4 cells, deterministic order. */
    .hero { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10pt; margin-bottom: 10pt; }
    .hero .cell { padding: 12pt 12pt; border: 1px solid #e5e7eb; border-radius: 4pt; }
    .hero .label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4pt; }
    .hero .val { font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 18pt; font-weight: 600; letter-spacing: -0.02em; }
    .hero .val.green { color: #047857; }
    .hero .sub { font-size: 8.5pt; color: #6b7280; margin-top: 2pt; }

    .chip { display: inline-block; padding: 1pt 7pt; border: 1px solid #d1d5db; border-radius: 999px; font-size: 8.5pt; color: #374151; margin-right: 4pt; background: #f9fafb; }
    .meta-row { display: flex; gap: 18pt; flex-wrap: wrap; font-size: 9pt; color: #4b5563; margin: 8pt 0 4pt; }
    .meta-row b { color: #111827; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    th { text-align: left; font-weight: 600; color: #4b5563; border-bottom: 1px solid #d1d5db; padding: 6pt 8pt; font-size: 9pt; }
    th.num { text-align: right; }
    td { padding: 5pt 8pt; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr.cheapest td { background: #f0fdf4; }
    tr.cheapest td:first-child { box-shadow: inset 2pt 0 0 #047857; }
    .pill { display: inline-block; padding: 0 6pt; border-radius: 3pt; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; background: #f3f4f6; }
    .pill.budget { background: #ecfdf5; color: #047857; }
    .pill.mid { background: #eff6ff; color: #1d4ed8; }
    .pill.premium { background: #fef3c7; color: #92400e; }

    .footer { margin-top: 24pt; padding-top: 8pt; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #6b7280; }

    /* Page-break hints — keep section heading with its first row of table. */
    h2 { break-after: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
    thead { display: table-header-group; }

    @media print {
      .no-print { display: none; }
    }
    .toolbar { position: sticky; top: 0; background: #ffffff; padding: 10pt 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 14pt; display: flex; gap: 8pt; align-items: center; }
    .toolbar button { font-family: inherit; font-size: 9pt; padding: 6pt 12pt; border: 1px solid #111827; background: #111827; color: #ffffff; border-radius: 3pt; cursor: pointer; }
    .toolbar .hint { font-size: 9pt; color: #6b7280; }
  `;

  const heroCurrent = report.actual_total_cost_usd != null
    ? fmtCost(report.actual_total_cost_usd)
    : "—";
  const heroSwapped = report.recommended_total_cost_usd != null
    ? fmtCost(report.recommended_total_cost_usd)
    : "—";
  const heroSavings = report.total_potential_savings_usd != null
    ? fmtCost(report.total_potential_savings_usd)
    : "—";

  const summaryRows = summaries
    .map((s) => {
      const isCheapest = cheapest && s.model_id === cheapest.model_id;
      return `<tr class="${isCheapest ? "cheapest" : ""}">
        <td>${escapeHtml(s.display_name)}</td>
        <td class="muted">${escapeHtml(s.provider)}</td>
        <td><span class="pill ${escapeHtml(s.quality_tier)}">${escapeHtml(s.quality_tier)}</span></td>
        <td class="num">$${s.input_price_per_mtoken.toFixed(3)}</td>
        <td class="num">$${s.output_price_per_mtoken.toFixed(3)}</td>
        <td class="num"><b>${fmtCost(s.total_cost_usd)}</b></td>
      </tr>`;
    })
    .join("");

  const recRows = recs
    .slice(0, 25)
    .map(
      (r) => `<tr>
        <td><code>${escapeHtml(r.current_model_id ?? "unknown")}</code></td>
        <td class="muted">→</td>
        <td>${escapeHtml(r.recommended_display_name)}</td>
        <td class="num">${fmtCost(r.current_cost_usd)}</td>
        <td class="num">${fmtCost(r.recommended_cost_usd)}</td>
        <td class="num"><b>${fmtCost(r.savings_usd)}</b></td>
      </tr>`,
    )
    .join("");

  const fileRows = topFiles
    .map(
      (f) => `<tr>
        <td><code>${escapeHtml(f.file_path)}</code></td>
        <td class="num">${f.call_count}</td>
        <td class="num">${fmtTokens(f.total_input_tokens)}</td>
        <td class="num">${fmtTokens(f.total_output_tokens)}</td>
        <td class="muted">${escapeHtml(f.sdks.join(", "))}</td>
        <td class="num">${f.actual_cost_usd > 0 ? fmtCost(f.actual_cost_usd) : "—"}</td>
      </tr>`,
    )
    .join("");

  const recCount = report.recommendations.length;
  const resolvedFrac = `${report.resolved_call_count} / ${report.total_call_sites}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>TokenLens — ${escapeHtml(repoName)}</title>
<style>${styles}</style>
</head>
<body>
<div class="toolbar no-print">
  <button onclick="window.print()">Save as PDF</button>
  <span class="hint">Use your browser's print dialog → Destination: <b>Save as PDF</b>.</span>
</div>
<div class="page">

  <header class="cover">
    <div>
      <div class="brand">TokenLens · LLM cost report</div>
      <h1 class="repo">${escapeHtml(repoName)}</h1>
      <div class="meta-row">
        <span><b>${report.files_scanned.toLocaleString()}</b> files scanned</span>
        <span><b>${report.files_with_calls.toLocaleString()}</b> with LLM calls</span>
        <span><b>${report.total_call_sites.toLocaleString()}</b> call sites</span>
        <span><b>${resolvedFrac}</b> resolved to known models</span>
      </div>
      <div class="meta-row" style="margin-top:4pt;">${sdkChips || '<span class="muted">No SDKs detected</span>'}</div>
    </div>
    <div class="meta">
      <div>Generated</div>
      <div class="stamp">${escapeHtml(generated)}</div>
      <div style="margin-top:6pt;">${escapeHtml(report.repo_url)}</div>
    </div>
  </header>

  <section class="hero">
    <div class="cell">
      <div class="label">Call sites</div>
      <div class="val">${report.total_call_sites.toLocaleString()}</div>
      <div class="sub">across ${report.detected_sdks.length} SDK${report.detected_sdks.length === 1 ? "" : "s"}</div>
    </div>
    <div class="cell">
      <div class="label">Cost @ declared models</div>
      <div class="val">${heroCurrent}</div>
      <div class="sub">single-execution baseline</div>
    </div>
    <div class="cell">
      <div class="label">Cost after swaps</div>
      <div class="val">${heroSwapped}</div>
      <div class="sub">${recCount} recommendation${recCount === 1 ? "" : "s"} applied</div>
    </div>
    <div class="cell">
      <div class="label">Potential savings</div>
      <div class="val green">${heroSavings}</div>
      <div class="sub">${savingsRatio != null ? fmtPct(savingsRatio) + " of current spend" : "no resolved models"}</div>
    </div>
  </section>

  ${
    summaries.length > 0
      ? `<h2>Cost across all models</h2>
  <p class="muted" style="margin: 0 0 8pt; font-size:9pt;">Total cost if every detected call were routed through each model. Sorted cheapest first.</p>
  <table>
    <thead>
      <tr>
        <th>Model</th>
        <th>Provider</th>
        <th>Tier</th>
        <th class="num">Input $/MTok</th>
        <th class="num">Output $/MTok</th>
        <th class="num">Total cost</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
  </table>`
      : ""
  }

  ${
    recs.length > 0
      ? `<h2>Recommended swaps</h2>
  <p class="muted" style="margin: 0 0 8pt; font-size:9pt;">Per-call-shape suggestions, ranked by absolute savings. ${recs.length > 25 ? `Showing top 25 of ${recs.length}.` : ""}</p>
  <table>
    <thead>
      <tr>
        <th>Current</th>
        <th></th>
        <th>Recommended</th>
        <th class="num">Current</th>
        <th class="num">Recommended</th>
        <th class="num">Savings</th>
      </tr>
    </thead>
    <tbody>${recRows}</tbody>
  </table>`
      : ""
  }

  ${
    topFiles.length > 0
      ? `<h2>Hottest files</h2>
  <p class="muted" style="margin: 0 0 8pt; font-size:9pt;">Top ${topFiles.length} files by current cost.</p>
  <table>
    <thead>
      <tr>
        <th>File</th>
        <th class="num">Calls</th>
        <th class="num">In tokens</th>
        <th class="num">Out tokens</th>
        <th>SDKs</th>
        <th class="num">Cost</th>
      </tr>
    </thead>
    <tbody>${fileRows}</tbody>
  </table>`
      : ""
  }

  <div class="footer">
    Token counts estimated with OpenAI's tiktoken (cl100k_base / o200k_base).
    Pricing reflects publicly listed API rates at report generation time —
    verify against provider pricing pages before making infrastructure decisions.
  </div>
</div>
</body>
</html>`;
}
