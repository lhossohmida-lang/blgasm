import Dexie from "dexie";

/**
 * قاعدة البيانات المحلية — تعمل بدون إنترنت عبر IndexedDB (Dexie.js)
 * تحتوي على جميع جداول التطبيق مع حقول المزامنة الضرورية.
 */
export const offlineDb = new Dexie("blgasm_offline");

offlineDb.version(1).stores({
  products:
    "id, barcode, category, syncStatus, deletedAt, updatedAt, expiryDate",
  sales: "id, invoiceNumber, syncStatus, deletedAt, createdAt",
  customers: "id, phone, syncStatus, deletedAt, updatedAt",
  activityLogs: "id, type, createdAt, syncStatus",
  syncQueue:
    "++operationId, collectionName, documentId, actionType, status, createdAt",
  pendingImages: "id, productId, uploadStatus, createdAt",
  settings: "key",
});

/* ─── Utilities ─────────────────────────────────────────────── */

/** حفظ مجموعة سجلات قادمة من Firestore إلى IndexedDB */
export async function saveCollectionToLocal(tableName, items) {
  try {
    const table = offlineDb.table(tableName);
    const toSave = items.map((item) => ({
      ...normalizeItem(item),
      synced: true,
      syncStatus: "synced",
    }));
    await table.bulkPut(toSave);
  } catch {
    /* الجدول غير موجود أو خطأ غير حرج */
  }
}

/** تحميل البيانات من IndexedDB (مع استبعاد المحذوفات) */
export async function loadCollectionFromLocal(tableName, sortField = "createdAt") {
  try {
    const table = offlineDb.table(tableName);
    const items = await table.filter((item) => !item.deletedAt).toArray();
    return sortByField(items, sortField);
  } catch {
    return [];
  }
}

/** كتابة سجل واحد إلى IndexedDB */
export async function putLocalRecord(tableName, record) {
  try {
    const table = offlineDb.table(tableName);
    await table.put(normalizeItem(record));
  } catch { /* غير حرج */ }
}

/** حذف ناعم: يضع deletedAt بدلاً من الحذف الفعلي لضمان المزامنة */
export async function softDeleteLocalRecord(tableName, id) {
  try {
    const table = offlineDb.table(tableName);
    const item = await table.get(id);
    if (item) {
      await table.put({
        ...item,
        deletedAt: new Date().toISOString(),
        syncStatus: "pending",
        synced: false,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch { /* غير حرج */ }
}

/** حذف فعلي من IndexedDB بعد نجاح المزامنة */
export async function hardDeleteLocalRecord(tableName, id) {
  try {
    const table = offlineDb.table(tableName);
    await table.delete(id);
  } catch { /* غير حرج */ }
}

/** تحديث حقول محددة في سجل */
export async function updateLocalRecord(tableName, id, fields) {
  try {
    const table = offlineDb.table(tableName);
    await table.update(id, { ...fields, updatedAt: new Date().toISOString() });
  } catch { /* غير حرج */ }
}

/* ─── Helpers ────────────────────────────────────────────────── */

/** تحويل Firestore timestamps إلى strings متوافقة مع IndexedDB */
function normalizeItem(item) {
  const norm = { ...item };
  for (const key of ["createdAt", "updatedAt", "deletedAt", "lastPurchaseAt", "lastPaymentAt"]) {
    if (norm[key]?.toDate) {
      norm[key] = norm[key].toDate().toISOString();
    } else if (norm[key] instanceof Date) {
      norm[key] = norm[key].toISOString();
    }
  }
  return norm;
}

function sortByField(items, field) {
  return items.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return String(bv).localeCompare(String(av));
  });
}
