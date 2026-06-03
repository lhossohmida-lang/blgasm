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

  const remoteCustomers = customers.docs.map((item) => item.data() as CreditCustomer);
  const transactions: CreditTransaction[] = [];
  await Promise.all(
    remoteCustomers.map(async (customer) => {
      const snapshot = await getDocs(
        collection(db, "stores", storeId, "creditCustomers", customer.id, "transactions"),
      );
      transactions.push(...snapshot.docs.map((item) => item.data() as CreditTransaction));
    }),
  );

  return {
    ...local,
    products: products.empty ? local.products : products.docs.map((item) => item.data() as Product),
    sales: sales.empty ? local.sales : sales.docs.map((item) => item.data() as Sale),
    creditCustomers: customers.empty ? local.creditCustomers : remoteCustomers,
    creditTransactions: transactions.length ? transactions : local.creditTransactions,
    syncQueue: queue.docs.map((item) => item.data() as SyncOperation),
    updatedAt: new Date().toISOString(),
  };
}
