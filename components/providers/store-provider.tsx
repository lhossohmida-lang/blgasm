"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { flushSyncQueue } from "@/lib/firebase/offlineSync";
import {
  createSyncOperation,
  enqueueLocalOperation,
  getLocalAppData,
  replaceLocalQueue,
  saveLocalAppData,
} from "@/lib/offline/db";
import type {
  AppData,
  CreditCustomer,
  CreditTransaction,
  Product,
  ProductDraft,
  Sale,
  SaleItem,
  SaleType,
  SyncOperation,
} from "@/types";
import {
  applySaleToInventory,
  calculateSaleTotals,
  computeDashboardStats,
  productFromDraft,
  roundMoney,
  updateCreditTotals,
} from "@/utils/calculations";
import { makeReceiptNumber } from "@/utils/format";
import { createInitialData } from "@/utils/sample-data";

interface CreateSaleInput {
  type: SaleType;
  items: SaleItem[];
  customerId?: string;
  customerName?: string;
  paidAmount?: number;
}

interface StoreContextValue {
  data: AppData | null;
  loading: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  stats: ReturnType<typeof computeDashboardStats> | null;
  upsertProduct: (draft: ProductDraft) => Promise<Product>;
  deleteProduct: (productId: string) => Promise<void>;
  findProductByCode: (code: string) => Product | undefined;
  createSale: (input: CreateSaleInput) => Promise<Sale>;
  upsertCustomer: (customer: Partial<CreditCustomer> & { name: string }) => Promise<CreditCustomer>;
  deleteCustomer: (customerId: string) => Promise<void>;
  addPayment: (customerId: string, amount: number, note?: string) => Promise<CreditTransaction>;
  syncNow: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function stamp(data: AppData): AppData {
  return { ...data, updatedAt: new Date().toISOString() };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const isOnline = useOnlineStatus();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const syncingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const local = await getLocalAppData(user.uid);
      if (cancelled) {
        return;
      }

      const next = local ?? createInitialData(user.uid);
      if (!local) {
        const op = user.isDemo ? null : createSyncOperation("store.upsert", next.store, next.store.id);
        next.syncQueue = op ? [op] : [];
        await saveLocalAppData(next);
        if (op) {
          await enqueueLocalOperation(next.store.id, op);
        }
      }

      setData(next);
      setLoading(false);
    }

