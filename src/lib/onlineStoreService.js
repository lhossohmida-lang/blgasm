/**
 * onlineStoreService.js
 * خدمة المتجر الإلكتروني — تشمل إعدادات المتجر، منتجاته، الطلبات، والصور التلقائية.
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./store";

// ──────────────────────────────────────────────
// إعدادات المتجر الإلكتروني (storeSettings)
// ──────────────────────────────────────────────

export const DEFAULT_STORE_SETTINGS = {
  onlineStoreEnabled: true,
  storeName: "متجر المواد الغذائية",
  storePhone: "",
  storeAddress: "",
  welcomeMessage: "أهلاً بكم في متجرنا الإلكتروني! نقدم أفضل المواد الغذائية بأسعار تنافسية.",
  deliveryFee: 0,
  workingHours: "9:00 ص - 9:00 م",
  onlineOrdersEnabled: true,
};

export async function getStoreSettings() {
  const snap = await getDoc(doc(db, "storeSettings", "main"));
  return snap.exists() ? { ...DEFAULT_STORE_SETTINGS, ...snap.data() } : DEFAULT_STORE_SETTINGS;
}

export async function saveStoreSettings(data) {
  await setDoc(doc(db, "storeSettings", "main"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export function useStoreSettings(callback) {
  return onSnapshot(doc(db, "storeSettings", "main"), (snap) => {
    callback(snap.exists() ? { ...DEFAULT_STORE_SETTINGS, ...snap.data() } : DEFAULT_STORE_SETTINGS);
  });
}

// ──────────────────────────────────────────────
// حقول المنتج الخاصة بالمتجر الإلكتروني
// ──────────────────────────────────────────────

export async function updateProductOnlineFields(productId, fields) {
  await updateDoc(doc(db, "products", productId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

// ──────────────────────────────────────────────
// خريطة الصور التلقائية بناءً على الكلمات المفتاحية
// ──────────────────────────────────────────────

const KEYWORD_IMAGES = {
  حليب:       "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80",
  جبن:        "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&q=80",
  زبدة:       "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80",
  لبن:        "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80",
  خبز:        "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
  زيت:        "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
  سكر:        "https://images.unsplash.com/photo-1581600140682-d4e68c8cde32?w=400&q=80",
  دقيق:       "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80",
  أرز:        "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&q=80",
  رز:         "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&q=80",
  معكرونة:    "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80",
  مكرونة:     "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80",
  طماطم:      "https://images.unsplash.com/photo-1546094096-0df4bcaef680?w=400&q=80",
  عصير:       "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&q=80",
  قهوة:       "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&q=80",
  شاي:        "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80",
  ماء:        "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80",
  مياه:       "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80",
  بيض:        "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80",
  دجاج:       "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&q=80",
  لحم:        "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&q=80",
  سمك:        "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400&q=80",
  فاكهة:      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80",
  تفاح:       "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80",
  موز:        "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80",
  برتقال:     "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400&q=80",
  بطاطس:      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80",
  بصل:        "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=400&q=80",
  ثوم:        "https://images.unsplash.com/photo-1615478503562-ec2d8aa0e24e?w=400&q=80",
  شوكولا:     "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80",
  شوكولاطة:   "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80",
  بسكويت:     "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80",
  حلوى:       "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&q=80",
  صابون:      "https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?w=400&q=80",
  منظف:       "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&q=80",
  مسحوق:      "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&q=80",
  عجين:       "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=400&q=80",
  ملح:        "https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=400&q=80",
  خضر:        "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80",
  خضروات:     "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80",
  ذرة:        "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&q=80",
  توابل:      "https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=400&q=80",
  بهارات:     "https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=400&q=80",
};

const CATEGORY_FALLBACK = {
  "مواد أساسية": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80",
  "مشروبات":     "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400&q=80",
  "حلويات":      "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&q=80",
  "منظفات":      "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&q=80",
  "ألبان":       "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80",
  "أخرى":        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80",
};

function getFallbackImage(productName, category) {
  const name = String(productName || "").trim();
  for (const [keyword, url] of Object.entries(KEYWORD_IMAGES)) {
    if (name.includes(keyword)) return url;
  }
  return CATEGORY_FALLBACK[category] || CATEGORY_FALLBACK["أخرى"];
}

/**
 * البحث عن صورة تلقائية للمنتج.
 * يستدعي Vercel Serverless Function (api/image-search) أولاً،
 * ثم يتراجع للصور المحلية إن لم يتوفر مفتاح API.
 */
