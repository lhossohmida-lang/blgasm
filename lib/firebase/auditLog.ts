"use client";

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";

export type AuditAction =
  | "product.create"
  | "product.update"
  | "product.delete"
  | "sale.create"
  | "sale.delete"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "payment.create"
  | "store.update";

export type AuditPlatform = "web" | "desktop" | "android";

export interface AuditEntry {
  userId: string;
  userEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  platform: AuditPlatform;
}

/** Detect which platform this code is running on */
function detectPlatform(): AuditPlatform {
  if (typeof window === "undefined") return "web";
  // Electron exposes process.versions.electron in the renderer
  if (
    typeof (window as { process?: { versions?: { electron?: string } } }).process
      ?.versions?.electron === "string"
  ) {
    return "desktop";
  }
  // Capacitor sets a global flag
  if (typeof (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    ?.isNativePlatform === "function") {
    return "android";
  }
  return "web";
}

/**
 * Write an audit log entry to Firestore.
 * Silently swallows errors — audit logging should never block the main flow.
 */
export async function writeAuditLog(
  storeId: string,
  entry: AuditEntry,
): Promise<void> {
  try {
    await addDoc(collection(db, "stores", storeId, "auditLog"), {
      ...entry,
      platform: entry.platform ?? detectPlatform(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-blocking — log to console only
    console.warn("[auditLog] Failed to write entry:", err);
  }
}
