export function formatName(name: string): string {
  return name
    .replace(/([a-z])(and)([A-Z])/g, "$1 $2 $3")
    .replace(/([A-Z])(and)([A-Z])/g, "$1 $2 $3")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function normalizeLiteracy(val: number | string | undefined): number | undefined {
  if (val == null) return undefined;
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return undefined;
  return n < 1 ? n * 100 : n;
}

export function formatLiteracyDisplay(val: string | number | undefined): string {
  if (val == null) return "---";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "---";
  return (n < 1 ? (n * 100).toFixed(1) : n.toFixed(1)) + "%";
}

export function formatNumber(val: string | number | undefined | null): string {
  if (val == null) return "---";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "---";
  if (n >= 10000000) return (n / 10000000).toFixed(1) + " Cr";
  if (n >= 100000) return (n / 100000).toFixed(1) + " L";
  if (n >= 1000) return (n / 1000).toFixed(1) + " K";
  return n.toLocaleString();
}

export function formatArea(val: string | number | undefined | null): string {
  if (val == null) return "---";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "---";
  return n.toLocaleString() + " km²";
}
