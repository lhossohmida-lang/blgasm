"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";
import type {
  AppData,
  CreditCustomer,
  CreditTransaction,
  Product,
  Sale,
  StoreProfile,
  SyncOperation,
} from "@/types";

export function storeDoc(storeId: string) {
  return doc(db, "stores", storeId);
}

export async function ensureStore(profile: StoreProfile) {
  await setDoc(storeDoc(profile.id), profile, { merge: true });
  await setDoc(doc(db, "users", profile.ownerId), { storeId: profile.id, updatedAt: profile.updatedAt }, { merge: true });
}

export async function writeProduct(storeId: string, product: Product) {
  await setDoc(doc(db, "stores", storeId, "products", product.id), product, { merge: true });
}

export async function deleteProduct(storeId: string, productId: string) {
  await deleteDoc(doc(db, "stores", storeId, "products", productId));
}

export async function writeSale(storeId: string, sale: Sale) {
  await setDoc(doc(db, "stores", storeId, "sales", sale.id), sale, { merge: true });
}

export async function deleteSale(storeId: string, saleId: string) {
  await deleteDoc(doc(db, "stores", storeId, "sales", saleId));
}

export async function writeCreditCustomer(storeId: string, customer: CreditCustomer) {
  await setDoc(doc(db, "stores", storeId, "creditCustomers", customer.id), customer, { merge: true });
}

export async function deleteCreditCustomer(storeId: string, customerId: string) {
  await deleteDoc(doc(db, "stores", storeId, "creditCustomers", customerId));
}

export async function writeCreditTransaction(storeId: string, transaction: CreditTransaction) {
  await setDoc(
    doc(db, "stores", storeId, "creditCustomers", transaction.customerId, "transactions", transaction.id),
    transaction,
    { merge: true },
  );
}

export async function writeSyncOperation(storeId: string, operation: SyncOperation) {
  await setDoc(doc(db, "stores", storeId, "syncQueue", operation.id), operation, { merge: true });
}

export async function fetchRemoteAppData(local: AppData): Promise<AppData> {
  const storeId = local.store.id;
  const products = await getDocs(collection(db, "stores", storeId, "products"));
  const sales = await getDocs(collection(db, "stores", storeId, "sales"));
  const customers = await getDocs(collection(db, "stores", storeId, "creditCustomers"));
  const queue = await getDocs(
    query(collection(db, "stores", storeId, "syncQueue"), where("status", "!=", "synced")),
  );

  const remoteProducts = products.empty ? [] : products.docs.map((item) => item.data() as Product);
  const remoteSales = sales.empty ? [] : sales.docs.map((item) => item.data() as Sale);
  const remoteCustomers = customers.empty ? [] : customers.docs.map((item) => item.data() as CreditCustomer);
  const remoteQueue = queue.docs.map((item) => item.data() as SyncOperation);

  const transactions: CreditTransaction[] = [];
  await Promise.all(
    remoteCustomers.map(async (customer) => {
      const snapshot = await getDocs(
        collection(db, "stores", storeId, "creditCustomers", customer.id, "transactions"),
      );
      transactions.push(...snapshot.docs.map((item) => item.data() as CreditTransaction));
    }),
  );

  // Merge products: Keep remote products, but also keep local products that have pending sync operations (i.e. added/updated offline)
  const pendingProductIds = new Set(
    remoteQueue
      .filter((op) => op.operationType === "product.upsert" && op.status !== "synced")
      .map((op) => (op.payload as Product).id)
  );
  const mergedProducts = [...remoteProducts];
  local.products.forEach((localProd) => {
    if (pendingProductIds.has(localProd.id) && !mergedProducts.some((p) => p.id === localProd.id)) {
      mergedProducts.push(localProd);
    }
  });

  // Merge customers
  const pendingCustomerIds = new Set(
    remoteQueue
      .filter((op) => op.operationType === "customer.upsert" && op.status !== "synced")
      .map((op) => (op.payload as CreditCustomer).id)
  );
  const mergedCustomers = [...remoteCustomers];
  local.creditCustomers.forEach((localCust) => {
    if (pendingCustomerIds.has(localCust.id) && !mergedCustomers.some((c) => c.id === localCust.id)) {
      mergedCustomers.push(localCust);
    }
  });

  return {
    ...local,
    products: mergedProducts,
    sales: remoteSales.length ? remoteSales : local.sales,
    creditCustomers: mergedCustomers,
    creditTransactions: transactions.length ? transactions : local.creditTransactions,
    syncQueue: remoteQueue,
    updatedAt: new Date().toISOString(),
  };
}
