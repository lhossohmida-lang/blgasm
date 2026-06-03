"use client";

import {
  deleteCreditCustomer,
  deleteProduct,
  deleteSale,
  ensureStore,
  writeCreditCustomer,
  writeCreditTransaction,
  writeProduct,
  writeSale,
  writeSyncOperation,
} from "@/lib/firebase/firestore";
import type {
  CreditCustomer,
  CreditTransaction,
  Product,
  Sale,
  StoreProfile,
  SyncOperation,
} from "@/types";

export async function flushSyncQueue(storeId: string, queue: SyncOperation[]) {
  const results: SyncOperation[] = [];

  for (const operation of queue) {
    if (operation.status === "synced") {
      results.push(operation);
      continue;
    }

    try {
      switch (operation.operationType) {
        case "store.upsert":
          await ensureStore(operation.payload as StoreProfile);
          break;
        case "product.upsert":
          await writeProduct(storeId, operation.payload as Product);
          break;
        case "product.delete":
          await deleteProduct(storeId, String(operation.entityId));
          break;
        case "sale.create":
          await writeSale(storeId, operation.payload as Sale);
          break;
        case "sale.delete":
          await deleteSale(storeId, String(operation.entityId));
          break;
        case "customer.upsert":
          await writeCreditCustomer(storeId, operation.payload as CreditCustomer);
          break;
        case "customer.delete":
          await deleteCreditCustomer(storeId, String(operation.entityId));
          break;
        case "transaction.create":
          await writeCreditTransaction(storeId, operation.payload as CreditTransaction);
          break;
      }

      const synced: SyncOperation = {
        ...operation,
        status: "synced",
        retries: operation.retries + 1,
        lastError: undefined,
        syncedAt: new Date().toISOString(),
      };
      await writeSyncOperation(storeId, synced);
      results.push(synced);
    } catch (error) {
      const failed: SyncOperation = {
        ...operation,
        status: "failed",
        retries: operation.retries + 1,
        lastError: error instanceof Error ? error.message : "Unknown sync error",
      };
      results.push(failed);
    }
  }

  return results;
}