    load().catch((error) => {
      setLoading(false);
      notify({
        tone: "error",
        title: "تعذر تحميل البيانات المحلية",
        body: error instanceof Error ? error.message : "خطأ غير معروف",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [notify, user]);

  const commit = useCallback(async (nextData: AppData, operations: SyncOperation[] = []) => {
    const next = stamp({
      ...nextData,
      syncQueue: [...nextData.syncQueue, ...operations],
    });

    setData(next);
    await saveLocalAppData(next);
    await Promise.all(operations.map((operation) => enqueueLocalOperation(next.store.id, operation)));
  }, []);

  const syncNow = useCallback(async () => {
    if (!data || !isOnline || user?.isDemo || syncingRef.current) {
      return;
    }

    const unsynced = data.syncQueue.filter((operation) => operation.status !== "synced");
    if (!unsynced.length) {
      return;
    }

    syncingRef.current = true;
    try {
      const synced = await flushSyncQueue(data.store.id, unsynced);
      const syncedById = new Map(synced.map((operation) => [operation.id, operation]));
      const merged = data.syncQueue
        .map((operation) => syncedById.get(operation.id) ?? operation)
        .filter((operation, index, queue) => operation.status !== "synced" || index > queue.length - 30);
      const next = stamp({ ...data, syncQueue: merged });
      setData(next);
      await saveLocalAppData(next);
      await replaceLocalQueue(next.store.id, merged);

      if (synced.some((operation) => operation.status === "synced")) {
        notify({ tone: "success", title: "تمت المزامنة بنجاح" });
      }
      if (synced.some((operation) => operation.status === "failed")) {
        notify({ tone: "warning", title: "بعض العمليات لم تتزامن", body: "ستتم إعادة المحاولة لاحقاً." });
      }
    } finally {
      syncingRef.current = false;
    }
  }, [data, isOnline, notify, user?.isDemo]);

  useEffect(() => {
    if (isOnline) {
      syncNow();
    }
  }, [isOnline, syncNow]);

  const upsertProduct = useCallback(
    async (draft: ProductDraft) => {
      if (!data) {
        throw new Error("البيانات غير جاهزة.");
      }

      const existing = data.products.find((product) => product.id === draft.id || product.qrCode === draft.qrCode);
      const product = productFromDraft(draft, existing);
      const products = existing
        ? data.products.map((item) => (item.id === existing.id ? product : item))
        : [product, ...data.products];
      const operation = createSyncOperation("product.upsert", product, product.id);
      await commit({ ...data, products }, [operation]);
      notify({ tone: "success", title: "تم إدخال المنتج بنجاح", body: product.name });
      return product;
    },
    [commit, data, notify],
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!data) {
        return;
      }

      const product = data.products.find((item) => item.id === productId);
      const operation = createSyncOperation("product.delete", { productId }, productId);
      await commit({ ...data, products: data.products.filter((item) => item.id !== productId) }, [operation]);
      notify({ tone: "info", title: "تم حذف المنتج", body: product?.name });
    },
    [commit, data, notify],
  );

  const findProductByCode = useCallback(
    (code: string) => data?.products.find((product) => product.qrCode === code.trim()),
    [data?.products],
  );

  const createSale = useCallback(
    async (input: CreateSaleInput) => {
      if (!data || !user) {
        throw new Error("لا يمكن إنشاء عملية بيع قبل تحميل البيانات.");
      }

      if (!input.items.length) {
        throw new Error("أضف منتجاً واحداً على الأقل.");
      }

      const totals = calculateSaleTotals(input.items);
      const shortage = totals.items.find((item) => {
        const product = data.products.find((candidate) => candidate.id === item.productId);
        return !product || product.quantity < item.quantity;
      });

      if (shortage) {
        throw new Error(`الكمية غير كافية للمنتج: ${shortage.name}`);
      }

      if (input.type === "credit" && !input.customerId) {
        throw new Error("اختر حساب كريدي قبل إتمام البيع.");
      }

      const paidAmount = input.type === "cash" ? totals.totalAmount : Number(input.paidAmount) || 0;
      const sale: Sale = {
        id: crypto.randomUUID(),
        type: input.type,
        customerId: input.customerId,
        customerName: input.customerName,
        items: totals.items,
        totalAmount: totals.totalAmount,
        totalCost: totals.totalCost,
        totalProfit: totals.totalProfit,
        paidAmount: roundMoney(paidAmount),
        remainingAmount: roundMoney(totals.totalAmount - paidAmount),
        receiptNumber: makeReceiptNumber(),
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };

      const products = applySaleToInventory(data.products, totals.items);
      let creditCustomers = data.creditCustomers;
      let creditTransactions = data.creditTransactions;
      const operations: SyncOperation[] = [
        createSyncOperation("sale.create", sale, sale.id),
        ...products
          .filter((product) =>
            data.products.some((oldProduct) => oldProduct.id === product.id && oldProduct.quantity !== product.quantity),
          )
          .map((product) => createSyncOperation("product.upsert", product, product.id)),
      ];

      if (sale.type === "credit" && sale.customerId) {
        creditCustomers = updateCreditTotals(creditCustomers, sale.customerId, sale.totalAmount, sale.paidAmount);
        const transaction: CreditTransaction = {
          id: crypto.randomUUID(),
          customerId: sale.customerId,
          type: "invoice",
          saleId: sale.id,
          amount: sale.totalAmount,
          paidAmount: sale.paidAmount,
          remainingAmount: sale.remainingAmount,
          note: `فاتورة ${sale.receiptNumber}`,
          createdAt: sale.createdAt,
        };
        creditTransactions = [transaction, ...creditTransactions];
        const updatedCustomer = creditCustomers.find((customer) => customer.id === sale.customerId);
        if (updatedCustomer) {
          operations.push(createSyncOperation("customer.upsert", updatedCustomer, updatedCustomer.id));
        }
        operations.push(createSyncOperation("transaction.create", transaction, transaction.id));
      }

      await commit(
        {
          ...data,
          products,
          sales: [sale, ...data.sales],
          creditCustomers,
          creditTransactions,
        },
        operations,
      );
      notify({ tone: "success", title: "تم البيع بنجاح", body: sale.receiptNumber });
      return sale;
    },
    [commit, data, notify, user],
  );

  const upsertCustomer = useCallback(
    async (input: Partial<CreditCustomer> & { name: string }) => {
      if (!data) {
        throw new Error("البيانات غير جاهزة.");
      }

      const now = new Date().toISOString();
      const existing = input.id ? data.creditCustomers.find((customer) => customer.id === input.id) : undefined;
      const openingDebt = existing ? 0 : roundMoney(Math.max(0, Number(input.totalDebt) || Number(input.remainingDebt) || 0));
      const customer: CreditCustomer = {
        id: existing?.id ?? crypto.randomUUID(),
        name: input.name.trim(),
        phone: input.phone?.trim() || undefined,
        address: input.address?.trim() || undefined,
        totalDebt: existing?.totalDebt ?? openingDebt,
        totalPaid: existing?.totalPaid ?? 0,
        remainingDebt: existing?.remainingDebt ?? openingDebt,
        lastActivityAt: openingDebt > 0 ? now : (existing?.lastActivityAt ?? now),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const creditCustomers = existing
        ? data.creditCustomers.map((item) => (item.id === existing.id ? customer : item))
        : [customer, ...data.creditCustomers];
      const openingTransaction: CreditTransaction | null =
        !existing && openingDebt > 0
          ? {
              id: crypto.randomUUID(),
              customerId: customer.id,
              type: "invoice",
              amount: openingDebt,
              paidAmount: 0,
              remainingAmount: openingDebt,
              note: "دين أولي عند إنشاء الحساب",
              createdAt: now,
            }
          : null;
      await commit(
        {
          ...data,
          creditCustomers,
          creditTransactions: openingTransaction ? [openingTransaction, ...data.creditTransactions] : data.creditTransactions,
        },
        [
          createSyncOperation("customer.upsert", customer, customer.id),
          ...(openingTransaction ? [createSyncOperation("transaction.create", openingTransaction, openingTransaction.id)] : []),
        ],
      );
      notify({ tone: "success", title: existing ? "تم تعديل حساب الكريدي" : "تم إنشاء حساب كريدي" });
      return customer;
    },
    [commit, data, notify],
  );

  const deleteCustomer = useCallback(
    async (customerId: string) => {
      if (!data) {
        return;
      }

      await commit(
        {
          ...data,
          creditCustomers: data.creditCustomers.filter((customer) => customer.id !== customerId),
          creditTransactions: data.creditTransactions.filter((transaction) => transaction.customerId !== customerId),
        },
        [createSyncOperation("customer.delete", { customerId }, customerId)],
      );
      notify({ tone: "info", title: "تم حذف حساب الكريدي" });
    },
    [commit, data, notify],
  );

  const addPayment = useCallback(
    async (customerId: string, amount: number, note?: string) => {
      if (!data) {
        throw new Error("البيانات غير جاهزة.");
      }

      const customer = data.creditCustomers.find((item) => item.id === customerId);
      if (!customer) {
        throw new Error("حساب الكريدي غير موجود.");
      }

      const paid = Math.max(0, Number(amount) || 0);
      const transaction: CreditTransaction = {
        id: crypto.randomUUID(),
        customerId,
        type: "payment",
        amount: paid,
        paidAmount: paid,
        remainingAmount: roundMoney(Math.max(0, customer.remainingDebt - paid)),
        note,
        createdAt: new Date().toISOString(),
      };
      const creditCustomers = updateCreditTotals(data.creditCustomers, customerId, 0, paid);
      const updatedCustomer = creditCustomers.find((item) => item.id === customerId);
      const operations = [
        createSyncOperation("transaction.create", transaction, transaction.id),
        ...(updatedCustomer ? [createSyncOperation("customer.upsert", updatedCustomer, updatedCustomer.id)] : []),
      ];

      await commit(
        {
          ...data,
          creditCustomers,
          creditTransactions: [transaction, ...data.creditTransactions],
        },
        operations,
      );
      notify({ tone: "success", title: "تم تسجيل الدفعة" });
      return transaction;
    },
    [commit, data, notify],
  );

  const stats = useMemo(() => {
    if (!data) {
      return null;
    }
    return computeDashboardStats(data.products, data.sales, data.creditCustomers);
  }, [data]);

  const value = useMemo<StoreContextValue>(
    () => ({
      data,
      loading,
      isOnline,
      pendingSyncCount: data?.syncQueue.filter((operation) => operation.status !== "synced").length ?? 0,
      stats,
      upsertProduct,
      deleteProduct,
      findProductByCode,
      createSale,
      upsertCustomer,
      deleteCustomer,
      addPayment,
      syncNow,
    }),
    [
      addPayment,
      createSale,
      data,
      deleteCustomer,
      deleteProduct,
      findProductByCode,
      isOnline,
      loading,
      stats,
      syncNow,
      upsertCustomer,
      upsertProduct,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return context;
}
