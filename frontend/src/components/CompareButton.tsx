import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Columns2 } from "lucide-react";

/**
 * "Compare with…" button. Prompts for a second report's share link or ID,
 * then navigates to /compare?a=<currentId>&b=<otherId>.
 *
 * Accepts:
 *   - Bare 8-char ID:                 abcdEFGH12
 *   - Full /r/<id> path:              /r/abcdEFGH12
 *   - Full URL:                       https://tokenlens.app/r/abcdEFGH12
 *
 * If the user submits something we can't parse, we surface a small inline
 * error rather than navigating to a dead /compare?b=<garbage> URL.
 */
export default function CompareButton({ reportId }: { reportId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function parseId(raw: string): string | null {
    const t = raw.trim();
    if (!t) return null;
    // Match the same shape the backend cache emits (token_urlsafe(6) → 8 chars,
    // tolerated up to 24).
    const direct = t.match(/^[A-Za-z0-9_-]{6,24}$/);
    if (direct) return t;
    const fromPath = t.match(/\/r\/([A-Za-z0-9_-]{6,24})/);
    if (fromPath) return fromPath[1];
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const other = parseId(val);
    if (!other) {
      setErr("Paste a share link (e.g. /r/abc123) or just the ID.");
      return;
    }
    if (other === reportId) {
      setErr("That's the same report — pick a different one.");
      return;
    }
    navigate(`/compare?a=${reportId}&b=${other}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Columns2 className="size-3.5" />
        Compare
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-border bg-popover p-3 shadow-lg"
        >
          <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Compare with
          </div>
          <input
            type="text"
            autoFocus
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              setErr(null);
            }}
            placeholder="paste share link or report id"
            aria-label="Share link or report ID to compare against"
            className="w-full rounded-sm border border-border bg-background/60 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary/50"
          />
          {err && (
            <div className="mt-1.5 text-[11px] text-destructive">{err}</div>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setVal("");
                setErr(null);
              }}
              className="rounded-sm px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-sm bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
