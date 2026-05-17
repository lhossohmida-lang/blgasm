import { offlineDb } from "./offlineDb";

/**
 * خدمة رفع الصور — تعتمد على Cloudinary بدلاً من Firebase Storage.
 *
 * الإعدادات المطلوبة في ملف .env:
 *   VITE_CLOUDINARY_CLOUD_NAME    — اسم الـ Cloud
 *   VITE_CLOUDINARY_UPLOAD_PRESET — الـ Upload Preset (غير مؤمَّن / unsigned)
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = CLOUD_NAME
  ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
  : null;

/** هل Cloudinary مهيأ؟ */
export function isCloudinaryConfigured() {
  return !!(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * ضغط الصورة وتصغيرها قبل الرفع (Canvas API).
 * maxWidth الافتراضي 900px — quality 0.82 لتوازن جيد.
 */
export async function compressImage(file, maxWidth = 900, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => resolve(blob && blob.size < file.size ? blob : file),
          file.type === "image/png" ? "image/png" : "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * ارفع ملف صورة إلى Cloudinary وأعد الرابط الآمن.
 * @param {File|Blob} file
 * @param {string} [folder] — مجلد اختياري داخل Cloudinary
 */
export async function uploadToCloudinary(file, folder = "products") {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary غير مهيأ. أضف VITE_CLOUDINARY_CLOUD_NAME و VITE_CLOUDINARY_UPLOAD_PRESET في ملف .env"
    );
  }

  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed, file.name || "image.jpg");
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `فشل رفع الصورة (${res.status})`);
  }
  const data = await res.json();
  return data.secure_url;
}

/**
 * رفع صورة منتج مع دعم الأوفلاين:
 * — إذا كان الإنترنت متاحاً: ارفع فوراً وأعد الرابط.
 * — إذا كان غير متاح: خزّن محلياً وأعد null.
 */
export async function uploadProductImage(file, productId) {
  if (!file) return null;

  // تحقق من الحجم (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("حجم الصورة يجب ألا يتجاوز 5MB");
  }
  // تحقق من النوع
  if (!file.type.startsWith("image/")) {
    throw new Error("يجب اختيار ملف صورة صالح");
  }

  if (navigator.onLine && isCloudinaryConfigured()) {
    try {
      return await uploadToCloudinary(file, "products");
    } catch (err) {
      console.warn("[imageUpload] فشل الرفع الفوري، يُحفظ محلياً:", err.message);
      await storePendingImage(file, productId);
      return null;
    }
  }

  // غير متصل: خزّن محلياً
  await storePendingImage(file, productId);
  return null;
}

/** حفظ صورة مؤجلة (base64) في IndexedDB */
async function storePendingImage(file, productId) {
  const base64 = await fileToBase64(file);
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await offlineDb.pendingImages.add({
    id,
    productId,
    base64,
    filename: file.name || "image.jpg",
    mimeType: file.type || "image/jpeg",
    size: file.size,
    createdAt: new Date().toISOString(),
    uploadStatus: "pending",
  });
}

/**
 * رفع جميع الصور المؤجلة عند عودة الإنترنت.
 * يتم استدعاؤها تلقائياً من syncManager.
 */
export async function processPendingImages() {
  if (!navigator.onLine || !isCloudinaryConfigured()) return;

  const pending = await offlineDb.pendingImages
    .where("uploadStatus")
    .anyOf(["pending", "failed"])
    .toArray();

  for (const img of pending) {
    try {
      await offlineDb.pendingImages.update(img.id, { uploadStatus: "uploading" });

      const blob = base64ToBlob(img.base64, img.mimeType);
      const file = new File([blob], img.filename, { type: img.mimeType });
      const url = await uploadToCloudinary(file, "products");

      await offlineDb.pendingImages.update(img.id, {
        uploadStatus: "uploaded",
        imageUrl: url,
        uploadedAt: new Date().toISOString(),
      });

      // حدّث المنتج المرتبط
      const product = await offlineDb.products.get(img.productId);
      if (product) {
        await offlineDb.products.update(img.productId, {
          imageUrl: url,
          syncStatus: "pending",
          synced: false,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("[imageUpload] فشل رفع الصورة المؤجلة:", img.id, err.message);
      await offlineDb.pendingImages.update(img.id, { uploadStatus: "failed" });
    }
  }
}

/** إعادة محاولة رفع صورة واحدة يدوياً */
export async function retryImageUpload(imageId) {
  const img = await offlineDb.pendingImages.get(imageId);
  if (!img || !navigator.onLine || !isCloudinaryConfigured()) return false;
  try {
    await offlineDb.pendingImages.update(imageId, { uploadStatus: "uploading" });
    const blob = base64ToBlob(img.base64, img.mimeType);
    const file = new File([blob], img.filename, { type: img.mimeType });
    const url = await uploadToCloudinary(file, "products");
    await offlineDb.pendingImages.update(imageId, {
      uploadStatus: "uploaded", imageUrl: url,
    });
    const product = await offlineDb.products.get(img.productId);
    if (product) {
      await offlineDb.products.update(img.productId, { imageUrl: url, syncStatus: "pending", synced: false });
    }
    return true;
  } catch {
    await offlineDb.pendingImages.update(imageId, { uploadStatus: "failed" });
    return false;
  }
}

/** احصل على الصور المؤجلة لمنتج معين */
export async function getPendingImagesForProduct(productId) {
  return offlineDb.pendingImages
    .where("productId")
    .equals(productId)
    .filter((img) => img.uploadStatus !== "uploaded")
    .toArray();
}

/* ─── Helpers ─── */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64, mimeType) {
  const parts = base64.split(",");
  const raw = atob(parts[1] || parts[0]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
