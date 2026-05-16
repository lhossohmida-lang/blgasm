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
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";

export const categories = ["مواد أساسية", "مشروبات", "حلويات", "منظفات", "ألبان", "أخرى"];
export const units = ["قطعة", "كغ", "غرام", "لتر", "علبة", "كرتونة", "كيس"];

export function collectionRef(name) {
  return collection(db, name);
}

export async function uploadProductImage(file) {
  if (!file) return "";
  const imageRef = ref(storage, `products/${Date.now()}-${file.name}`);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
}

export async function saveProduct(values, file, id) {
  const imageUrl = file ? await uploadProductImage(file) : values.imageUrl || "";
  const payload = {
    ...values,
    barcode: String(values.barcode || "").trim(),
    qrCode: String(values.qrCode || values.barcode || "").trim(),
    imageUrl,
    purchasePrice: Number(values.purchasePrice || 0),
    salePrice: Number(values.salePrice || 0),
    quantity: Number(values.quantity || 0),
    minimumStock: Number(values.minimumStock || 0),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, "products", id), payload);
    await logActivity("product", "تعديل منتج", `تم تعديل ${values.name}`);
    return id;
  }
  const created = await addDoc(collectionRef("products"), { ...payload, createdAt: serverTimestamp() });
  await logActivity("product", "إضافة منتج", `تم إضافة منتج جديد: ${values.name}`);
  return created.id;
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, "products", id));
  await logActivity("product", "حذف منتج", "تم حذف منتج من المخزون");
}

export async function receiveProductStock({ productId, productName, quantity, note }) {
  const value = Number(quantity || 0);
  if (!productId) throw new Error("لم يتم تحديد المنتج");
  if (value <= 0) throw new Error("الكمية غير صحيحة");
  await updateDoc(doc(db, "products", productId), {
    quantity: increment(value),
    updatedAt: serverTimestamp(),
  });
  await logActivity("stock-in", "استلام مخزون عبر QR", `${productName} +${value}${note ? ` - ${note}` : ""}`);
}

export async function saveCustomer(values, id) {
  if (!String(values.name || "").trim()) throw new Error("اسم الزبون مطلوب");
  if (!String(values.phone || "").trim()) throw new Error("رقم الهاتف مطلوب");
  const payload = {
    ...values,
    name: String(values.name || "").trim(),
    phone: String(values.phone || "").trim(),
    address: String(values.address || "").trim(),
    notes: String(values.notes || "").trim(),
    totalDebt: Number(values.totalDebt || 0),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, "customers", id), payload);
    return id;
  }
  const created = await addDoc(collectionRef("customers"), { ...payload, createdAt: serverTimestamp() });
  await logActivity("customer", "إضافة زبون", `تم إضافة ${values.name}`);
  return created.id;
}

export async function deleteCustomer(id) {
  await deleteDoc(doc(db, "customers", id));
}

export async function logActivity(type, title, description) {
  await addDoc(collectionRef("activityLogs"), { type, title, description, createdAt: serverTimestamp() });
}

