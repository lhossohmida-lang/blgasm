import type { ProductSaleUnit } from "@/types";

export function formatCurrency(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat("ar-DZ", {
    maximumFractionDigits: normalized % 1 === 0 ? 0 : 2,
  }).format(normalized)} دج`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-DZ").format(Number.isFinite(value) ? value : 0);
}

export function unitLabel(unit?: ProductSaleUnit) {
  return unit === "gram" ? "غ" : "حبة";
}

export function unitPriceLabel(unit?: ProductSaleUnit) {
  return unit === "gram" ? "للكيلوغرام" : "للحبة";
}

export function formatQuantity(value: number, unit?: ProductSaleUnit) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${formatNumber(unit === "piece" || !unit ? Math.round(normalized) : normalized)} ${unitLabel(unit)}`;
}

export function formatStockQuantity(value: number, unit?: ProductSaleUnit) {
  const normalized = Number.isFinite(value) ? value : 0;
  if (unit === "gram") {
    return `${formatNumber(normalized / 1000)} كغ`;
  }

  return formatQuantity(normalized, unit);
}

export function formatPercent(value: number) {
  return `${formatNumber(Math.round(value * 10) / 10)}%`;
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("ar-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatShortDate(value: string | Date) {
  return new Intl.DateTimeFormat("ar-DZ", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function makeReceiptNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
  return `BL-${stamp}-${random}`;
}
