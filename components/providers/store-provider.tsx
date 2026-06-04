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
import {
  collection,
  query,
  setDoc,
  getDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";
import {
  subscribeProducts,
  subscribeSales,
  subscribeCustomers,
  subscribeTransactions,
  unsubscribeAll,
} from "@/lib/firebase/listeners";
import {
  createSyncOperation,
  enqueueLocalOperation,
  getLocalAppData,
  replaceLocalQueue,
  saveLocalAppData,
} from "@/lib/offline/db";
import { flushSyncQueue } from "@/lib/firebase/offlineSync";
import { fetchRemoteAppData } from "@/lib/firebase/firestore";
import { writeAuditLog } from "@/lib/firebase/auditLog";
import { useDailyCleanup } from "@/hooks/use-daily-cleanup";
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
  discountAmount?: number;
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
  deleteSale: (saleId: string) => Promise<void>;
  upsertCustomer: (customer: Partial<CreditCustomer> & { name: string }) => Promise<CreditCustomer>;
  deleteCustomer: (customerId: string) => Promise<void>;
  addPayment: (customerId: string, amount: number, note?: string) => Promise<CreditTransaction>;
  syncNow: (silent?: boolean) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function stamp(data: AppData): AppData {
  return { ...data, updatedAt: new Date().toISOString() };
}

// ── Write helpers (direct Firestore, no queue) ──────────────────────────────
async function fbWriteProduct(storeId: string, product: Product) {
  await setDoc(doc(db, "stores", storeId, "products", product.id), product, { merge: true });
}
async function fbDeleteProduct(storeId: string, productId: string) {
  await deleteDoc(doc(db, "stores", storeId, "products", productId));
}
async function fbWriteSale(storeId: string, sale: Sale) {
  await setDoc(doc(db, "stores", storeId, "sales", sale.id), sale, { merge: true });
}
async function fbDeleteSale(storeId: string, saleId: string) {
  await deleteDoc(doc(db, "stores", storeId, "sales", saleId));
}
async function fbWriteCustomer(storeId: string, customer: CreditCustomer) {
  await setDoc(doc(db, "stores", storeId, "creditCustomers", customer.id), customer, { merge: true });
}
async function fbDeleteCustomer(storeId: string, customerId: string) {
  await deleteDoc(doc(db, "stores", storeId, "creditCustomers", customerId));
}
async function fbWriteTransaction(storeId: string, tx: CreditTransaction) {
  await setDoc(doc(db, "stores", storeId, "creditTransactions", tx.id), tx, { merge: true });
}
async function fbEnsureStore(storeId: string, ownerId: string, name: string) {
  await setDoc(
    doc(db, "stores", storeId),
    { id: storeId, ownerId, name, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  // Read the user doc first — only inject role:"admin" if the field is missing.
  // This prevents overwriting a role already set by an admin (e.g. employee/accountant).
  const userRef = doc(db, "users", ownerId);
  const userSnap = await getDoc(userRef);
  const rolePayload = (!userSnap.exists() || !userSnap.data().role)
    ? { role: "admin" }
    : {};
  await setDoc(
    userRef,
    { storeId, isActive: true, updatedAt: new Date().toISOString(), ...rolePayload },
    { merge: true },
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const isOnline = useOnlineStatus();
  // Free replacement for Firebase scheduled function — cleans old sync ops once/day
  useDailyCleanup();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  // storeId is stable once loaded — used in listeners without re-creating them
  const storeIdRef = useRef<string | null>(null);
  // Track pending offline operations count separately from data
  const [pendingCount, setPendingCount] = useState(0);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      // 1. Determine the real storeId:
      //    - From Firebase /users/{uid}.storeId (most authoritative)
      //    - From local IndexedDB store.id
      //    - Fallback to user.uid
      let resolvedStoreId = user!.uid;
      if (isOnline && !user!.isDemo) {
        try {
          const userDoc = await getDoc(doc(db, "users", user!.uid));
          if (userDoc.exists() && userDoc.data().storeId) {
            resolvedStoreId = userDoc.data().storeId as string;
          }
        } catch {
          // ignore — use default
        }
      }

      // 2. Get local snapshot (keyed by user.uid for lookup, but use resolvedStoreId)
      const localByUid = await getLocalAppData(user!.uid);
      const localByStore = resolvedStoreId !== user!.uid ? await getLocalAppData(resolvedStoreId) : null;
      const local = localByStore ?? localByUid;
      let next = local ?? createInitialData(resolvedStoreId);
      // Ensure store.id matches resolvedStoreId
      if (next.store.id !== resolvedStoreId) {
        next = { ...next, store: { ...next.store, id: resolvedStoreId, ownerId: user!.uid } };
      }

      // 3. If online and verified, pull fresh data from Firebase
      if (isOnline && !user!.isDemo && user!.isVerified) {
        try {
          // Ensure store document exists in Firebase
          await fbEnsureStore(resolvedStoreId, user!.uid, next.store.name);
          // Pull all collections
          const [prodSnap, salesSnap, custSnap, txSnap] = await Promise.all([
            getDocs(collection(db, "stores", resolvedStoreId, "products")),
            getDocs(collection(db, "stores", resolvedStoreId, "sales")),
            getDocs(collection(db, "stores", resolvedStoreId, "creditCustomers")),
            getDocs(collection(db, "stores", resolvedStoreId, "creditTransactions")),
          ]);
          next = {
            ...next,
            products: prodSnap.docs.map((d) => d.data() as Product),
            sales: salesSnap.docs
              .map((d) => d.data() as Sale)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            creditCustomers: custSnap.docs.map((d) => d.data() as CreditCustomer),
            creditTransactions: txSnap.docs.map((d) => d.data() as CreditTransaction),
            syncQueue: [],
            updatedAt: new Date().toISOString(),
          };
        } catch (err) {
          console.error("Initial Firebase load failed:", err);
        }
      }

      if (!cancelled) {
        storeIdRef.current = next.store.id;
        await saveLocalAppData(next);
        setData(next);
        setPendingCount(0);
        setLoading(false);
      }
    }

    load().catch((err) => {
      if (!cancelled) {
        setLoading(false);
        notify({ tone: "error", title: "تعذر تحميل البيانات", body: String(err) });
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.isVerified, isOnline]);

  // ── Real-time listeners (created once per storeId) ──────────────────────
  useEffect(() => {
    if (!user || user.isDemo || !user.isVerified || loading) return;
    const storeId = storeIdRef.current;
    if (!storeId) return;

    const unsub1 = subscribeProducts(storeId, (products) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, products, updatedAt: new Date().toISOString() };
        saveLocalAppData(next).catch(() => {});
        return next;
      });
    });

    const unsub2 = subscribeSales(storeId, (sales) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, sales, updatedAt: new Date().toISOString() };
        saveLocalAppData(next).catch(() => {});
        return next;
      });
    });

    const unsub3 = subscribeCustomers(storeId, (creditCustomers) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, creditCustomers, updatedAt: new Date().toISOString() };
        saveLocalAppData(next).catch(() => {});
        return next;
      });
    });

    const unsub4 = subscribeTransactions(storeId, (creditTransactions) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, creditTransactions, updatedAt: new Date().toISOString() };
        saveLocalAppData(next).catch(() => {});
        return next;
      });
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  // Only re-run when user or loading status changes — NOT on every data change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.isVerified, loading]);

  // Cancel all listeners on logout
  useEffect(() => {
    if (!user) unsubscribeAll();
  }, [user]);

  // ── syncNow: flush offline queue + re-pull from Firebase ───────────────
  const syncNow = useCallback(async (silent = false) => {
    if (!data || !isOnline || user?.isDemo || !user?.isVerified || syncing) return;
    const storeId = storeIdRef.current;
    if (!storeId) return;

    setSyncing(true);
    try {
      // 1. Flush any queued offline operations
      const unsynced = data.syncQueue.filter((op) => op.status !== "synced");
      if (unsynced.length) {
        await flushSyncQueue(storeId, unsynced);
      }

      // 2. Pull fresh data from Firebase
      const [prodSnap, salesSnap, custSnap, txSnap] = await Promise.all([
        getDocs(collection(db, "stores", storeId, "products")),
        getDocs(collection(db, "stores", storeId, "sales")),
        getDocs(collection(db, "stores", storeId, "creditCustomers")),
        getDocs(collection(db, "stores", storeId, "creditTransactions")),
      ]);
      const next: AppData = {
        ...data,
        products: prodSnap.docs.map((d) => d.data() as Product),
        sales: salesSnap.docs
          .map((d) => d.data() as Sale)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        creditCustomers: custSnap.docs.map((d) => d.data() as CreditCustomer),
        creditTransactions: txSnap.docs.map((d) => d.data() as CreditTransaction),
        syncQueue: [],
        updatedAt: new Date().toISOString(),
      };
      setData(next);
      await saveLocalAppData(next);
      await replaceLocalQueue(storeId, []);
      setPendingCount(0);

      if (!silent) {
        notify({ tone: "success", title: "تمت المزامنة بنجاح ✓" });
      }
    } catch (err) {
      notify({ tone: "error", title: "فشلت المزامنة", body: String(err) });
    } finally {
      setSyncing(false);
    }
  }, [data, isOnline, user?.isDemo, syncing, notify]);

  // ── Auto-sync on reconnect ──────────────────────────────────────────────
  const prevOnlineRef = useRef(false);
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current && data && !user?.isDemo && user?.isVerified) {
      syncNow(true);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, data, user?.isDemo, user?.isVerified, syncNow]);

  // ── Write to Firebase then update local state ───────────────────────────
  // Helper: optimistic local update + Firebase write (with offline fallback)
  async function writeAndUpdate(
    nextData: AppData,
    firebaseFn: () => Promise<void>,
    offlineOp?: SyncOperation,
  ) {
    const next = stamp({ ...nextData, syncQueue: nextData.syncQueue });
    setData(next);
    await saveLocalAppData(next);

    const canWriteFirebase = isOnline && user && !user.isDemo && user.isVerified;
    const canQueueSync = user && !user.isDemo;

    if (canWriteFirebase) {
      try {
        await firebaseFn();
      } catch (err) {
        console.error("Firebase write failed, queuing offline:", err);
        if (offlineOp && canQueueSync) {
          const queued = stamp({ ...next, syncQueue: [...next.syncQueue, offlineOp] });
          setData(queued);
          await saveLocalAppData(queued);
          await enqueueLocalOperation(next.store.id, offlineOp);
          setPendingCount((c) => c + 1);
        }
      }
    } else if (offlineOp && canQueueSync) {
      const queued = stamp({ ...next, syncQueue: [...next.syncQueue, offlineOp] });
      setData(queued);
      await saveLocalAppData(queued);
      await enqueueLocalOperation(next.store.id, offlineOp);
      setPendingCount((c) => c + 1);
    }
  }

  // ── upsertProduct ───────────────────────────────────────────────────────
  const upsertProduct = useCallback(async (draft: ProductDraft) => {
    if (!data) throw new Error("البيانات غير جاهزة.");
    const existing = data.products.find((p) => p.id === draft.id || p.qrCode === draft.qrCode);
    const product = productFromDraft(draft, existing);
    const products = existing
      ? data.products.map((p) => (p.id === existing.id ? product : p))
      : [product, ...data.products];
    const storeId = data.store.id;
    await writeAndUpdate(
      { ...data, products },
      () => fbWriteProduct(storeId, product),
      createSyncOperation("product.upsert", product, product.id),
    );
    // Audit — non-blocking
    void writeAuditLog(storeId, {
      userId: user?.uid ?? "unknown",
      userEmail: user?.email ?? "unknown",
      action: existing ? "product.update" : "product.create",
      entityType: "product",
      entityId: product.id,
      after: { name: product.name, quantity: product.quantity, sellPrice: product.sellPrice },
      platform: "web",
    });
    notify({ tone: "success", title: "تم إدخال المنتج بنجاح", body: product.name });
    return product;
  }, [data, isOnline, notify, user]);

  // ── deleteProduct ───────────────────────────────────────────────────────
  const deleteProduct = useCallback(async (productId: string) => {
    if (!data) return;
    const product = data.products.find((p) => p.id === productId);
    const storeId = data.store.id;
    await writeAndUpdate(
      { ...data, products: data.products.filter((p) => p.id !== productId) },
      () => fbDeleteProduct(storeId, productId),
      createSyncOperation("product.delete", { productId }, productId),
    );
    // Audit — non-blocking
    void writeAuditLog(storeId, {
      userId: user?.uid ?? "unknown",
      userEmail: user?.email ?? "unknown",
      action: "product.delete",
      entityType: "product",
      entityId: productId,
      before: { name: product?.name },
      platform: "web",
    });
    notify({ tone: "info", title: "تم حذف المنتج", body: product?.name });
  }, [data, isOnline, notify, user]);

  const findProductByCode = useCallback(
    (code: string) => data?.products.find((p) => p.qrCode === code.trim()),
    [data?.products],
  );

  // ── createSale ──────────────────────────────────────────────────────────
  const createSale = useCallback(async (input: CreateSaleInput) => {
    if (!data || !user) throw new Error("لا يمكن إنشاء عملية بيع قبل تحميل البيانات.");
    if (!input.items.length) throw new Error("أضف منتجاً واحداً على الأقل.");

    const totals = calculateSaleTotals(input.items);
    const shortage = totals.items.find((item) => {
      const p = data.products.find((c) => c.id === item.productId);
      return !p || p.quantity < item.quantity;
    });
    if (shortage) throw new Error(`الكمية غير كافية للمنتج: ${shortage.name}`);
    if (input.type === "credit" && !input.customerId) throw new Error("اختر حساب كريدي.");

    const discountAmount = Math.min(Math.max(0, Number(input.discountAmount) || 0), totals.totalAmount);
    const paidAmount = input.type === "cash" ? totals.totalAmount - discountAmount : Number(input.paidAmount) || 0;
    const sale: Sale = {
      id: crypto.randomUUID(),
      type: input.type,
      customerId: input.customerId,
      customerName: input.customerName,
      items: totals.items,
      totalAmount: roundMoney(totals.totalAmount - discountAmount),
      totalCost: totals.totalCost,
      totalProfit: totals.totalProfit,
      paidAmount: roundMoney(paidAmount),
      remainingAmount: roundMoney(Math.max(0, totals.totalAmount - discountAmount - paidAmount)),
      receiptNumber: makeReceiptNumber(),
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    };

    const products = applySaleToInventory(data.products, totals.items);
    let creditCustomers = data.creditCustomers;
    let creditTransactions = data.creditTransactions;
    let newTransaction: CreditTransaction | null = null;

    if (sale.type === "credit" && sale.customerId) {
      creditCustomers = updateCreditTotals(creditCustomers, sale.customerId, sale.totalAmount, sale.paidAmount);
      newTransaction = {
        id: crypto.randomUUID(),
        customerId: sale.customerId,
        type: "invoice",
        saleId: sale.id,
        amount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        remainingAmount: sale.remainingAmount,
        note: `فاتورة ${sale.receiptNumber}`,
        items: totals.items.map((i) => ({ name: i.name, quantity: i.quantity, total: i.total })),
        createdAt: sale.createdAt,
      };
      creditTransactions = [newTransaction, ...creditTransactions];
    }

    const nextData: AppData = { ...data, products, sales: [sale, ...data.sales], creditCustomers, creditTransactions };
    const storeId = data.store.id;
    const updatedCustomer = creditCustomers.find((c) => c.id === sale.customerId);

    await writeAndUpdate(nextData, async () => {
      await fbWriteSale(storeId, sale);
      await Promise.all(
        products
          .filter((p) => data.products.find((op) => op.id === p.id && op.quantity !== p.quantity))
          .map((p) => fbWriteProduct(storeId, p)),
      );
      if (updatedCustomer) await fbWriteCustomer(storeId, updatedCustomer);
      if (newTransaction) await fbWriteTransaction(storeId, newTransaction);
    });

    notify({ tone: "success", title: "تم البيع بنجاح", body: sale.receiptNumber });
    // Audit — non-blocking
    void writeAuditLog(storeId, {
      userId: user.uid,
      userEmail: user.email,
      action: "sale.create",
      entityType: "sale",
      entityId: sale.id,
      after: { receiptNumber: sale.receiptNumber, totalAmount: sale.totalAmount, type: sale.type },
      platform: "web",
    });
    return sale;
  }, [data, user, isOnline, notify]);

  // ── deleteSale ──────────────────────────────────────────────────────────
  const deleteSale = useCallback(async (saleId: string) => {
    if (!data) return;
    const sale = data.sales.find((s) => s.id === saleId);
    if (!sale) return;
    const restoredProducts = data.products.map((p) => {
      const item = sale.items.find((i) => i.productId === p.id);
      return item ? { ...p, quantity: p.quantity + item.quantity } : p;
    });
    const storeId = data.store.id;
    await writeAndUpdate(
      { ...data, sales: data.sales.filter((s) => s.id !== saleId), products: restoredProducts },
      async () => {
        await fbDeleteSale(storeId, saleId);
        await Promise.all(
          restoredProducts
            .filter((p) => data.products.find((op) => op.id === p.id && op.quantity !== p.quantity))
            .map((p) => fbWriteProduct(storeId, p)),
        );
      },
    );
    // Audit — non-blocking
    void writeAuditLog(storeId, {
      userId: user?.uid ?? "unknown",
      userEmail: user?.email ?? "unknown",
      action: "sale.delete",
      entityType: "sale",
      entityId: saleId,
      before: { receiptNumber: sale.receiptNumber, totalAmount: sale.totalAmount },
      platform: "web",
    });
    notify({ tone: "info", title: "تم حذف البيع وإعادة البضاعة للمخزون" });
  }, [data, isOnline, notify, user]);

  // ── upsertCustomer ──────────────────────────────────────────────────────
  const upsertCustomer = useCallback(async (input: Partial<CreditCustomer> & { name: string }) => {
    if (!data) throw new Error("البيانات غير جاهزة.");
    const now = new Date().toISOString();
    const existing = input.id ? data.creditCustomers.find((c) => c.id === input.id) : undefined;
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
      paymentDueDate: input.paymentDueDate ?? existing?.paymentDueDate,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const creditCustomers = existing
      ? data.creditCustomers.map((c) => (c.id === existing.id ? customer : c))
      : [customer, ...data.creditCustomers];
    const openingTx: CreditTransaction | null =
      !existing && openingDebt > 0
        ? { id: crypto.randomUUID(), customerId: customer.id, type: "invoice", amount: openingDebt, paidAmount: 0, remainingAmount: openingDebt, note: "دين أولي عند إنشاء الحساب", createdAt: now }
        : null;
    const storeId = data.store.id;
    await writeAndUpdate(
      { ...data, creditCustomers, creditTransactions: openingTx ? [openingTx, ...data.creditTransactions] : data.creditTransactions },
      async () => {
        await fbWriteCustomer(storeId, customer);
        if (openingTx) await fbWriteTransaction(storeId, openingTx);
      },
    );
    notify({ tone: "success", title: existing ? "تم تعديل حساب الكريدي" : "تم إنشاء حساب كريدي" });
    return customer;
  }, [data, isOnline, notify]);

  // ── deleteCustomer ──────────────────────────────────────────────────────
  const deleteCustomer = useCallback(async (customerId: string) => {
    if (!data) return;
    const storeId = data.store.id;
    await writeAndUpdate(
      {
        ...data,
        creditCustomers: data.creditCustomers.filter((c) => c.id !== customerId),
        creditTransactions: data.creditTransactions.filter((t) => t.customerId !== customerId),
      },
      () => fbDeleteCustomer(storeId, customerId),
    );
    notify({ tone: "info", title: "تم حذف حساب الكريدي" });
  }, [data, isOnline, notify]);

  // ── addPayment ──────────────────────────────────────────────────────────
  const addPayment = useCallback(async (customerId: string, amount: number, note?: string) => {
    if (!data) throw new Error("البيانات غير جاهزة.");
    const customer = data.creditCustomers.find((c) => c.id === customerId);
    if (!customer) throw new Error("حساب الكريدي غير موجود.");
    const paid = Math.max(0, Number(amount) || 0);
    const tx: CreditTransaction = {
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
    const updatedCustomer = creditCustomers.find((c) => c.id === customerId);
    const storeId = data.store.id;
    await writeAndUpdate(
      { ...data, creditCustomers, creditTransactions: [tx, ...data.creditTransactions] },
      async () => {
        await fbWriteTransaction(storeId, tx);
        if (updatedCustomer) await fbWriteCustomer(storeId, updatedCustomer);
      },
    );
    notify({ tone: "success", title: "تم تسجيل الدفعة" });
    return tx;
  }, [data, isOnline, notify]);

  const stats = useMemo(() => {
    if (!data) return null;
    return computeDashboardStats(data.products, data.sales, data.creditCustomers);
  }, [data]);

  const value = useMemo<StoreContextValue>(
    () => ({
      data,
      loading,
      isOnline,
      pendingSyncCount: pendingCount + (data?.syncQueue.filter((op) => op.status !== "synced").length ?? 0),
      stats,
      upsertProduct,
      deleteProduct,
      findProductByCode,
      createSale,
      deleteSale,
      upsertCustomer,
      deleteCustomer,
      addPayment,
      syncNow,
    }),
    [addPayment, createSale, data, deleteCustomer, deleteProduct, deleteSale,
      findProductByCode, isOnline, loading, pendingCount, stats, syncNow, upsertCustomer, upsertProduct],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
