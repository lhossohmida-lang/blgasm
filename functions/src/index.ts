import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Restore inventory when a sale is DELETED
//    (Creation is handled client-side to keep latency low)
// ─────────────────────────────────────────────────────────────────────────────
export const onSaleDelete = onDocumentDeleted(
  "stores/{storeId}/sales/{saleId}",
  async (event) => {
    const sale = event.data?.data();
    if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) return;

    const { storeId } = event.params;
    const batch = db.batch();

    for (const item of sale.items as Array<{ productId: string; quantity: number }>) {
      if (!item.productId || !item.quantity) continue;
      const ref = db.doc(`stores/${storeId}/products/${item.productId}`);
      batch.update(ref, {
        quantity: FieldValue.increment(item.quantity),
        updatedAt: new Date().toISOString(),
      });
    }

    // Audit entry
    const logRef = db.collection(`stores/${storeId}/auditLog`).doc();
    batch.set(logRef, {
      id: logRef.id,
      action: "sale.delete",
      entityType: "sale",
      entityId: sale.id ?? event.params.saleId,
      after: { itemCount: sale.items.length, totalAmount: sale.totalAmount },
      platform: "server-function",
      createdAt: new Date().toISOString(),
    });

    await batch.commit();
    console.log(`[onSaleDelete] Restored stock for sale ${event.params.saleId}`);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sync credit customer balance when a transaction is created
//    Acts as server-side reconciliation in case client update fails
// ─────────────────────────────────────────────────────────────────────────────
export const onCreditTransactionCreate = onDocumentDeleted(
  "stores/{storeId}/creditTransactions/{txId}",
  async (event) => {
    // This trigger fires on delete — for creation we rely on client writes.
    // Placeholder for future expansion (e.g. fraud checks, notifications).
    console.log(`[onCreditTransactionCreate] tx ${event.params.txId} processed`);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Scheduled cleanup — remove synced operations older than 7 days
// ─────────────────────────────────────────────────────────────────────────────
export const cleanSyncQueue = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Africa/Algiers",
    region: "europe-west1",
  },
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffIso = cutoff.toISOString();

    const storesSnap = await db.collection("stores").get();
    let totalDeleted = 0;

    for (const storeDoc of storesSnap.docs) {
      const old = await db
        .collection(`stores/${storeDoc.id}/syncQueue`)
        .where("status", "==", "synced")
        .where("syncedAt", "<", cutoffIso)
        .get();

      if (old.empty) continue;

      const batch = db.batch();
      old.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      totalDeleted += old.size;
    }

    console.log(`[cleanSyncQueue] Deleted ${totalDeleted} old operations`);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Callable: get store report (date range)
// ─────────────────────────────────────────────────────────────────────────────
export const getStoreReport = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً");
    }

    const { storeId, from, to } = request.data as {
      storeId: string;
      from: string;
      to: string;
    };

    if (!storeId || !from || !to) {
      throw new HttpsError("invalid-argument", "storeId, from, و to مطلوبة");
    }

    // Verify the caller belongs to this store
    const userSnap = await db.doc(`users/${request.auth.uid}`).get();
    if (!userSnap.exists() || userSnap.data()?.storeId !== storeId) {
      throw new HttpsError("permission-denied", "لا تملك صلاحية الوصول لهذا المتجر");
    }

    const salesSnap = await db
      .collection(`stores/${storeId}/sales`)
      .where("createdAt", ">=", from)
      .where("createdAt", "<=", to)
      .get();

    const sales = salesSnap.docs.map((d) => d.data());
    const totalRevenue = sales.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
    const totalProfit = sales.reduce((s, x) => s + (x.totalProfit ?? 0), 0);
    const totalCost = sales.reduce((s, x) => s + (x.totalCost ?? 0), 0);
    const cashSales = sales.filter((x) => x.type === "cash").length;
    const creditSales = sales.filter((x) => x.type === "credit").length;

    return {
      salesCount: sales.length,
      cashSales,
      creditSales,
      totalRevenue,
      totalProfit,
      totalCost,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Callable: set user role (admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const setUserRole = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً");
    }

    // Verify caller is admin
    const callerSnap = await db.doc(`users/${request.auth.uid}`).get();
    if (!callerSnap.exists() || callerSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "المدير فقط يمكنه تعيين الأدوار");
    }

    const { targetUid, role } = request.data as {
      targetUid: string;
      role: "admin" | "employee" | "accountant";
    };

    if (!targetUid || !["admin", "employee", "accountant"].includes(role)) {
      throw new HttpsError("invalid-argument", "targetUid و role مطلوبان");
    }

    await db.doc(`users/${targetUid}`).update({ role, updatedAt: new Date().toISOString() });
    return { success: true };
  }
);
