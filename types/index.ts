export type SaleType = "cash" | "credit";

export type ProductSaleMode = "unit" | "carton" | "weight";

export type ProductPurchaseUnit = "piece" | "carton" | "kilogram";

export type ProductSaleUnit = "piece" | "gram";

export type CreditTransactionType = "invoice" | "payment";

export type SyncStatus = "pending" | "synced" | "failed";

export type SyncOperationType =
  | "store.upsert"
  | "product.upsert"
  | "product.delete"
  | "sale.create"
  | "sale.delete"
  | "customer.upsert"
  | "customer.delete"
  | "transaction.create";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface StoreProfile {
  id: string;
  ownerId: string;
  name: string;
  currency: "DZD";
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  qrCode: string;
  name: string;
  category: string;
  wholesalePrice: number;
  unitsPerWholesale: number;
  saleMode?: ProductSaleMode;
  purchaseUnit?: ProductPurchaseUnit;
  saleUnit?: ProductSaleUnit;
  unitCost: number;
  sellPrice: number;
  profitPerUnit: number;
  profitPercent: number;
  expectedStockProfit: number;
  quantity: number;
  lowStockAlert: number;
  imageUrl?: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDraft {
  id?: string;
  qrCode: string;
  name: string;
  category: string;
  wholesalePrice: number;
  unitsPerWholesale: number;
  saleMode?: ProductSaleMode;
  purchaseUnit?: ProductPurchaseUnit;
  saleUnit?: ProductSaleUnit;
  unitCost?: number;
  sellPrice: number;
  quantity: number;
  lowStockAlert: number;
  imageUrl?: string;
  expiryDate?: string;
}

export interface SaleItem {
  productId: string;
  qrCode: string;
  name: string;
  saleUnit?: ProductSaleUnit;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  total: number;
  profit: number;
}

export interface Sale {
  id: string;
  type: SaleType;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  paidAmount: number;
  remainingAmount: number;
  receiptNumber: string;
  createdAt: string;
  createdBy: string;
}

export interface CreditCustomer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  totalDebt: number;
  totalPaid: number;
  remainingDebt: number;
  lastActivityAt: string;
  paymentDueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  customerId: string;
  type: CreditTransactionType;
  saleId?: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  note?: string;
  items?: Array<{ name: string; quantity: number; total: number }>;
  createdAt: string;
}

export interface SyncOperation {
  id: string;
  operationType: SyncOperationType;
  entityId?: string;
  payload: unknown;
  status: SyncStatus;
  retries: number;
  lastError?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface AppData {
  store: StoreProfile;
  products: Product[];
  sales: Sale[];
  creditCustomers: CreditCustomer[];
  creditTransactions: CreditTransaction[];
  syncQueue: SyncOperation[];
  updatedAt: string;
}

export interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  weekSales: number;
  weekProfit: number;
  monthSales: number;
  monthProfit: number;
  yearSales: number;
  yearProfit: number;
  cashCollected: number;
  creditUncollected: number;
  totalDebt: number;
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
  highProfitProducts: Product[];
  weakProfitProducts: Product[];
}

export interface SmartAlert {
  id: string;
  tone: ToastTone;
  title: string;
  body: string;
}

export interface AiContextSnapshot {
  generatedAt: string;
  currency: "DZD";
  stats: DashboardStats;
  lowStockProducts: Array<Pick<Product, "name" | "quantity" | "lowStockAlert">>;
  weakProfitProducts: Array<Pick<Product, "name" | "profitPercent" | "profitPerUnit">>;
  biggestDebtors: Array<Pick<CreditCustomer, "name" | "remainingDebt">>;
  recentSales: Array<Pick<Sale, "type" | "totalAmount" | "totalProfit" | "createdAt">>;
}
