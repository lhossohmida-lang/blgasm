/* ─── أدوات المساعد الذكي (Tool Calling) ─── */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  categories,
  deleteCustomer,
  deleteProduct,
  fetchCustomerTransactions,
  recordPayment,
  receiveProductStock,
  saveCustomer,
  saveProduct,
  salesForPeriod,
  units,
} from "./store";

/* ─── الأدوات التي تتطلب تأكيداً قبل التنفيذ ─── */
export const WRITE_TOOLS = new Set([
  "add_product",
  "update_product",
  "delete_product",
  "add_customer",
  "delete_customer",
  "record_payment",
  "receive_stock",
]);

/* ─── تعريفات الأدوات بصيغة OpenAI ─── */
export const TOOL_DEFINITIONS = [
  /* ──────── قراءة ──────── */
  {
    type: "function",
    function: {
      name: "list_products",
      description: "إرجاع قائمة المنتجات في المتجر مع تفاصيلها. مفيد للتعرف العام على المخزون.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "تصفية حسب الفئة (اختياري)", enum: categories },
          max: { type: "integer", description: "حد أقصى لعدد المنتجات (افتراضي 50)", minimum: 1, maximum: 500 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "البحث عن منتج بالاسم أو الباركود أو جزء منهما.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "نص البحث (اسم منتج، باركود، أو فئة)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_products",
      description: "إرجاع المنتجات التي وصلت أو تجاوزت حدها الأدنى من المخزون (تحتاج إعادة طلب).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_value",
      description: "حساب القيمة الإجمالية للمخزون: بسعر الشراء (كلفة) وبسعر البيع (إيراد متوقع) والربح الكامن.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_customers",
      description: "إرجاع قائمة الزبائن وتفاصيلهم.",
      parameters: {
        type: "object",
        properties: {
          max: { type: "integer", description: "حد أقصى لعدد الزبائن (افتراضي 50)", minimum: 1, maximum: 500 },
          only_with_debt: { type: "boolean", description: "true لإرجاع المديونين فقط" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "البحث عن زبون بالاسم أو رقم الهاتف.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string", description: "اسم أو رقم هاتف أو جزء منهما" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_debtors",
      description: "إرجاع الزبائن الأكثر مديونية مرتبين تنازلياً.",
      parameters: {
        type: "object",
        properties: { max: { type: "integer", default: 10, minimum: 1, maximum: 100 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_history",
      description: "تفاصيل زبون وحركاته (مشتريات ودفعات).",
      parameters: {
        type: "object",
        required: ["customer_id"],
        properties: {
          customer_id: { type: "string", description: "معرّف الزبون في Firestore" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_summary",
      description: "ملخص المبيعات والأرباح لفترة محددة: عدد الفواتير، الإجمالي، الخصم، الربح، تقسيم نقد/كريديت.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "yesterday", "week", "month", "year", "all"],
            description: "الفترة الزمنية (افتراضي: today)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_selling_products",
      description: "المنتجات الأكثر مبيعاً في فترة محددة بالكمية وبالقيمة.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "year", "all"],
            description: "الفترة الزمنية (افتراضي: month)",
          },
          max: { type: "integer", default: 10, minimum: 1, maximum: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_activity",
      description: "آخر العمليات المسجلة في النظام (إضافة منتج، بيع، تعديل، إلخ).",
      parameters: {
        type: "object",
        properties: { max: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
      },
    },
  },

  /* ──────── كتابة ──────── */
  {
    type: "function",
    function: {
      name: "add_product",
      description: "إضافة منتج جديد إلى المخزون.",
      parameters: {
        type: "object",
        required: ["name", "salePrice"],
        properties: {
          name: { type: "string", description: "اسم المنتج" },
          barcode: { type: "string", description: "الباركود (اختياري)" },
          category: { type: "string", enum: categories },
          purchasePrice: { type: "number", description: "سعر الشراء بالدينار", minimum: 0 },
          salePrice: { type: "number", description: "سعر البيع بالدينار", minimum: 0 },
          quantity: { type: "number", description: "الكمية الابتدائية", minimum: 0 },
          unit: { type: "string", enum: units },
          minimumStock: { type: "number", description: "الحد الأدنى للتنبيه", minimum: 0 },
          supplier: { type: "string", description: "اسم المورد (اختياري)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product",
      description: "تعديل حقول منتج موجود (يجب تمرير product_id).",
      parameters: {
        type: "object",
        required: ["product_id"],
        properties: {
          product_id: { type: "string" },
          name: { type: "string" },
          barcode: { type: "string" },
          category: { type: "string", enum: categories },
          purchasePrice: { type: "number", minimum: 0 },
          salePrice: { type: "number", minimum: 0 },
          quantity: { type: "number", minimum: 0 },
          unit: { type: "string", enum: units },
          minimumStock: { type: "number", minimum: 0 },
          supplier: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_product",
      description: "حذف منتج من المخزون نهائياً.",
      parameters: {
        type: "object",
        required: ["product_id"],
        properties: { product_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "receive_stock",
      description: "إضافة كمية جديدة لمخزون منتج موجود (استلام بضاعة).",
      parameters: {
        type: "object",
        required: ["product_id", "quantity"],
        properties: {
          product_id: { type: "string" },
          quantity: { type: "number", minimum: 0.01, description: "الكمية المضافة" },
          note: { type: "string", description: "ملاحظة (اسم المورد، رقم الفاتورة، إلخ)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_customer",
      description: "إضافة زبون جديد.",
      parameters: {
        type: "object",
        required: ["name", "phone"],
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          notes: { type: "string" },
          totalDebt: { type: "number", description: "دين ابتدائي (افتراضي 0)", minimum: 0 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_customer",
      description: "حذف زبون نهائياً (احذر: ستضيع حركاته).",
      parameters: {
        type: "object",
        required: ["customer_id"],
        properties: { customer_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_payment",
      description: "تسجيل دفعة تخفض دين زبون.",
      parameters: {
        type: "object",
        required: ["customer_id", "amount"],
        properties: {
          customer_id: { type: "string" },
          amount: { type: "number", minimum: 0.01 },
          note: { type: "string" },
        },
      },
    },
  },
];

/* ─── مساعدات داخلية ─── */

async function getAllDocs(name, max = 500) {
  const snap = await getDocs(query(collection(db, name), fbLimit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function trim(text, n = 60) {
  const s = String(text || "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function summarizeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode || "",
    category: p.category,
    salePrice: p.salePrice,
    purchasePrice: p.purchasePrice,
    quantity: p.quantity,
    unit: p.unit,
    minimumStock: p.minimumStock,
    low: Number(p.quantity) <= Number(p.minimumStock),
    supplier: p.supplier || "",
  };
}

function summarizeCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address || "",
    notes: trim(c.notes, 80),
    totalDebt: Number(c.totalDebt || 0),
  };
}

function periodStart(period) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (period) {
    case "today": return start;
    case "yesterday": {
      const y = new Date(start);
      y.setDate(y.getDate() - 1);
      return y;
    }
    case "week": {
      start.setDate(start.getDate() - 7);
      return start;
    }
    case "month": {
      start.setMonth(start.getMonth() - 1);
      return start;
    }
    case "year": {
      start.setFullYear(start.getFullYear() - 1);
      return start;
    }
    case "all":
    default:
      return new Date(0);
  }
}

async function loadSales(period) {
  const start = periodStart(period);
  if (period === "yesterday") {
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const all = await salesForPeriod(start);
    return all.filter((s) => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
      return d < end;
    });
  }
  return salesForPeriod(start);
}

/* ─── المنفّذ ─── */

export async function executeTool(name, args) {
  switch (name) {
    /* ──────── قراءة ──────── */
    case "list_products": {
      const all = await getAllDocs("products", args.max || 50);
      const filtered = args.category ? all.filter((p) => p.category === args.category) : all;
      return { count: filtered.length, products: filtered.map(summarizeProduct) };
    }

    case "search_products": {
      const q = String(args.query || "").trim().toLowerCase();
      if (!q) return { count: 0, products: [] };
      const all = await getAllDocs("products", 500);
      const matches = all.filter((p) =>
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.barcode || "").includes(q) ||
        String(p.category || "").includes(q)
      );
      return { count: matches.length, products: matches.slice(0, 25).map(summarizeProduct) };
    }

    case "get_low_stock_products": {
      const all = await getAllDocs("products", 500);
      const low = all
        .filter((p) => Number(p.quantity || 0) <= Number(p.minimumStock || 0))
        .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0));
      return { count: low.length, products: low.map(summarizeProduct) };
    }

    case "get_inventory_value": {
      const all = await getAllDocs("products", 1000);
      let cost = 0, retail = 0, units_count = 0;
      for (const p of all) {
        const qty = Number(p.quantity || 0);
        cost += qty * Number(p.purchasePrice || 0);
        retail += qty * Number(p.salePrice || 0);
        units_count += qty;
      }
      return {
        products_count: all.length,
        total_units: units_count,
        cost_value: Math.round(cost * 100) / 100,
        retail_value: Math.round(retail * 100) / 100,
        potential_profit: Math.round((retail - cost) * 100) / 100,
        currency: "دج",
      };
    }

    case "list_customers": {
      const all = await getAllDocs("customers", args.max || 50);
      const filtered = args.only_with_debt ? all.filter((c) => Number(c.totalDebt || 0) > 0) : all;
      return { count: filtered.length, customers: filtered.map(summarizeCustomer) };
    }

    case "search_customers": {
      const q = String(args.query || "").trim().toLowerCase();
      if (!q) return { count: 0, customers: [] };
      const all = await getAllDocs("customers", 500);
      const matches = all.filter((c) =>
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.phone || "").includes(q)
      );
      return { count: matches.length, customers: matches.slice(0, 25).map(summarizeCustomer) };
    }

    case "get_top_debtors": {
      const all = await getAllDocs("customers", 1000);
      const sorted = all
        .filter((c) => Number(c.totalDebt || 0) > 0)
        .sort((a, b) => Number(b.totalDebt || 0) - Number(a.totalDebt || 0))
        .slice(0, args.max || 10);
      const total = sorted.reduce((s, c) => s + Number(c.totalDebt || 0), 0);
      return { count: sorted.length, total_debt: total, customers: sorted.map(summarizeCustomer) };
    }

    case "get_customer_history": {
      if (!args.customer_id) throw new Error("customer_id مطلوب");
      const snap = await getDoc(doc(db, "customers", args.customer_id));
      if (!snap.exists()) throw new Error("الزبون غير موجود");
      const customer = { id: snap.id, ...snap.data() };
      const txns = await fetchCustomerTransactions(args.customer_id);
      return {
        customer: summarizeCustomer(customer),
        transactions_count: txns.length,
        transactions: txns.slice(0, 30).map((t) => ({
          type: t.type,
          amount: t.amount,
          note: t.note || "",
          balance_after: t.balanceAfter,
          date: t.createdAt?.toDate?.()?.toISOString() || null,
        })),
      };
    }

    case "get_sales_summary": {
      const period = args.period || "today";
      const sales = await loadSales(period);
      let revenue = 0, discount = 0, cost = 0, cash = 0, credit = 0, items = 0;
      for (const s of sales) {
        revenue += Number(s.total || 0);
        discount += Number(s.discount || 0);
        if (s.paymentMethod === "cash") cash += Number(s.total || 0);
        else credit += Number(s.total || 0);
        for (const it of s.items || []) {
          cost += Number(it.purchasePrice || 0) * Number(it.quantity || 0);
          items += Number(it.quantity || 0);
        }
      }
      return {
        period,
        invoices_count: sales.length,
        items_sold: items,
        revenue: Math.round(revenue * 100) / 100,
        total_discount: Math.round(discount * 100) / 100,
        estimated_cost: Math.round(cost * 100) / 100,
        estimated_profit: Math.round((revenue - cost) * 100) / 100,
        cash_sales: Math.round(cash * 100) / 100,
        credit_sales: Math.round(credit * 100) / 100,
        currency: "دج",
      };
    }

    case "get_top_selling_products": {
      const period = args.period || "month";
      const max = args.max || 10;
      const sales = await loadSales(period);
      const map = new Map();
      for (const s of sales) {
        for (const it of s.items || []) {
          const key = it.productId || it.name;
          const prev = map.get(key) || { product_id: it.productId, name: it.name, quantity: 0, revenue: 0 };
          prev.quantity += Number(it.quantity || 0);
          prev.revenue += Number(it.total || 0);
          map.set(key, prev);
        }
      }
      const list = [...map.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, max)
        .map((x) => ({ ...x, revenue: Math.round(x.revenue * 100) / 100 }));
      return { period, count: list.length, products: list };
    }

    case "get_recent_activity": {
      const snap = await getDocs(query(
        collection(db, "activityLogs"),
        orderBy("createdAt", "desc"),
        fbLimit(args.max || 20),
      ));
      return {
        count: snap.size,
        activities: snap.docs.map((d) => {
          const v = d.data();
          return {
            type: v.type,
            title: v.title,
            description: v.description,
            date: v.createdAt?.toDate?.()?.toISOString() || null,
          };
        }),
      };
    }

    /* ──────── كتابة ──────── */
    case "add_product": {
      const id = await saveProduct({
        name: args.name,
        barcode: args.barcode || "",
        qrCode: args.barcode || "",
        category: args.category || "أخرى",
        purchasePrice: args.purchasePrice || 0,
        salePrice: args.salePrice,
        quantity: args.quantity || 0,
        unit: args.unit || "قطعة",
        minimumStock: args.minimumStock || 0,
        supplier: args.supplier || "",
        imageUrl: "",
      });
      return { ok: true, product_id: id, message: `تم إضافة المنتج "${args.name}".` };
    }

    case "update_product": {
      if (!args.product_id) throw new Error("product_id مطلوب");
      const snap = await getDoc(doc(db, "products", args.product_id));
      if (!snap.exists()) throw new Error("المنتج غير موجود");
      const current = snap.data();
      const merged = {
        name: args.name ?? current.name,
        barcode: args.barcode ?? current.barcode ?? "",
        qrCode: args.barcode ?? current.qrCode ?? current.barcode ?? "",
        category: args.category ?? current.category,
        purchasePrice: args.purchasePrice ?? current.purchasePrice ?? 0,
        salePrice: args.salePrice ?? current.salePrice ?? 0,
        quantity: args.quantity ?? current.quantity ?? 0,
        unit: args.unit ?? current.unit ?? "قطعة",
        minimumStock: args.minimumStock ?? current.minimumStock ?? 0,
        supplier: args.supplier ?? current.supplier ?? "",
        imageUrl: current.imageUrl || "",
      };
      await saveProduct(merged, null, args.product_id);
      return { ok: true, product_id: args.product_id, message: "تم تعديل المنتج." };
    }

    case "delete_product": {
      if (!args.product_id) throw new Error("product_id مطلوب");
      await deleteProduct(args.product_id);
      return { ok: true, message: "تم حذف المنتج." };
    }

    case "receive_stock": {
      if (!args.product_id) throw new Error("product_id مطلوب");
      const snap = await getDoc(doc(db, "products", args.product_id));
      if (!snap.exists()) throw new Error("المنتج غير موجود");
      const name = snap.data().name;
      await receiveProductStock({
        productId: args.product_id,
        productName: name,
        quantity: args.quantity,
        note: args.note || "",
      });
      return { ok: true, message: `تم استلام ${args.quantity} وحدة من ${name}.` };
    }

    case "add_customer": {
      const id = await saveCustomer({
        name: args.name,
        phone: args.phone,
        address: args.address || "",
        notes: args.notes || "",
        totalDebt: args.totalDebt || 0,
      });
      return { ok: true, customer_id: id, message: `تم إضافة الزبون "${args.name}".` };
    }

    case "delete_customer": {
      if (!args.customer_id) throw new Error("customer_id مطلوب");
      await deleteCustomer(args.customer_id);
      return { ok: true, message: "تم حذف الزبون." };
    }

    case "record_payment": {
      if (!args.customer_id) throw new Error("customer_id مطلوب");
      const snap = await getDoc(doc(db, "customers", args.customer_id));
      if (!snap.exists()) throw new Error("الزبون غير موجود");
      const customer = { id: snap.id, ...snap.data() };
      await recordPayment({ customer, amount: args.amount, note: args.note || "" });
      return { ok: true, message: `تم تسجيل دفعة ${args.amount} دج من ${customer.name}.` };
    }

    default:
      throw new Error(`أداة غير معروفة: ${name}`);
  }
}

/* ─── لقطة بيانات للنماذج التي لا تدعم Tool Calling ─── */
export async function buildSnapshot() {
  const [products, customers, todaySales, monthSales, activity] = await Promise.all([
    getAllDocs("products", 500),
    getAllDocs("customers", 500),
    loadSales("today"),
    loadSales("month"),
    getDocs(query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), fbLimit(10)))
      .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ]);

  const lowStock = products
    .filter((p) => Number(p.quantity || 0) <= Number(p.minimumStock || 0))
    .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0));

  const debtors = customers
    .filter((c) => Number(c.totalDebt || 0) > 0)
    .sort((a, b) => Number(b.totalDebt || 0) - Number(a.totalDebt || 0));

  let invValueCost = 0, invValueRetail = 0;
  for (const p of products) {
    invValueCost += Number(p.quantity || 0) * Number(p.purchasePrice || 0);
    invValueRetail += Number(p.quantity || 0) * Number(p.salePrice || 0);
  }

  function summarizeSales(sales) {
    let revenue = 0, cost = 0, cash = 0, credit = 0, items = 0;
    for (const s of sales) {
      revenue += Number(s.total || 0);
      if (s.paymentMethod === "cash") cash += Number(s.total || 0);
      else credit += Number(s.total || 0);
      for (const it of s.items || []) {
        cost += Number(it.purchasePrice || 0) * Number(it.quantity || 0);
        items += Number(it.quantity || 0);
      }
    }
    return {
      invoices: sales.length,
      items_sold: items,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      cash: Math.round(cash * 100) / 100,
      credit: Math.round(credit * 100) / 100,
    };
  }

  /* الأكثر مبيعاً هذا الشهر */
  const sellerMap = new Map();
  for (const s of monthSales) {
    for (const it of s.items || []) {
      const key = it.productId || it.name;
      const prev = sellerMap.get(key) || { name: it.name, quantity: 0, revenue: 0 };
      prev.quantity += Number(it.quantity || 0);
      prev.revenue += Number(it.total || 0);
      sellerMap.set(key, prev);
    }
  }
  const topSellers = [...sellerMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return {
    counts: {
      products: products.length,
      customers: customers.length,
      customers_with_debt: debtors.length,
      low_stock: lowStock.length,
    },
    inventory_value: {
      cost: Math.round(invValueCost * 100) / 100,
      retail: Math.round(invValueRetail * 100) / 100,
      potential_profit: Math.round((invValueRetail - invValueCost) * 100) / 100,
      currency: "دج",
    },
    sales_today: summarizeSales(todaySales),
    sales_last_30_days: summarizeSales(monthSales),
    low_stock_items: lowStock.slice(0, 20).map(summarizeProduct),
    top_debtors: debtors.slice(0, 10).map(summarizeCustomer),
    top_selling_30d: topSellers,
    recent_activity: activity.slice(0, 10).map((a) => ({
      type: a.type, title: a.title, description: a.description,
    })),
    products_sample: products.slice(0, 25).map(summarizeProduct),
    customers_sample: customers.slice(0, 20).map(summarizeCustomer),
  };
}

/* ─── معلومات وصفية للأدوات (لعرض رسائل ودية في الواجهة) ─── */
export const TOOL_LABELS = {
  list_products: "قائمة المنتجات",
  search_products: "بحث في المنتجات",
  get_low_stock_products: "المنتجات قليلة المخزون",
  get_inventory_value: "قيمة المخزون",
  list_customers: "قائمة الزبائن",
  search_customers: "بحث عن زبون",
  get_top_debtors: "أكبر المديونين",
  get_customer_history: "حركات زبون",
  get_sales_summary: "ملخص المبيعات",
  get_top_selling_products: "الأكثر مبيعاً",
  get_recent_activity: "آخر الأنشطة",
  add_product: "إضافة منتج",
  update_product: "تعديل منتج",
  delete_product: "حذف منتج",
  receive_stock: "استلام مخزون",
  add_customer: "إضافة زبون",
  delete_customer: "حذف زبون",
  record_payment: "تسجيل دفعة",
};

/* وصف موجز لما ستفعله أداة الكتابة، للعرض في صندوق التأكيد */
export function describeWrite(name, args) {
  switch (name) {
    case "add_product":
      return `إضافة منتج جديد: "${args.name}" بسعر ${args.salePrice} دج، كمية ${args.quantity || 0} ${args.unit || "قطعة"}.`;
    case "update_product": {
      const fields = ["name", "barcode", "category", "purchasePrice", "salePrice", "quantity", "unit", "minimumStock", "supplier"]
        .filter((k) => args[k] !== undefined);
      return `تعديل المنتج (${args.product_id}) — الحقول: ${fields.join("، ")}.`;
    }
    case "delete_product":
      return `حذف منتج نهائياً (${args.product_id}).`;
    case "receive_stock":
      return `إضافة ${args.quantity} وحدة للمخزون. ${args.note ? "ملاحظة: " + args.note : ""}`;
    case "add_customer":
      return `إضافة زبون جديد: "${args.name}" — ${args.phone}${args.totalDebt ? `، دين ابتدائي ${args.totalDebt} دج` : ""}.`;
    case "delete_customer":
      return `حذف زبون نهائياً (${args.customer_id}). ستضيع حركاته.`;
    case "record_payment":
      return `تسجيل دفعة ${args.amount} دج للزبون (${args.customer_id}).`;
    default:
      return `تنفيذ ${name}.`;
  }
}
