import type {
  CreditCustomer,
  DashboardStats,
  Product,
  ProductDraft,
  ProductSaleUnit,
  ProductSaleMode,
  Sale,
  SaleItem,
} from "@/types";
import { endOfDay, startOfDay, startOfMonth, startOfWeek, startOfYear } from "@/utils/dates";

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateProductPricing(input: {
  wholesalePrice: number;
  unitsPerWholesale: number;
  saleMode?: ProductSaleMode;
  saleUnit?: ProductSaleUnit;
  unitCost?: number;
  sellPrice: number;
  quantity?: number;
}) {
  const units = Math.max(1, Number(input.unitsPerWholesale) || 1);
  const wholesalePrice = Number(input.wholesalePrice) || 0;
  const sellPrice = Number(input.sellPrice) || 0;
  const quantity = Math.max(0, Number(input.quantity) || 0);
  const isWeight = input.saleMode === "weight" || input.saleUnit === "gram";
  const unitCost = Number.isFinite(input.unitCost) ? roundMoney(Number(input.unitCost)) : roundMoney(wholesalePrice / units);
  const unitSellPrice = isWeight ? sellPrice / units : sellPrice;
  const profitPerUnit = roundMoney(unitSellPrice - unitCost);
  const profitPercent = unitCost > 0 ? roundMoney((profitPerUnit / unitCost) * 100) : 0;
  const expectedStockProfit = roundMoney(profitPerUnit * quantity);

  return { unitCost, profitPerUnit, profitPercent, expectedStockProfit };
}

function resolveSaleMode(draft: ProductDraft, existing?: Product): ProductSaleMode {
  if (draft.saleMode) return draft.saleMode;
  if (existing?.saleMode) return existing.saleMode;
  if ((draft.saleUnit ?? existing?.saleUnit) === "gram") return "weight";
  if ((draft.unitsPerWholesale ?? existing?.unitsPerWholesale ?? 1) > 1) return "carton";
  return "unit";
}

function normalizeSaleQuantity(quantity: number, unit?: ProductSaleUnit) {
  const safe = Math.max(0, Number(quantity) || 0);
  return unit === "gram" ? roundMoney(safe) : Math.max(0, Math.floor(safe));
}

export function productFromDraft(draft: ProductDraft, existing?: Product): Product {
  const now = new Date().toISOString();
  const saleMode = resolveSaleMode(draft, existing);
  const unitsPerWholesale =
    saleMode === "unit" ? 1 : saleMode === "weight" ? 1000 : Math.max(1, Number(draft.unitsPerWholesale) || 1);
  const saleUnit: ProductSaleUnit = saleMode === "weight" ? "gram" : "piece";
  const pricing = calculateProductPricing({
    wholesalePrice: draft.wholesalePrice,
    unitsPerWholesale,
    saleMode,
    saleUnit,
    unitCost: draft.unitCost,
    sellPrice: draft.sellPrice,
    quantity: draft.quantity,
  });

  return {
    id: draft.id ?? existing?.id ?? crypto.randomUUID(),
    qrCode: draft.qrCode.trim(),
    name: draft.name.trim(),
    category: draft.category.trim() || "مواد غذائية",
    wholesalePrice: Number(draft.wholesalePrice) || 0,
    unitsPerWholesale,
    saleMode,
    purchaseUnit: saleMode === "weight" ? "kilogram" : saleMode === "carton" ? "carton" : "piece",
    saleUnit,
    sellPrice: Number(draft.sellPrice) || 0,
    quantity: Math.max(0, Number(draft.quantity) || 0),
    lowStockAlert: Math.max(0, Number(draft.lowStockAlert) || 0),
    imageUrl: draft.imageUrl?.trim() || undefined,
    expiryDate: draft.expiryDate?.trim() || existing?.expiryDate || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...pricing,
  };
}


export function buildSaleItem(product: Product, quantity = 1): SaleItem {
  const safeQuantity = normalizeSaleQuantity(quantity, product.saleUnit);
  const unitPrice = product.saleUnit === "gram" ? roundMoney(product.sellPrice / product.unitsPerWholesale) : product.sellPrice;
  return {
    productId: product.id,
    qrCode: product.qrCode,
    name: product.name,
    saleUnit: product.saleUnit ?? "piece",
    quantity: safeQuantity,
    unitPrice,
    unitCost: product.unitCost,
    total: roundMoney(unitPrice * safeQuantity),
    profit: roundMoney(product.profitPerUnit * safeQuantity),
  };
}

