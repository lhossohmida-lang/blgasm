import type { AppData, CreditCustomer, Product, StoreProfile } from "@/types";
import { productFromDraft, roundMoney } from "@/utils/calculations";

export function createEmptyStore(ownerId: string): StoreProfile {
  const now = new Date().toISOString();
  return {
    id: ownerId,
    ownerId,
    name: "محل بالقاسم للمواد الغذائية",
    currency: "DZD",
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialData(ownerId: string): AppData {
  const now = new Date().toISOString();
  const products: Product[] = [
    productFromDraft({
      qrCode: "6130001001012",
      name: "حليب علبة 1 لتر",
      category: "مشروبات",
      wholesalePrice: 960,
      unitsPerWholesale: 12,
      sellPrice: 95,
      quantity: 48,
      lowStockAlert: 10,
    }),
    productFromDraft({
      qrCode: "6130001002033",
      name: "سكر أبيض 1 كغ",
      category: "مواد أساسية",
      wholesalePrice: 4200,
      unitsPerWholesale: 25,
      sellPrice: 195,
      quantity: 30,
      lowStockAlert: 8,
    }),
    productFromDraft({
      qrCode: "6130001003047",
      name: "زيت نباتي 5 لتر",
      category: "مواد أساسية",
      wholesalePrice: 8100,
      unitsPerWholesale: 6,
      sellPrice: 1560,
      quantity: 9,
      lowStockAlert: 6,
    }),
    productFromDraft({
      qrCode: "6130001004051",
      name: "بسكويت عائلي",
      category: "حلويات",
      wholesalePrice: 1800,
      unitsPerWholesale: 24,
      sellPrice: 100,
      quantity: 4,
      lowStockAlert: 6,
    }),
  ];

  const customers: CreditCustomer[] = [
    {
      id: crypto.randomUUID(),
      name: "أحمد بن سالم",
      phone: "0550 00 00 00",
      address: "الحي الجديد",
      totalDebt: 12500,
      totalPaid: 3500,
      remainingDebt: roundMoney(9000),
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    store: createEmptyStore(ownerId),
    products,
    sales: [],
    creditCustomers: customers,
    creditTransactions: [],
    syncQueue: [],
    updatedAt: now,
  };
}