export async function searchAutoImage(productId, productName, category = "أخرى") {
  try {
    // استدعاء Vercel API — لا يحتاج Firebase Blaze plan
    const base = typeof window !== "undefined"
      ? window.location.origin
      : "https://blgasm.vercel.app";
    const res = await fetch(`${base}/api/image-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.imageUrl) {
        await updateDoc(doc(db, "products", productId), {
          autoImageUrl: data.imageUrl,
          imageSourceType: "auto",
          imageApproved: false,
          updatedAt: serverTimestamp(),
        });
        return data.imageUrl;
      }
    }
  } catch {
    /* API غير متاح — استخدام الصور المحلية */
  }

  // Fallback: صور محلية مصنّفة
  const fallback = getFallbackImage(productName, category);
  await updateDoc(doc(db, "products", productId), {
    autoImageUrl: fallback,
    imageSourceType: "auto",
    imageApproved: false,
    updatedAt: serverTimestamp(),
  });
  return fallback;
}

export async function approveProductImage(productId) {
  await updateDoc(doc(db, "products", productId), {
    imageApproved: true,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAutoImage(productId) {
  await updateDoc(doc(db, "products", productId), {
    autoImageUrl: null,
    imageSourceType: "placeholder",
    imageApproved: false,
    updatedAt: serverTimestamp(),
  });
}

// ──────────────────────────────────────────────
// دالة مساعدة: أفضل صورة متاحة للمنتج
// ──────────────────────────────────────────────
export function getBestProductImage(product) {
  if (product.imageUrl) return { url: product.imageUrl, type: "uploaded" };
  if (product.autoImageUrl) return { url: product.autoImageUrl, type: "auto" };
  return { url: null, type: "placeholder" };
}

// ──────────────────────────────────────────────
// حالات الطلبات
// ──────────────────────────────────────────────
export const ORDER_STATUSES = ["new", "preparing", "ready", "delivered", "cancelled"];

export const STATUS_LABELS = {
  new:       "جديد",
  preparing: "قيد التحضير",
  ready:     "جاهز للاستلام",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const STATUS_COLORS = {
  new:       "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700",
  ready:     "bg-green-100 text-[#0d6a42]",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export const STATUS_FLOW = {
  new:       "preparing",
  preparing: "ready",
  ready:     "delivered",
};

// ──────────────────────────────────────────────
// الطلبات الأونلاين
// ──────────────────────────────────────────────

export async function createOnlineOrder(orderData) {
  const orderRef = doc(collection(db, "onlineOrders"));
  const orderNumber = String(Date.now()).slice(-6);
  await setDoc(orderRef, {
    ...orderData,
    orderNumber,
    status: "new",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: orderRef.id, orderNumber };
}

export function subscribeOnlineOrders(callback) {
  const q = query(collection(db, "onlineOrders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export function subscribeNewOrdersCount(callback) {
  const q = query(collection(db, "onlineOrders"), where("status", "==", "new"));
  return onSnapshot(q, (snap) => callback(snap.size));
}

export async function updateOrderStatus(orderId, status) {
  await updateDoc(doc(db, "onlineOrders", orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
  await logActivity("online-order", "تحديث حالة طلب", `تم تغيير حالة الطلب #${orderId.slice(-6)} إلى: ${STATUS_LABELS[status]}`);
}

/**
 * قبول الطلب: يتحقق من المخزون، يخصم الكميات، ويغير الحالة إلى "قيد التحضير".
 */
export async function acceptOrder(orderId, order) {
  await runTransaction(db, async (transaction) => {
    for (const item of order.items) {
      const productRef = doc(db, "products", item.productId);
      const snap = await transaction.get(productRef);
      if (!snap.exists()) throw new Error(`المنتج غير موجود: ${item.name}`);
      const current = Number(snap.data().quantity || 0);
      if (current < item.quantity) {
        throw new Error(`الكمية غير كافية لـ "${item.name}" (متوفر: ${current}، مطلوب: ${item.quantity})`);
      }
      transaction.update(productRef, {
        quantity: current - item.quantity,
        updatedAt: serverTimestamp(),
      });
    }
    transaction.update(doc(db, "onlineOrders", orderId), {
      status: "preparing",
      updatedAt: serverTimestamp(),
    });
  });
  await logActivity("online-order", "قبول طلب أونلاين", `تم قبول الطلب #${orderId.slice(-6)} وخصم المخزون`);
}

export async function cancelOrder(orderId) {
  await updateDoc(doc(db, "onlineOrders", orderId), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
  await logActivity("online-order", "إلغاء طلب", `تم إلغاء الطلب #${orderId.slice(-6)}`);
}

// ──────────────────────────────────────────────
// الاستماع لمنتجات المتجر الإلكتروني (للزبائن)
// ──────────────────────────────────────────────
/**
 * يستمع للمنتجات المرئية أونلاين بدون orderBy لتجنب الحاجة إلى
 * composite index — الترتيب يتم من جهة العميل.
 * onError: يُستدعى عند فشل الاستعلام (مثلاً: Firestore غير مهيأ أو خطأ في الصلاحيات)
 */
export function subscribeOnlineProducts(callback, onError) {
  // بدون orderBy → لا يحتاج composite index
  const q = query(
    collection(db, "products"),
    where("isOnlineVisible", "==", true)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // الترتيب من جهة العميل بناءً على onlineSortOrder ثم createdAt
      items.sort((a, b) => {
        const sa = Number(a.onlineSortOrder ?? 9999);
        const sb = Number(b.onlineSortOrder ?? 9999);
        if (sa !== sb) return sa - sb;
        // fallback: الأحدث أولاً
        const ta = a.createdAt?.seconds ?? a.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const tb = b.createdAt?.seconds ?? b.createdAt?.toDate?.()?.getTime?.() ?? 0;
        return tb - ta;
      });
      callback(items);
    },
    (err) => {
      console.error("[subscribeOnlineProducts] Firestore error:", err.code, err.message);
      if (typeof onError === "function") onError(err);
    }
  );
}
