export const money = (cents: number | null | undefined, opts: { cents?: boolean } = {}) => {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: opts.cents === false ? 0 : 2, maximumFractionDigits: opts.cents === false ? 0 : 2 });
};
export const moneyShort = (cents: number) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v / 1e3).toFixed(1)}k`;
  return money(cents, { cents: false });
};
export const toCents = (dollars: string | number) => Math.round(Number(dollars || 0) * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};
export const timeAgo = (d: string | Date) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(new Date(d));
};
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
