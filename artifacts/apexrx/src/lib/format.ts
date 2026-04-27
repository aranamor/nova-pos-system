export const formatINR = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v || 0);
};

export const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-IN").format(n);

export const formatDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

export const formatDateTime = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
};