export function recalculateSaleItems(items: SaleItem[]) {
  return items.map((item) => {
    const quantity = normalizeSaleQuantity(item.quantity, item.saleUnit);
    return {
      ...item,
      quantity,
      total: roundMoney(item.unitPrice * quantity),
      profit: roundMoney((item.unitPrice - item.unitCost) * quantity),
    };
  });
}

export function calculateSaleTotals(items: SaleItem[]) {
  const normalized = recalculateSaleItems(items);
  const totalAmount = roundMoney(normalized.reduce((sum, item) => sum + item.total, 0));
  const totalCost = roundMoney(
    normalized.reduce((sum, item) => sum + item.unitCost * item.quantity, 0),
  );
  const totalProfit = roundMoney(normalized.reduce((sum, item) => sum + item.profit, 0));

  return { items: normalized, totalAmount, totalCost, totalProfit };
}

export function applySaleToInventory(products: Product[], saleItems: SaleItem[]) {
  return products.map((product) => {
    const sold = saleItems
      .filter((item) => item.productId === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (!sold) {
      return product;
    }

    const quantity = Math.max(0, product.quantity - sold);
    return {
      ...product,
      quantity,
      expectedStockProfit: roundMoney(product.profitPerUnit * quantity),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function updateCreditTotals(customers: CreditCustomer[], customerId: string, deltaDebt: number, deltaPaid = 0) {
  const now = new Date().toISOString();
  return customers.map((customer) => {
    if (customer.id !== customerId) {
      return customer;
    }

    const totalDebt = roundMoney(customer.totalDebt + deltaDebt);
    const totalPaid = roundMoney(customer.totalPaid + deltaPaid);
    return {
      ...customer,
      totalDebt,
      totalPaid,
      remainingDebt: roundMoney(totalDebt - totalPaid),
      lastActivityAt: now,
      updatedAt: now,
    };
  });
}

export function computeDashboardStats(
  products: Product[],
  sales: Sale[],
  creditCustomers: CreditCustomer[],
  now = new Date(),
): DashboardStats {
  const startToday = startOfDay(now);
  const endToday = endOfDay(now);
  const startWeek = startOfWeek(now);
  const startMonth = startOfMonth(now);
  const startYear = startOfYear(now);

  const inRange = (sale: Sale, start: Date, end = now) => {
    const createdAt = new Date(sale.createdAt);
    return createdAt >= start && createdAt <= end;
  };

  const sumSales = (rangeSales: Sale[]) => ({
    sales: roundMoney(rangeSales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
    profit: roundMoney(rangeSales.reduce((sum, sale) => sum + sale.totalProfit, 0)),
  });

  const today = sumSales(sales.filter((sale) => inRange(sale, startToday, endToday)));
  const week = sumSales(sales.filter((sale) => inRange(sale, startWeek)));
  const month = sumSales(sales.filter((sale) => inRange(sale, startMonth)));
  const year = sumSales(sales.filter((sale) => inRange(sale, startYear)));

  const soldByProduct = new Map<string, { name: string; quantity: number; total: number }>();
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const current = soldByProduct.get(item.productId) ?? { name: item.name, quantity: 0, total: 0 };
      soldByProduct.set(item.productId, {
        name: item.name,
        quantity: current.quantity + item.quantity,
        total: roundMoney(current.total + item.total),
      });
    });
  });

  const topProducts = [...soldByProduct.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const sortedByProfit = [...products].sort((a, b) => b.profitPercent - a.profitPercent);
  const highProfitProducts = sortedByProfit.filter((product) => product.profitPercent >= 25).slice(0, 5);
  const weakProfitProducts = [...products]
    .filter((product) => product.quantity > 0)
    .sort((a, b) => a.profitPercent - b.profitPercent)
    .slice(0, 5);

  return {
    todaySales: today.sales,
    todayProfit: today.profit,
    weekSales: week.sales,
    weekProfit: week.profit,
    monthSales: month.sales,
    monthProfit: month.profit,
    yearSales: year.sales,
    yearProfit: year.profit,
    cashCollected: roundMoney(
      sales.reduce((sum, sale) => sum + (sale.type === "cash" ? sale.paidAmount : 0), 0),
    ),
    creditUncollected: roundMoney(sales.reduce((sum, sale) => sum + sale.remainingAmount, 0)),
    totalDebt: roundMoney(creditCustomers.reduce((sum, customer) => sum + customer.remainingDebt, 0)),
    productCount: products.length,
    lowStockCount: products.filter((product) => product.quantity > 0 && product.quantity <= product.lowStockAlert)
      .length,
    outOfStockCount: products.filter((product) => product.quantity <= 0).length,
    topProducts,
    highProfitProducts,
    weakProfitProducts,
  };
}
