import type { AppData, StoreProfile } from "@/types";

export function createEmptyStore(ownerId: string): StoreProfile {
  const now = new Date().toISOString();
  return {
    id: ownerId,
    ownerId,
    name: "متجر بلقاسم للمواد الغذائية",
    currency: "DZD",
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialData(ownerId: string): AppData {
  const now = new Date().toISOString();

  return {
    store: createEmptyStore(ownerId),
    products: [],
    sales: [],
    creditCustomers: [],
    creditTransactions: [],
    syncQueue: [],
    updatedAt: now,
  };
}
