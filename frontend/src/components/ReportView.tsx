import { useState } from "react";
import { Link } from "react-router-dom";
import type { CostReport } from "../types";
import SummaryCard from "./SummaryCard";
import CostTable from "./CostTable";
import CostProjection from "./CostProjection";
import CallBreakdown from "./CallBreakdown";
import Recommendations from "./Recommendations";
import FileBreakdowns from "./FileBreakdowns";

interface Props {
  report: CostReport;
  initialCallsPerDay?: number;
}

export default function ReportView({ report, initialCallsPerDay = 1000 }: Props) {
  const [projCallsPerDay, setProjCallsPerDay] = useState(initialCallsPerDay);

  if (report.total_call_sites === 0) {
    return (
      <div className="space-y-6">
        <SummaryCard report={report} />
        <div className="rounded-md border border-border bg-card/40 p-10 text-center">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            No matches
          </div>
          <h3 className="mt-3 font-display text-2xl font-medium tracking-tight text-foreground">
            No LLM calls detected
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            We scanned {report.files_scanned.toLocaleString()} files but didn&apos;t find any calls
            matching the patterns for OpenAI, Anthropic, LangChain, LlamaIndex, Cohere, or Gemini.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            This repo may not use LLMs, or may use a custom wrapper we don&apos;t detect yet.
          </p>
          <Link
            to="/"
            className="mt-5 inline-block text-sm text-primary hover:underline"
          >
            ← Try another repo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryCard report={report} />

      {report.recommendations.length > 0 && (
        <Recommendations report={report} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostTable
          summaries={report.per_model_summaries}
          actualTotalCostUsd={report.actual_total_cost_usd}
        />
        <CostProjection
          summaries={report.per_model_summaries}
          callSites={report.total_call_sites}
          initialCallsPerDay={projCallsPerDay}
          onCallsPerDayChange={setProjCallsPerDay}
        />
      </div>

      {report.file_breakdowns.length > 0 && (
        <FileBreakdowns report={report} />
      )}

      <CallBreakdown calls={report.calls} summaries={report.per_model_summaries} />
    </div>
  );
}
