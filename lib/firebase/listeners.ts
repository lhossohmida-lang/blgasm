"use client";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";
import type { CreditCustomer, CreditTransaction, Product, Sale } from "@/types";

// Active subscription handles — keyed so we can cancel before re-subscribing
const subs: Partial<Record<string, Unsubscribe>> = {};

/** Subscribe to the products sub-collection. Returns unsubscribe fn. */
export function subscribeProducts(
  storeId: string,
  onUpdate: (products: Product[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  subs.products?.();
  subs.products = onSnapshot(
    query(collection(db, "stores", storeId, "products"), orderBy("updatedAt", "desc")),
    { includeMetadataChanges: true },
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as Product));
      if (!snap.metadata.fromCache) {
        console.debug("[listener] products ← server", snap.size);
      }
    },
    (err) => {
      console.error("[listener] products error:", err);
      onError?.(err);
    },
  );
  return subs.products;
}

/** Subscribe to the sales sub-collection (latest 500). */
export function subscribeSales(
  storeId: string,
  onUpdate: (sales: Sale[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  subs.sales?.();
  subs.sales = onSnapshot(
    query(collection(db, "stores", storeId, "sales"), orderBy("createdAt", "desc"), limit(500)),
    (snap) => onUpdate(snap.docs.map((d) => d.data() as Sale)),
    (err) => {
      console.error("[listener] sales error:", err);
      onError?.(err);
    },
  );
  return subs.sales;
}

/** Subscribe to the credit customers sub-collection. */
export function subscribeCustomers(
  storeId: string,
  onUpdate: (customers: CreditCustomer[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  subs.customers?.();
  subs.customers = onSnapshot(
    collection(db, "stores", storeId, "creditCustomers"),
    (snap) => onUpdate(snap.docs.map((d) => d.data() as CreditCustomer)),
    (err) => {
      console.error("[listener] customers error:", err);
      onError?.(err);
    },
  );
  return subs.customers;
}

/** Subscribe to the credit transactions sub-collection (latest 1000). */
export function subscribeTransactions(
  storeId: string,
  onUpdate: (txs: CreditTransaction[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  subs.transactions?.();
  subs.transactions = onSnapshot(
    query(
      collection(db, "stores", storeId, "creditTransactions"),
      orderBy("createdAt", "desc"),
      limit(1000),
    ),
    (snap) => onUpdate(snap.docs.map((d) => d.data() as CreditTransaction)),
    (err) => {
      console.error("[listener] transactions error:", err);
      onError?.(err);
    },
  );
  return subs.transactions;
}

/** Cancel ALL active listeners — call on logout or store change. */
export function unsubscribeAll() {
  Object.values(subs).forEach((u) => u?.());
  Object.keys(subs).forEach((k) => delete subs[k]);
}
