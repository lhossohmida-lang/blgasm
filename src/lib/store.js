import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { uploadProductImage } from "./imageUploadService";
import { kgToGrams } from "./weightUtils";
import {
  hardDeleteLocalRecord,
  loadCollectionFromLocal,
  offlineDb,
  putLocalRecord,
  softDeleteLocalRecord,
  updateLocalRecord,
} from "./offlineDb";
import { addToSyncQueue } from "./syncQueueService";

export const categories = ["مواد أساسية", "مشروبات", "حلويات", "منظفات", "ألبان", "أخرى"];
export const units = ["قطعة", "كغ", "غرام", "لتر", "علبة", "كرتونة", "كيس"];

/** مرجع للمجموعة في Firestore */
export function collectionRef(name) {
  return collection(db, name);
}

/* ══════════════════════════════════════════════
   المنتجات
══════════════════════════════════════════════ */

/**
 * حفظ منتج (إضافة أو تعديل) — Offline-First.
 * تكتب فوراً في IndexedDB، ثم في Firestore إذا كان متصلاً.
 */
export async function saveProduct(values, file, id) {
  const docId = id || doc(collectionRef("products")).id;
  const now = new Date().toISOString();

  // رفع الصورة (Cloudinary أو أوفلاين)
  let imageUrl = values.imageUrl || "";
  let imagePending = false;

  if (file) {
    const uploaded = await uploadProductImage(file, docId);
    if (uploaded) {
      imageUrl = uploaded;
    } else {
      imagePending = true; // محفوظة محلياً بانتظار الرفع
    }
  }

  const isWeightBased = Boolean(values.isWeightBased);
  const payload = {
    id: docId,
    name: String(values.name || "").trim(),
    barcode: String(values.barcode || "").trim(),
    qrCode: String(values.qrCode || values.barcode || "").trim(),
    category: values.category || "مواد أساسية",
    purchasePrice: Number(values.purchasePrice || 0),
    salePrice: Number(values.salePrice || 0),
    quantity: Number(values.quantity || 0),
    unit: isWeightBased ? "كغ" : (values.unit || "قطعة"),
    minimumStock: Number(values.minimumStock || 0),
    expiryDate: values.expiryDate || null,
    supplier: values.supplier || "",
    isWeightBased,
    // للمنتجات الوزنية: تحويل الكمية (بالكغ) إلى غرام للتخزين الداخلي
    stockInGrams: isWeightBased ? kgToGrams(values.quantity) : null,
    imageUrl,
    imagePending,
    updatedAt: now,
    ...(id ? {} : { createdAt: now }),
  };

  // ① كتابة فورية في IndexedDB
  await putLocalRecord("products", {
    ...payload,
    synced: false,
    syncStatus: "pending",
  });

  if (navigator.onLine) {
    // ② كتابة مباشرة في Firestore
    try {
      const ref = doc(db, "products", docId);
      const fsPayload = toFirestorePayload(payload);
      if (id) {
        await updateDoc(ref, { ...fsPayload, updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, { ...fsPayload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      await updateLocalRecord("products", docId, { synced: true, syncStatus: "synced" });
      await logActivity("product", id ? "تعديل منتج" : "إضافة منتج", `${id ? "تعديل" : "إضافة"}: ${payload.name}`);
    } catch (err) {
      // إذا فشل Firestore، أضف للقائمة
      await addToSyncQueue({
        collectionName: "products",
        documentId: docId,
        actionType: id ? "update" : "create",
        payload,
      });
      console.warn("[store] Firestore error, queued:", err.message);
    }
  } else {
    // ③ أوفلاين: أضف للقائمة
    await addToSyncQueue({
      collectionName: "products",
      documentId: docId,
      actionType: id ? "update" : "create",
      payload,
    });
  }

  return docId;
}

/** حذف منتج — حذف ناعم أوفلاين، حذف فعلي إذا كان متصلاً */
export async function deleteProduct(id) {
  // ① حذف ناعم في IndexedDB (يخفيه من الواجهة فوراً)
  await softDeleteLocalRecord("products", id);

  if (navigator.onLine) {
    try {
      await deleteDoc(doc(db, "products", id));
      await hardDeleteLocalRecord("products", id);
      await logActivity("product", "حذف منتج", "تم حذف منتج من المخزون");
    } catch {
      await addToSyncQueue({ collectionName: "products", documentId: id, actionType: "delete", payload: {} });
    }
  } else {
    await addToSyncQueue({ collectionName: "products", documentId: id, actionType: "delete", payload: {} });
  }
}

/** استلام كمية جديدة عبر QR */
export async function receiveProductStock({ productId, productName, quantity, note }) {
  const value = Number(quantity || 0);
  if (!productId) throw new Error("لم يتم تحديد المنتج");
  if (value <= 0) throw new Error("الكمية غير صحيحة");

  // ① تحديث IndexedDB فوراً
  const local = await offlineDb.products.get(productId);
  if (local) {
    const newQty = (local.quantity || 0) + value;
    await offlineDb.products.update(productId, {
      quantity: newQty,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending",
      synced: false,
    });
  }

  if (navigator.onLine) {
    try {
      await updateDoc(doc(db, "products", productId), {
        quantity: increment(value),
        updatedAt: serverTimestamp(),
      });
      await updateLocalRecord("products", productId, { synced: true, syncStatus: "synced" });
      await logActivity(
        "stock-in",
        "استلام مخزون عبر QR",
        `${productName} +${value}${note ? ` - ${note}` : ""}`
      );
    } catch {
      await addToSyncQueue({
        collectionName: "products",
        documentId: productId,
        actionType: "receiveStock",
        payload: { productId, qty: value },
      });
    }
  } else {
    await addToSyncQueue({
      collectionName: "products",
      documentId: productId,
      actionType: "receiveStock",
      payload: { productId, qty: value },
    });
  }
}

/* ══════════════════════════════════════════════
   الزبائن
══════════════════════════════════════════════ */

export async function saveCustomer(values, id) {
  if (!String(values.name || "").trim()) throw new Error("اسم الزبون مطلوب");
  if (!String(values.phone || "").trim()) throw new Error("رقم الهاتف مطلوب");

  const docId = id || doc(collectionRef("customers")).id;
  const now = new Date().toISOString();

  const payload = {
    id: docId,
    name: String(values.name || "").trim(),
    phone: String(values.phone || "").trim(),
    address: String(values.address || "").trim(),
    notes: String(values.notes || "").trim(),
    totalDebt: Number(values.totalDebt || 0),
    updatedAt: now,
    ...(id ? {} : { createdAt: now }),
  };

  await putLocalRecord("customers", { ...payload, synced: false, syncStatus: "pending" });

  if (navigator.onLine) {
    try {
      const ref = doc(db, "customers", docId);
      const fsPayload = toFirestorePayload(payload);
      if (id) {
        await updateDoc(ref, { ...fsPayload, updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, { ...fsPayload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      await updateLocalRecord("customers", docId, { synced: true, syncStatus: "synced" });
      if (!id) await logActivity("customer", "إضافة زبون", `تم إضافة ${payload.name}`);
    } catch (err) {
      await addToSyncQueue({
        collectionName: "customers",
        documentId: docId,
        actionType: id ? "update" : "create",
        payload,
      });
      // أعِد رمي الخطأ فقط إذا كنا أونلاين وفشل الاتصال
      throw new Error("تعذر حفظ الزبون. تأكد من الاتصال بالإنترنت أو انتظر المزامنة.");
    }
  } else {
    await addToSyncQueue({
      collectionName: "customers",
      documentId: docId,
      actionType: id ? "update" : "create",
      payload,
    });
  }

  return docId;
}

export async function deleteCustomer(id) {
  await softDeleteLocalRecord("customers", id);

  if (navigator.onLine) {
    try {
      await deleteDoc(doc(db, "customers", id));
      await hardDeleteLocalRecord("customers", id);
    } catch {
      await addToSyncQueue({ collectionName: "customers", documentId: id, actionType: "delete", payload: {} });
    }
  } else {
    await addToSyncQueue({ collectionName: "customers", documentId: id, actionType: "delete", payload: {} });
  }
}

/* ══════════════════════════════════════════════
   المبيعات
══════════════════════════════════════════════ */

export async function createSale({ cart, discount, paymentMethod, customer, cashierId }) {
  if (!cart.length) throw new Error("السلة فارغة");

  const invoiceNumber = String(Date.now()).slice(-6);
  // للمنتجات الوزنية cartQty=1 وsalePrice=السعر المحسوب، فالضرب صحيح للجميع
  const subtotal = cart.reduce((sum, item) => sum + item.salePrice * item.cartQty, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const now = new Date().toISOString();

  // توليد ID محلي متوافق مع Firestore
  const saleId = doc(collectionRef("sales")).id;

  const saleData = {
    id: saleId,
    invoiceNumber,
    items: cart.map((item) => ({
      productId: item.id,
      name: item.name,
      barcode: item.barcode || "",
      qrCode: item.qrCode || item.barcode || "",
      quantity: item.isWeightBased ? item.weightGrams : item.cartQty,
      unit: item.unit,
      purchasePrice: item.purchasePrice,
      salePrice: item.salePrice,
      total: item.salePrice * item.cartQty,
      isWeightBased: item.isWeightBased || false,
      weightGrams: item.weightGrams || null,
    })),
    subtotal,
    discount: Number(discount || 0),
    total,
    paymentMethod,
    customerId: paymentMethod === "credit" ? customer?.id : null,
    customerName: paymentMethod === "credit" ? customer?.name : null,
    paidAmount: paymentMethod === "cash" ? total : 0,
    remainingAmount: paymentMethod === "credit" ? total : 0,
    cashierId,
    createdAt: now,
    updatedAt: now,
  };

  // ① كتابة البيع في IndexedDB
  await putLocalRecord("sales", { ...saleData, synced: false, syncStatus: "pending" });

  // ② تحديث كميات المنتجات محلياً
  for (const item of cart) {
    const local = await offlineDb.products.get(item.id);
    if (local) {
      if (item.isWeightBased) {
        // خصم الغرامات من stockInGrams
        const newGrams = Math.max(0, (local.stockInGrams || 0) - (item.weightGrams || 0));
        await offlineDb.products.update(item.id, {
          stockInGrams: newGrams,
          quantity: Math.round(newGrams / 1000 * 100) / 100, // تحديث الكغ تقريباً
          updatedAt: now,
          syncStatus: "pending",
          synced: false,
        });
      } else {
        await offlineDb.products.update(item.id, {
          quantity: Math.max(0, (local.quantity || 0) - item.cartQty),
          updatedAt: now,
          syncStatus: "pending",
          synced: false,
        });
      }
    }
  }

  // ③ تحديث دين الزبون محلياً (كريديت)
  if (paymentMethod === "credit" && customer?.id) {
    const localCustomer = await offlineDb.customers.get(customer.id);
    if (localCustomer) {
      await offlineDb.customers.update(customer.id, {
        totalDebt: (localCustomer.totalDebt || 0) + total,
        lastPurchaseAt: now,
        updatedAt: now,
        syncStatus: "pending",
        synced: false,
      });
    }
  }

  if (navigator.onLine) {
    // ④ تنفيذ Firestore transaction مباشرة
    try {
      const saleRef = doc(db, "sales", saleId);
      await runTransaction(db, async (transaction) => {
        // تحقق من الكميات في Firestore وخصمها
        for (const item of cart) {
          const productRef = doc(db, "products", item.id);
          const snap = await transaction.get(productRef);
          if (!snap.exists()) throw new Error(`المنتج غير موجود: ${item.name}`);
          if (item.isWeightBased) {
            const currentGrams = snap.data().stockInGrams || 0;
            const needed = item.weightGrams || 0;
            if (currentGrams < needed)
              throw new Error(`الكمية غير كافية: ${item.name} (متوفر: ${currentGrams}غ، مطلوب: ${needed}غ)`);
            transaction.update(productRef, {
              stockInGrams: currentGrams - needed,
              quantity: Math.round((currentGrams - needed) / 1000 * 100) / 100,
              updatedAt: serverTimestamp(),
            });
          } else {
            const current = snap.data().quantity || 0;
            if (current < item.cartQty) throw new Error(`الكمية غير متوفرة: ${item.name}`);
            transaction.update(productRef, { quantity: current - item.cartQty, updatedAt: serverTimestamp() });
          }
        }

        const fsPayload = toFirestorePayload(saleData);
        transaction.set(saleRef, { ...fsPayload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

        if (paymentMethod === "credit" && customer?.id) {
          const cRef = doc(db, "customers", customer.id);
          transaction.update(cRef, {
            totalDebt: increment(total),
            lastPurchaseAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const txRef = doc(collection(db, "customers", customer.id, "transactions"));
          transaction.set(txRef, {
            type: "purchase",
            amount: total,
            invoiceId: saleId,
            note: `فاتورة #${invoiceNumber}`,
            balanceAfter: (customer.totalDebt || 0) + total,
            createdAt: serverTimestamp(),
          });
        }
      });

      await updateLocalRecord("sales", saleId, { synced: true, syncStatus: "synced" });
      await logActivity("sale", "عملية بيع", `تمت عملية بيع بمبلغ ${total}`);
    } catch (err) {
      // إذا فشل الـ transaction، استخدم القائمة
      await addToSyncQueue({
        collectionName: "sales",
        documentId: saleId,
        actionType: "createSale",
        payload: {
          saleId,
          saleData,
          cartItems: cart.map((i) => ({ productId: i.id, name: i.name, quantity: i.cartQty })),
          customer: customer ? { id: customer.id, name: customer.name, totalDebt: customer.totalDebt } : null,
        },
      });
      console.warn("[store] Sale transaction queued:", err.message);
    }
  } else {
    // ⑤ أوفلاين: أضف للقائمة
    await addToSyncQueue({
      collectionName: "sales",
      documentId: saleId,
      actionType: "createSale",
      payload: {
        saleId,
        saleData,
        cartItems: cart.map((i) => ({ productId: i.id, name: i.name, quantity: i.cartQty })),
        customer: customer ? { id: customer.id, name: customer.name, totalDebt: customer.totalDebt } : null,
      },
    });
  }

  return { id: saleId, ...saleData };
}

/* ══════════════════════════════════════════════
   الدفعات
══════════════════════════════════════════════ */

export async function recordPayment({ customer, amount, note }) {
  const value = Number(amount || 0);
  if (!customer?.id) throw new Error("اختر الزبون");
  if (value <= 0) throw new Error("المبلغ غير صحيح");
  if (value > Number(customer.totalDebt || 0)) throw new Error("لا يمكن أن يصبح الدين سالبًا");

  const now = new Date().toISOString();
  const newDebt = Number(customer.totalDebt || 0) - value;
  const paymentId = doc(collectionRef("payments")).id;

  // ① تحديث IndexedDB
  const localCustomer = await offlineDb.customers.get(customer.id);
  if (localCustomer) {
    await offlineDb.customers.update(customer.id, {
      totalDebt: newDebt,
      lastPaymentAt: now,
      updatedAt: now,
      syncStatus: "pending",
      synced: false,
    });
  }

  if (navigator.onLine) {
    try {
      await runTransaction(db, async (transaction) => {
        const cRef = doc(db, "customers", customer.id);
        transaction.update(cRef, {
          totalDebt: newDebt,
          lastPaymentAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const payRef = doc(db, "payments", paymentId);
        transaction.set(payRef, {
          customerId: customer.id,
          customerName: customer.name,
          amount: value,
          note: note || "",
          createdAt: serverTimestamp(),
        });
        const txRef = doc(collection(db, "customers", customer.id, "transactions"));
        transaction.set(txRef, {
          type: "payment", amount: value, invoiceId: null,
          note: note || "دفعة كريديت", balanceAfter: newDebt,
          createdAt: serverTimestamp(),
        });
      });
      await updateLocalRecord("customers", customer.id, { synced: true, syncStatus: "synced" });
      await logActivity("payment", "دفعة كريديت", `تم تحصيل دفعة من ${customer.name}`);
    } catch {
      await addToSyncQueue({
        collectionName: "payments",
        documentId: paymentId,
        actionType: "recordPayment",
        payload: { customerId: customer.id, customerName: customer.name, amount: value, note, newDebt, paymentId },
      });
    }
  } else {
    await addToSyncQueue({
      collectionName: "payments",
      documentId: paymentId,
      actionType: "recordPayment",
      payload: { customerId: customer.id, customerName: customer.name, amount: value, note, newDebt, paymentId },
    });
  }
}

/* ══════════════════════════════════════════════
   سجل النشاط
══════════════════════════════════════════════ */

export async function logActivity(type, title, description) {
  try {
    if (navigator.onLine) {
      await addDoc(collectionRef("activityLogs"), { type, title, description, createdAt: serverTimestamp() });
    }
    // لا نخزن activity logs محلياً لتجنب التضخم
  } catch { /* غير حرج */ }
}

/* ══════════════════════════════════════════════
   الاستعلامات (قراءة فقط)
══════════════════════════════════════════════ */

export async function fetchCustomerTransactions(customerId) {
  if (!navigator.onLine) {
    // عند الأوفلاين: أعد مصفوفة فارغة (لا نحفظ المعاملات الفرعية محلياً)
    return [];
  }
  const snap = await getDocs(
    query(collection(db, "customers", customerId, "transactions"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function salesForPeriod(start) {
  if (!navigator.onLine) {
    return loadCollectionFromLocal("sales", "createdAt");
  }
  const snap = await getDocs(
    query(collectionRef("sales"), where("createdAt", ">=", start), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

/* ══════════════════════════════════════════════
   إعادة التعيين (Admin)
══════════════════════════════════════════════ */

export async function resetDailySales() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const snap = await getDocs(
    query(collectionRef("sales"), where("createdAt", ">=", today), where("createdAt", "<", tomorrow))
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await logActivity("system", "إعادة تعيين مبيعات اليوم", "تم حذف جميع مبيعات اليوم");
}

async function deleteCollection(colName) {
  const snap = await getDocs(collection(db, colName));
  const chunks = [];
  for (let i = 0; i < snap.docs.length; i += 490) chunks.push(snap.docs.slice(i, i + 490));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function resetData() {
  await Promise.all([
    deleteCollection("sales"),
    deleteCollection("payments"),
    deleteCollection("activityLogs"),
    deleteCollection("products"),
  ]);
  await logActivity("system", "إعادة تعيين البيانات", "تم حذف المبيعات والمدفوعات والسجلات والمنتجات");
}

/** دالة محتفظ بها للتوافق — لا تضيف بيانات تجريبية */
export async function ensureDemoData() {
  /* يبدأ التطبيق فارغاً */
}

/* ── Helper ── */
function toFirestorePayload(obj) {
  const clean = { ...obj };
  delete clean.id;
  delete clean.synced;
  delete clean.syncStatus;
  delete clean.localOnly;
  delete clean.imagePending;
  return clean;
}
