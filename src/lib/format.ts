const CURRENCY_SYMBOLS: Record<string, string> = {
  YER: "ر.ي", SAR: "ر.س", USD: "$", AED: "د.إ", EUR: "€", EGP: "ج.م",
};
let DEFAULT_CURRENCY = "YER";
export function setDefaultCurrency(c: string) { if (c) DEFAULT_CURRENCY = c; }
export function getDefaultCurrency() { return DEFAULT_CURRENCY; }
export function currencySymbol(c?: string) { return CURRENCY_SYMBOLS[(c || DEFAULT_CURRENCY).toUpperCase()] ?? (c || DEFAULT_CURRENCY); }
export function formatCurrency(n: number | string | null | undefined, currency?: string) {
  const v = Number(n ?? 0);
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const num = new Intl.NumberFormat("ar", { maximumFractionDigits: 2 }).format(v);
  return `${num} ${CURRENCY_SYMBOLS[code] ?? code}`;
}

export function formatNumber(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(v);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDateShort(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short" }).format(date);
}