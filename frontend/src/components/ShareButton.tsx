import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface Props {
  reportId: string;
}

export default function ShareButton({ reportId }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/r/${reportId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this URL:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-card/60"
      aria-label="Copy shareable link"
      title="Copy shareable link"
    >
      {copied ? <Check size={14} className="text-primary" /> : <Share2 size={14} />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
