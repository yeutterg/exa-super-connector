// Shared display formatters — one definition so cost and time render
// identically everywhere (cost meter, call history, sidebar, cards).

export const fmtUSD = (n: number) => `$${n.toFixed(3)}`;

export function relativeTime(ts: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}
