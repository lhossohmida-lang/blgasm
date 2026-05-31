"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AppData, SyncOperation } from "@/types";

interface BlgasmDb extends DBSchema {
  appData: {
    key: string;
    value: AppData;
  };
  syncQueue: {
    key: string;
    value: SyncOperation & { storeId: string };
    indexes: {
      byStore: string;
      byStatus: string;
    };
  };
}

const DB_NAME = "blgasm-offline-first";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BlgasmDb>> | undefined;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is available only in the browser.");
  }

  dbPromise ??= openDB<BlgasmDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("appData")) {
        db.createObjectStore("appData");
      }

      if (!db.objectStoreNames.contains("syncQueue")) {
        const queue = db.createObjectStore("syncQueue", { keyPath: "id" });
        queue.createIndex("byStore", "storeId");
        queue.createIndex("byStatus", "status");
      }
    },
  });

  return dbPromise;
}

export async function getLocalAppData(storeId: string) {
  const db = await getDb();
  return db.get("appData", storeId);
}

export async function saveLocalAppData(data: AppData) {
  const db = await getDb();
  await db.put("appData", data, data.store.id);
}

export async function enqueueLocalOperation(storeId: string, operation: SyncOperation) {
  const db = await getDb();
  await db.put("syncQueue", { ...operation, storeId });
}

export async function getLocalQueue(storeId: string) {
  const db = await getDb();
  return db.getAllFromIndex("syncQueue", "byStore", storeId);
}

export async function replaceLocalQueue(storeId: string, queue: SyncOperation[]) {
  const db = await getDb();
  const tx = db.transaction("syncQueue", "readwrite");
  const existing = await tx.store.index("byStore").getAllKeys(storeId);
  await Promise.all(existing.map((key) => tx.store.delete(key)));
  await Promise.all(queue.map((operation) => tx.store.put({ ...operation, storeId })));
  await tx.done;
}

export function createSyncOperation(
  operationType: SyncOperation["operationType"],
  payload: unknown,
  entityId?: string,
): SyncOperation {
  return {
    id: crypto.randomUUID(),
    operationType,
    entityId,
    payload,
    status: "pending",
    retries: 0,
    createdAt: new Date().toISOString(),
  };
}
