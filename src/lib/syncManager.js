import {
  collection,
  deleteDoc,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { hardDeleteLocalRecord, offlineDb, updateLocalRecord } from "./offlineDb";
import { processPendingImages } from "./imageUploadService";
import {
  getPendingOperations,
  markOperationFailed,
  markOperationProcessing,
  markOperationSynced,
  resetFailedOperations,
} from "./syncQueueService";

let isSyncing = false;

/**
 * نفّذ جميع العمليات المعلقة في syncQueue على Firestore.
 * يُستدعى عند عودة الإنترنت أو عند بدء التطبيق.
 *
 * @param {Function} onProgress — callback لإرسال حالة المزامنة للواجهة
 */
export async function processSyncQueue(onProgress) {
  if (isSyncing || !navigator.onLine) return;

  isSyncing = true;
  onProgress?.({ status: "syncing", pending: 0 });

  try {
    await resetFailedOperations();
    const operations = await getPendingOperations();

    if (operations.length === 0) {
      onProgress?.({ status: "synced", synced: 0, failed: 0 });
      isSyncing = false;
      return;
    }

    let synced = 0;
    let failed = 0;

    for (const op of operations) {
      try {
        await markOperationProcessing(op.operationId);
        await executeOperation(op);
        await markOperationSynced(op.operationId);
        synced++;
      } catch (err) {
        console.error("[syncManager] فشلت العملية:", op.actionType, op.documentId, err.message);
        await markOperationFailed(op.operationId);
        failed++;
      }
    }

    // رفع الصور المؤجلة
    try { await processPendingImages(); } catch { /* غير حرج */ }

    if (failed === 0) {
      onProgress?.({ status: "synced", synced, failed: 0 });
    } else {
      onProgress?.({ status: "partial", synced, failed });
    }
  } catch (err) {
    console.error("[syncManager] خطأ عام:", err);
    onProgress?.({ status: "error" });
  } finally {
    isSyncing = false;
  }
}

/** تنفيذ عملية واحدة من القائمة على Firestore */
async function executeOperation(op) {
  const { collectionName, documentId, actionType, payload } = op;

  switch (actionType) {
    case "create":
    case "update": {
      const ref = doc(db, collectionName, documentId);
      const clean = toFirestorePayload(payload);
      if (actionType === "create") {
        await setDoc(ref, { ...clean, updatedAt: serverTimestamp() });
      } else {
        await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
      }
      await updateLocalRecord(collectionName, documentId, { synced: true, syncStatus: "synced" });
      break;
    }

    case "delete": {
      await deleteDoc(doc(db, collectionName, documentId));
      await hardDeleteLocalRecord(collectionName, documentId);
      break;
    }

    case "createSale": {
      await executeSaleTransaction(payload);
      break;
    }

    case "recordPayment": {
      await executePaymentTransaction(payload);
      break;
    }

    case "receiveStock": {
      const { productId, qty } = payload;
      await updateDoc(doc(db, "products", productId), {
        quantity: increment(qty),
        updatedAt: serverTimestamp(),
      });
      await updateLocalRecord("products", productId, { synced: true, syncStatus: "synced" });
      break;
    }

    default:
      throw new Error(`نوع عملية غير معروف: ${actionType}`);
  }
}

/** تنفيذ عملية بيع كاملة كـ Firestore transaction */
async function executeSaleTransaction({ saleId, saleData, cartItems, customer }) {
  await runTransaction(db, async (tx) => {
    // تحقق من الكميات وحدّثها
    for (const item of cartItems) {
      const ref = doc(db, "products", item.productId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error(`المنتج غير موجود: ${item.name}`);
      const current = snap.data().quantity || 0;
      if (current < item.quantity) throw new Error(`الكمية غير متوفرة: ${item.name}`);
      tx.update(ref, { quantity: current - item.quantity, updatedAt: serverTimestamp() });
    }

    // احفظ الفاتورة
    const saleRef = doc(db, "sales", saleId);
    tx.set(saleRef, { ...toFirestorePayload(saleData), updatedAt: serverTimestamp() });

    // حدّث الزبون (كريديت)
    if (customer?.id) {
      const cRef = doc(db, "customers", customer.id);
      tx.update(cRef, {
        totalDebt: increment(saleData.total),
        lastPurchaseAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const txRef = doc(collection(db, "customers", customer.id, "transactions"));
      tx.set(txRef, {
        type: "purchase",
        amount: saleData.total,
        invoiceId: saleId,
        note: `فاتورة #${saleData.invoiceNumber}`,
        balanceAfter: (customer.totalDebt || 0) + saleData.total,
        createdAt: serverTimestamp(),
      });
    }
  });

  // حدّث الحالة محلياً
  await updateLocalRecord("sales", saleId, { synced: true, syncStatus: "synced" });
  for (const item of cartItems) {
    await updateLocalRecord("products", item.productId, { synced: true, syncStatus: "synced" });
  }
}

/** تنفيذ تسجيل دفعة كـ Firestore transaction */
async function executePaymentTransaction({ customerId, customerName, amount, note, newDebt, paymentId }) {
  await runTransaction(db, async (tx) => {
    const cRef = doc(db, "customers", customerId);
    tx.update(cRef, {
      totalDebt: newDebt,
      lastPaymentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const payRef = doc(db, "payments", paymentId);
    tx.set(payRef, {
      customerId, customerName, amount, note: note || "",
      createdAt: serverTimestamp(),
    });
    const txRef = doc(collection(db, "customers", customerId, "transactions"));
    tx.set(txRef, {
      type: "payment", amount,
      invoiceId: null, note: note || "دفعة كريديت",
      balanceAfter: newDebt, createdAt: serverTimestamp(),
    });
  });
  await updateLocalRecord("customers", customerId, { synced: true, syncStatus: "synced" });
}

/** تنظيف الحقول غير المتوافقة مع Firestore */
function toFirestorePayload(payload) {
  const clean = { ...payload };
  // احذف الحقول الخاصة بالتخزين المحلي
  delete clean.synced;
  delete clean.syncStatus;
  delete clean.localOnly;
  delete clean.id; // Firestore يحفظه كـ document ID
  return clean;
}

/** هل المزامنة جارية حالياً؟ */
export function isSyncRunning() {
  return isSyncing;
}