export async function createSale({ cart, discount, paymentMethod, customer, cashierId }) {
  if (!cart.length) throw new Error("السلة فارغة");
  const invoiceNumber = String(Date.now()).slice(-6);
  const subtotal = cart.reduce((sum, item) => sum + item.salePrice * item.cartQty, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const saleRef = doc(collectionRef("sales"));
  let saleData;
  await runTransaction(db, async (transaction) => {
    for (const item of cart) {
      const productRef = doc(db, "products", item.id);
      const snap = await transaction.get(productRef);
      if (!snap.exists()) throw new Error(`المنتج غير موجود: ${item.name}`);
      const current = snap.data().quantity || 0;
      if (current < item.cartQty) throw new Error(`الكمية غير متوفرة للمنتج ${item.name}`);
      transaction.update(productRef, { quantity: current - item.cartQty, updatedAt: serverTimestamp() });
    }
    saleData = {
      invoiceNumber,
      items: cart.map((item) => ({
        productId: item.id,
        name: item.name,
        barcode: item.barcode || "",
        qrCode: item.qrCode || item.barcode || "",
        quantity: item.cartQty,
        unit: item.unit,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        total: item.salePrice * item.cartQty,
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
      createdAt: serverTimestamp(),
    };
    transaction.set(saleRef, saleData);
    if (paymentMethod === "credit") {
      if (!customer?.id) throw new Error("يجب اختيار زبون للبيع بالكريديت");
      const customerRef = doc(db, "customers", customer.id);
      transaction.update(customerRef, {
        totalDebt: increment(total),
        lastPurchaseAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const transactionRef = doc(collection(db, "customers", customer.id, "transactions"));
      transaction.set(transactionRef, {
        type: "purchase",
        amount: total,
        invoiceId: saleRef.id,
        note: `فاتورة #${invoiceNumber}`,
        balanceAfter: Number(customer.totalDebt || 0) + total,
        createdAt: serverTimestamp(),
      });
    }
  });
  await logActivity("sale", "عملية بيع", `تمت عملية بيع بمبلغ ${total}`);
  return { id: saleRef.id, ...saleData, createdAt: new Date() };
}

export async function recordPayment({ customer, amount, note }) {
  const value = Number(amount || 0);
  if (!customer?.id) throw new Error("اختر الزبون");
  if (value <= 0) throw new Error("المبلغ غير صحيح");
  if (value > Number(customer.totalDebt || 0)) throw new Error("لا يمكن أن يصبح الدين سالبًا");
  const paymentRef = doc(collectionRef("payments"));
  await runTransaction(db, async (transaction) => {
    const customerRef = doc(db, "customers", customer.id);
    const balanceAfter = Number(customer.totalDebt || 0) - value;
    transaction.update(customerRef, {
      totalDebt: balanceAfter,
      lastPaymentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(paymentRef, {
      customerId: customer.id,
      customerName: customer.name,
      amount: value,
      note: note || "",
      createdAt: serverTimestamp(),
    });
    transaction.set(doc(collection(db, "customers", customer.id, "transactions")), {
      type: "payment",
      amount: value,
      invoiceId: null,
      note: note || "دفعة كريديت",
      balanceAfter,
      createdAt: serverTimestamp(),
    });
  });
  await logActivity("payment", "دفعة كريديت", `تم تحصيل دفعة من ${customer.name}`);
}

export async function fetchCustomerTransactions(customerId) {
  const snap = await getDocs(query(collection(db, "customers", customerId, "transactions"), orderBy("createdAt", "desc")));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function ensureDemoData() {
  /* تم حذف البيانات التجريبية — يبدأ التطبيق فارغاً */
}

export async function salesForPeriod(start) {
  const snap = await getDocs(query(collectionRef("sales"), where("createdAt", ">=", start), orderBy("createdAt", "desc")));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

/* حذف مجموعة كاملة على دفعات (Firestore يقبل 500 عملية لكل batch) */
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

/* إعادة تعيين الكميات إلى صفر لكل المنتجات */
async function resetProductQuantities() {
  const snap = await getDocs(collection(db, "products"));
  const chunks = [];
  for (let i = 0; i < snap.docs.length; i += 490) chunks.push(snap.docs.slice(i, i + 490));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.update(d.ref, { quantity: 0, updatedAt: serverTimestamp() }));
    await batch.commit();
  }
}

/**
 * إعادة تعيين جميع البيانات ما عدا بيانات الزبائن:
 * - حذف كل المبيعات (sales)
 * - حذف كل المدفوعات (payments)
 * - حذف كل سجلات النشاط (activityLogs)
 * - حذف كل المنتجات (products)
 * الزبائن وديونهم وتاريخهم تبقى كما هي.
 */
export async function resetDailySales() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const snap = await getDocs(
    query(
      collectionRef("sales"),
      where("createdAt", ">=", today),
      where("createdAt", "<", tomorrow)
    )
  );

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  await logActivity("system", "إعادة تعيين مبيعات اليوم", "تم حذف جميع مبيعات اليوم");
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
