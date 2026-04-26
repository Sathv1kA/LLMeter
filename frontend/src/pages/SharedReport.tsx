import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Download, FileJson, FileText, FileType } from "lucide-react";
import type { CostReport } from "../types";
import { fetchSharedReport } from "../api/client";
import ReportView from "../components/ReportView";
import ShareButton from "../components/ShareButton";
import { SummarySkeleton, TableSkeleton, CallTableSkeleton } from "../components/Skeleton";
import { downloadJson, downloadMarkdown, downloadPdf } from "../utils/exporters";

type Phase = "loading" | "done" | "error";

export default function SharedReport() {
  const { id = "" } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [report, setReport] = useState<CostReport | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSharedReport(id)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setPhase("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(String(err.message ?? err));
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-3 text-primary" size={40} />
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Not found
          </div>
          <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-foreground">
            Can't load shared report
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
          <Link
            to="/"
            className="mt-5 inline-block text-sm text-primary hover:underline"
          >
            ← Run a new analysis
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "loading" || !report) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft size={18} />
              </Link>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Loading shared report…
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <SummarySkeleton />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TableSkeleton rows={6} />
              <TableSkeleton rows={6} />
            </div>
            <CallTableSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const repoName = report.repo_url.replace("https://github.com/", "");

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Shared report
              </div>
              <h1 className="mt-1 truncate font-mono text-lg font-medium text-foreground">
                {repoName}
              </h1>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                {report.files_scanned} files · {report.total_call_sites} call sites
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton reportId={id} />
            {report.total_call_sites > 0 && (
              <div className="relative">
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setExportOpen(false), 150)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-card/60"
                >
                  <Download size={14} />
                  Export
                </button>
                {exportOpen && (
                  <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-border bg-card shadow-xl">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        downloadPdf(report, repoName);
                        setExportOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background/60"
                    >
                      <FileType size={14} />
                      Save as PDF
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        downloadMarkdown(report, repoName);
                        setExportOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background/60"
                    >
                      <FileText size={14} />
                      Download Markdown
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        downloadJson(report, repoName);
                        setExportOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background/60"
                    >
                      <FileJson size={14} />
                      Download JSON
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <ReportView report={report} />
      </div>
    </div>
  );
}
