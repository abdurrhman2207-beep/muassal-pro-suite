export function formatCurrency(n: number | string | null | undefined, currency = "SAR") {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
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