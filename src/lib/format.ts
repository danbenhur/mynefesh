export function formatData(mb: number | null): string {
  if (mb === null) return "ללא הגבלה";
  return mb >= 1024 ? `${Math.round(mb / 1024)}GB` : `${mb}MB`;
}

export function formatPrice(ils: string | number): string {
  return `₪${Number(ils).toFixed(2).replace(/\.00$/, "")}`;
}
