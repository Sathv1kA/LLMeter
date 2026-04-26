/**
 * Recently-scanned repos, persisted to localStorage so they survive reloads
 * and tab restores. Capped at 5 — old entries fall off the tail. Dedupes by
 * canonical URL so submitting the same repo twice doesn't fill the list.
 *
 * Stored as JSON: { url: string, at: number }[]   (at = epoch ms)
 *
 * All functions are SSR-safe — they noop if `window` / `localStorage` is
 * unavailable or throws (private mode, full storage, disabled cookies, etc.)
 * so we never crash the page over a non-essential UX feature.
 */

const KEY = "tokenlens.recent-scans.v1";
const MAX = 5;

export interface RecentScan {
  url: string;
  at: number;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getRecentScans(): RecentScan[] {
  const ls = safeStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: drop malformed entries rather than blowing up the page.
    return parsed
      .filter(
        (e): e is RecentScan =>
          e &&
          typeof e === "object" &&
          typeof e.url === "string" &&
          typeof e.at === "number",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentScan(url: string): RecentScan[] {
  const ls = safeStorage();
  const now = Date.now();
  const cleaned = url.trim();
  if (!cleaned) return getRecentScans();
  const current = getRecentScans().filter((e) => e.url !== cleaned);
  const next = [{ url: cleaned, at: now }, ...current].slice(0, MAX);
  if (ls) {
    try {
      ls.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — silent */
    }
  }
  return next;
}

export function removeRecentScan(url: string): RecentScan[] {
  const ls = safeStorage();
  const next = getRecentScans().filter((e) => e.url !== url);
  if (ls) {
    try {
      ls.setItem(KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }
  return next;
}

export function clearRecentScans(): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * "owner/repo" for display, given a full https://github.com/owner/repo URL.
 * Falls back to the raw string for anything that doesn't match.
 */
export function shortRepoLabel(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "");
}
