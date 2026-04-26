export function fmtCost(n: number): string {
  return n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`;
}

export function fmtTokens(n: number): string {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(n);
}

export function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function pctChange(now: number, prev: number): { pct: number; up: boolean } {
  if (prev === 0) return { pct: 0, up: true };
  const pct = ((now - prev) / prev) * 100;
  return { pct: Math.abs(pct), up: pct >= 0 };
}
