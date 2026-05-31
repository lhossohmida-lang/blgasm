import type { AiContextSnapshot, AppData } from "@/types";
import { computeDashboardStats } from "@/utils/calculations";

export function buildAiContext(data: AppData): AiContextSnapshot {
  const stats = computeDashboardStats(data.products, data.sales, data.creditCustomers);

  return {
    generatedAt: new Date().toISOString(),
    currency: data.store.currency,
    stats,
    lowStockProducts: data.products
      .filter((product) => product.quantity <= product.lowStockAlert)
      .slice(0, 12)
      .map(({ name, quantity, lowStockAlert }) => ({ name, quantity, lowStockAlert })),
    weakProfitProducts: data.products
      .sort((a, b) => a.profitPercent - b.profitPercent)
      .slice(0, 10)
      .map(({ name, profitPercent, profitPerUnit }) => ({ name, profitPercent, profitPerUnit })),
    biggestDebtors: data.creditCustomers
      .sort((a, b) => b.remainingDebt - a.remainingDebt)
      .slice(0, 10)
      .map(({ name, remainingDebt }) => ({ name, remainingDebt })),
    recentSales: data.sales
      .slice(0, 10)
      .map(({ type, totalAmount, totalProfit, createdAt }) => ({ type, totalAmount, totalProfit, createdAt })),
  };
}
