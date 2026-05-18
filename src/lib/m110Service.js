/**
 * m110Service.js
 * خدمة إعدادات طابعة Phomemo M110 — Firebase Firestore
 * Document: printSettings/m110
 */

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/* ══════════════════════════════════════════
   الإعدادات الافتراضية
══════════════════════════════════════════ */
export const DEFAULT_M110 = {
  defaultLabelSize: "40x30",         // المقاس الافتراضي
  showProductName:  true,
  showPrice:        true,
  showBarcode:      true,
  showInternalCode: false,
  showExpiryDate:   true,
  showUnit:         true,
  showStoreName:    true,
  weightPriceMode:  "perKg",         // "perKg" | "per100g"
  defaultCopies:    1,
  receiptEnabled:   true,
  receiptHeader:    "متجر المواد الغذائية",
  receiptFooter:    "شكرًا لتسوقكم معنا 🌿",
};

/* ══════════════════════════════════════════
   مقاسات الملصقات (mm)
══════════════════════════════════════════ */
export const LABEL_SIZES = {
  "30x20":   { w: 30, h: 20,   label: "30×20 مم — ملصق صغير" },
  "40x30":   { w: 40, h: 30,   label: "40×30 مم — افتراضي" },
  "50x30":   { w: 50, h: 30,   label: "50×30 مم" },
  "50x50":   { w: 50, h: 50,   label: "50×50 مم — مربع" },
  "50x80":   { w: 50, h: 80,   label: "50×80 مم — كبير" },
  "receipt": { w: 57, h: null, label: "رول حراري متصل (57مم)" },
};

/* ══════════════════════════════════════════
   Firebase CRUD
══════════════════════════════════════════ */
export async function saveM110Settings(data) {
  await setDoc(
    doc(db, "printSettings", "m110"),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export function subscribeM110Settings(callback) {
  return onSnapshot(doc(db, "printSettings", "m110"), (snap) => {
    callback(snap.exists() ? { ...DEFAULT_M110, ...snap.data() } : { ...DEFAULT_M110 });
  });
}
