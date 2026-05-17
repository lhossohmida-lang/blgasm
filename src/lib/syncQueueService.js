import { offlineDb } from "./offlineDb";

/**
 * خدمة قائمة انتظار المزامنة.
 * كل عملية تتم أوفلاين تُحفظ هنا وتُنفَّذ لاحقاً عند عودة الإنترنت.
 *
 * بنية كل عملية:
 *   operationId  — مفتاح تسلسلي تلقائي
 *   collectionName — اسم المجموعة (products, sales, customers...)
 *   documentId   — معرّف الوثيقة
 *   actionType   — "create" | "update" | "delete" | "createSale" | "recordPayment" | "receiveStock"
 *   payload      — البيانات الكاملة للعملية
 *   createdAt    — توقيت الإنشاء (ISO string)
 *   retryCount   — عدد محاولات إعادة الإرسال
 *   status       — "pending" | "processing" | "failed"
 */

/** أضف عملية جديدة إلى قائمة الانتظار */
export async function addToSyncQueue({ collectionName, documentId, actionType, payload }) {
  await offlineDb.syncQueue.add({
    collectionName,
    documentId,
    actionType,
    payload: JSON.parse(JSON.stringify(payload ?? {})), // deep clone لتجنب المراجع
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
  });
}

/** احصل على كل العمليات المعلقة أو الفاشلة بالترتيب الزمني */
export async function getPendingOperations() {
  return offlineDb.syncQueue
    .where("status")
    .anyOf(["pending", "failed"])
    .sortBy("createdAt");
}

/** احصل على عدد العمليات المعلقة */
export async function getPendingCount() {
  return offlineDb.syncQueue
    .where("status")
    .anyOf(["pending", "failed"])
    .count();
}

/** علّم العملية كمكتملة واحذفها من القائمة */
export async function markOperationSynced(operationId) {
  await offlineDb.syncQueue.delete(operationId);
}

/** علّم العملية كفاشلة وأضف محاولة جديدة */
export async function markOperationFailed(operationId) {
  const op = await offlineDb.syncQueue.get(operationId);
  if (op) {
    await offlineDb.syncQueue.update(operationId, {
      status: "failed",
      retryCount: (op.retryCount || 0) + 1,
      lastError: new Date().toISOString(),
    });
  }
}

/** غيّر حالة العملية إلى processing لمنع التنفيذ المزدوج */
export async function markOperationProcessing(operationId) {
  await offlineDb.syncQueue.update(operationId, { status: "processing" });
}

/** أعد العمليات الفاشلة إلى pending لإعادة المحاولة */
export async function resetFailedOperations() {
  const failed = await offlineDb.syncQueue.where("status").equals("failed").toArray();
  for (const op of failed) {
    if ((op.retryCount || 0) < 5) {
      await offlineDb.syncQueue.update(op.operationId, { status: "pending" });
    }
  }
}

/** احصل على إحصائيات القائمة */
export async function getSyncQueueStats() {
  const all = await offlineDb.syncQueue.toArray();
  return {
    total: all.length,
    pending: all.filter((o) => o.status === "pending").length,
    failed: all.filter((o) => o.status === "failed").length,
    processing: all.filter((o) => o.status === "processing").length,
  };
}
