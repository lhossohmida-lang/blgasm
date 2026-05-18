/**
 * AdminOnlineStore.jsx
 * قسم إدارة المتجر الإلكتروني داخل لوحة الإدارة.
 * يشمل: إدارة منتجات المتجر، الطلبات الأونلاين، إعدادات المتجر، الصور التلقائية.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Image,
  MapPin,
  Package,
  Phone,
  Printer,
  RefreshCw,
  RotateCcw,
  Settings,
  Share2,
  ShoppingBag,
  Star,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UploadCloud,
  X,
  Zap,
  CheckCheck,
  XCircle,
  Clock3,
  Truck,
} from "lucide-react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "./lib/firebase";
import {
  DEFAULT_STORE_SETTINGS,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_FLOW,
  acceptOrder,
  approveProductImage,
  cancelOrder,
  deleteAutoImage,
  getBestProductImage,
  getStoreSettings,
  saveStoreSettings,
  searchAutoImage,
  subscribeOnlineOrders,
  updateOrderStatus,
  updateProductOnlineFields,
} from "./lib/onlineStoreService";
import { money, number, shortDate } from "./lib/format";

// ──────────────────────────────────────────────
// الصفحة الرئيسية للمتجر الإلكتروني في الإدارة
// ──────────────────────────────────────────────
export function AdminOnlineStore() {
  const [tab, setTab] = useState("products");
  const [orders, setOrders] = useState([]);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeOnlineOrders((data) => {
      setOrders(data);
      setNewCount(data.filter((o) => o.status === "new").length);
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#063f2b]">المتجر الإلكتروني</h1>
          <p className="text-gray-500">إدارة المنتجات والطلبات وإعدادات المتجر</p>
        </div>
        <a
          href="/store"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-2xl bg-[#063f2b] px-5 py-3 font-black text-white shadow-md hover:bg-[#0d6a42] active:scale-95"
        >
          <ExternalLink size={18} /> فتح واجهة الزبائن
        </a>
      </div>

      {/* تبويبات */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[
          { id: "products", label: "المنتجات", icon: Package },
          { id: "orders", label: "الطلبات", icon: ShoppingBag, badge: newCount },
          { id: "settings", label: "الإعدادات", icon: Settings },
        ].map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex shrink-0 items-center gap-2 rounded-2xl px-6 py-3 font-black transition-all ${
              tab === id
                ? "bg-[#063f2b] text-white shadow-md"
                : "bg-white text-gray-600 border hover:border-[#0d6a42]"
            }`}
          >
            <Icon size={18} /> {label}
            {badge > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-orange-500 text-xs font-black text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* محتوى التبويب */}
      {tab === "products" && <OnlineProductsManager />}
      {tab === "orders" && <OnlineOrdersManager orders={orders} />}
      {tab === "settings" && <StoreSettingsPanel />}
    </div>
  );
}

// ──────────────────────────────────────────────
// إدارة منتجات المتجر الإلكتروني
// ──────────────────────────────────────────────
function OnlineProductsManager() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loadingImage, setLoadingImage] = useState(null);

  useEffect(() => {
    // استخدام collection كاملة بدون orderBy لتجنب مشاكل الـ index
    // الترتيب يتم من جهة العميل
    const q = query(collection(db, "products"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // ترتيب محلي: onlineSortOrder أولاً ثم الاسم
        items.sort((a, b) => {
          const sa = Number(a.onlineSortOrder ?? 9999);
          const sb = Number(b.onlineSortOrder ?? 9999);
          return sa !== sb ? sa - sb : (a.name || "").localeCompare(b.name || "", "ar");
        });
        setProducts(items);
      },
      (err) => console.error("[AdminOnlineStore] products error:", err.message)
    );
    return unsub;
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.includes(search);
    if (filter === "visible") return matchSearch && p.isOnlineVisible;
    if (filter === "hidden") return matchSearch && !p.isOnlineVisible;
    if (filter === "featured") return matchSearch && p.featuredOnline;
    if (filter === "no-image") return matchSearch && !p.imageUrl && !p.autoImageUrl;
    return matchSearch;
  });

  async function toggleVisible(p) {
    await updateProductOnlineFields(p.id, { isOnlineVisible: !p.isOnlineVisible });
  }

  async function toggleFeatured(p) {
    await updateProductOnlineFields(p.id, { featuredOnline: !p.featuredOnline });
  }

  async function handleSearchImage(p) {
    setLoadingImage(p.id);
    try {
      await searchAutoImage(p.id, p.name, p.category);
    } catch (err) {
      alert("تعذر البحث عن صورة: " + err.message);
    } finally {
      setLoadingImage(null);
    }
  }

  async function handleApproveImage(p) {
    await approveProductImage(p.id);
  }

  async function handleDeleteImage(p) {
    if (!confirm("حذف الصورة التلقائية؟")) return;
    await deleteAutoImage(p.id);
  }

  const visibleCount = products.filter((p) => p.isOnlineVisible).length;
  const featuredCount = products.filter((p) => p.featuredOnline).length;
  const noImageCount = products.filter((p) => !p.imageUrl && !p.autoImageUrl).length;

  return (
    <div className="space-y-5">
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="مرئية في المتجر" value={visibleCount} color="green" />
        <MiniStat label="مميزة" value={featuredCount} color="amber" />
        <MiniStat label="إجمالي المنتجات" value={products.length} color="blue" />
        <MiniStat label="بدون صورة" value={noImageCount} color="red" />
      </div>

      {/* فلاتر + بحث */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-full rounded-2xl border bg-white px-4 py-2.5 pr-4 text-sm focus:border-[#0d6a42] focus:outline-none"
          />
        </div>
        {[
          { v: "all", label: "الكل" },
          { v: "visible", label: "مرئية" },
          { v: "hidden", label: "مخفية" },
          { v: "featured", label: "مميزة" },
          { v: "no-image", label: "بدون صورة" },
        ].map(({ v, label }) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold transition ${
              filter === v ? "bg-[#063f2b] text-white border-[#063f2b]" : "bg-white text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* جدول المنتجات */}
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-right">
            <thead className="bg-gray-50">
              <tr>
                {["المنتج", "الصورة", "السعر", "الكمية", "مرئي", "مميز", "ترتيب", ""].map((h) => (
                  <th key={h} className="p-4 text-sm font-bold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <OnlineProductRow
                  key={p.id}
                  product={p}
                  loadingImage={loadingImage === p.id}
                  onToggleVisible={() => toggleVisible(p)}
                  onToggleFeatured={() => toggleFeatured(p)}
                  onSearchImage={() => handleSearchImage(p)}
                  onApproveImage={() => handleApproveImage(p)}
                  onDeleteImage={() => handleDeleteImage(p)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <Package size={40} className="mx-auto mb-2 opacity-30" />
            <p>لا توجد منتجات</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OnlineProductRow({ product, loadingImage, onToggleVisible, onToggleFeatured, onSearchImage, onApproveImage, onDeleteImage }) {
  const { url, type } = getBestProductImage(product);

  return (
    <tr className="hover:bg-gray-50">
      {/* اسم المنتج */}
      <td className="p-4">
        <div>
          <b className="text-sm">{product.name}</b>
          <p className="text-xs text-gray-400">{product.category}</p>
        </div>
      </td>

      {/* الصورة */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          {url ? (
            <div className="relative">
              <img src={url} alt={product.name} className="h-12 w-12 rounded-xl object-cover border" />
              {type === "auto" && (
                <span className={`absolute -bottom-1 -right-1 rounded-full px-1 text-xs font-bold ${product.imageApproved ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {product.imageApproved ? "✓" : "؟"}
                </span>
              )}
            </div>
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gray-100 text-gray-300">
              <Image size={20} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            {!product.imageUrl && !product.autoImageUrl && (
              <button
                onClick={onSearchImage}
                disabled={loadingImage}
                className="flex items-center gap-1 rounded-xl bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 disabled:opacity-50"
              >
                {loadingImage ? <RefreshCw size={11} className="animate-spin" /> : <Image size={11} />}
                بحث عن صورة
              </button>
            )}
            {type === "auto" && !product.imageApproved && (
              <button
                onClick={onApproveImage}
                className="flex items-center gap-1 rounded-xl bg-green-50 px-2 py-1 text-xs font-bold text-green-600 hover:bg-green-100"
              >
                <CheckCircle2 size={11} /> اعتماد
              </button>
            )}
            {type === "auto" && (
              <button
                onClick={onDeleteImage}
                className="flex items-center gap-1 rounded-xl bg-red-50 px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-100"
              >
                <Trash2 size={11} /> حذف
              </button>
            )}
            {product.imageUrl && (
              <button
                onClick={onSearchImage}
                disabled={loadingImage}
                className="flex items-center gap-1 rounded-xl bg-gray-50 px-2 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                <RefreshCw size={11} /> تحديث
              </button>
            )}
          </div>
        </div>
      </td>

      {/* السعر */}
      <td className="p-4 font-black text-[#0d6a42]">{money(product.salePrice)}</td>

      {/* الكمية */}
      <td className="p-4">
        <span className={`text-sm font-bold ${Number(product.quantity) <= 0 ? "text-red-500" : "text-gray-700"}`}>
          {product.quantity} {product.unit}
        </span>
      </td>

      {/* مرئي */}
      <td className="p-4">
        <button
          onClick={onToggleVisible}
          className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-bold transition ${
            product.isOnlineVisible
              ? "bg-green-50 text-green-700 hover:bg-green-100"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {product.isOnlineVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          {product.isOnlineVisible ? "مرئي" : "مخفي"}
        </button>
      </td>

      {/* مميز */}
      <td className="p-4">
        <button
          onClick={onToggleFeatured}
          className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-bold transition ${
            product.featuredOnline
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          <Star size={14} fill={product.featuredOnline ? "currentColor" : "none"} />
          {product.featuredOnline ? "مميز" : "عادي"}
        </button>
      </td>

      {/* ترتيب */}
      <td className="p-4">
        <input
          type="number"
          defaultValue={product.onlineSortOrder || 0}
          onBlur={(e) => updateProductOnlineFields(product.id, { onlineSortOrder: Number(e.target.value) })}
          className="w-16 rounded-xl border px-2 py-1 text-center text-sm focus:border-[#0d6a42] focus:outline-none"
        />
      </td>

      {/* تعديل */}
      <td className="p-4">
        <Link
          to={`/products/${product.id}/edit`}
          className="flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-sm font-bold text-[#0d6a42] hover:bg-green-100"
        >
          <Edit3 size={14} /> تعديل
        </Link>
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────
// إدارة الطلبات الأونلاين
// ──────────────────────────────────────────────
export function OnlineOrdersManager({ orders }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingOrder, setLoadingOrder] = useState(null);

  const filtered = orders.filter((o) => statusFilter === "all" || o.status === statusFilter);

  async function handleAccept(order) {
    if (!confirm(`قبول الطلب #${order.orderNumber} وخصم الكميات من المخزون؟`)) return;
    setLoadingOrder(order.id);
    try {
      await acceptOrder(order.id, order);
    } catch (err) {
      alert("خطأ: " + err.message);
    } finally {
      setLoadingOrder(null);
    }
  }

  async function handleAdvance(order) {
    const next = STATUS_FLOW[order.status];
    if (!next) return;
    setLoadingOrder(order.id);
    try {
      await updateOrderStatus(order.id, next);
    } finally {
      setLoadingOrder(null);
    }
  }

  async function handleCancel(order) {
    if (!confirm("إلغاء هذا الطلب؟")) return;
    setLoadingOrder(order.id);
    try {
      await cancelOrder(order.id);
    } finally {
      setLoadingOrder(null);
    }
  }

  const counts = {
    all: orders.length,
    new: orders.filter((o) => o.status === "new").length,
    preparing: orders.filter((o) => o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <div className="space-y-5">
      {/* إحصائيات */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat label="جديد" value={counts.new} color="blue" />
        <MiniStat label="قيد التحضير" value={counts.preparing} color="orange" />
        <MiniStat label="جاهز" value={counts.ready} color="green" />
        <MiniStat label="مُسلَّم" value={counts.delivered} color="gray" />
        <MiniStat label="ملغي" value={counts.cancelled} color="red" />
      </div>

      {/* فلاتر الحالة */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { v: "all", label: "الكل" },
          { v: "new", label: "جديد" },
          { v: "preparing", label: "قيد التحضير" },
          { v: "ready", label: "جاهز" },
          { v: "delivered", label: "مُسلَّم" },
          { v: "cancelled", label: "ملغي" },
        ].map(({ v, label }) => (
          <button
            key={v}
            onClick={() => setStatusFilter(v)}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold transition ${
              statusFilter === v ? "bg-[#063f2b] text-white border-[#063f2b]" : "bg-white text-gray-600"
            }`}
          >
            {label} {counts[v] > 0 && <span className="mr-1 text-xs opacity-70">({counts[v]})</span>}
          </button>
        ))}
      </div>

      {/* قائمة الطلبات */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-3xl border bg-white p-12 text-center text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">لا توجد طلبات</p>
          </div>
        )}
        {filtered.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            loading={loadingOrder === order.id}
            onView={() => setSelectedOrder(order)}
            onAccept={() => handleAccept(order)}
            onAdvance={() => handleAdvance(order)}
            onCancel={() => handleCancel(order)}
          />
        ))}
      </div>

      {/* تفاصيل الطلب */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAccept={() => { handleAccept(selectedOrder); setSelectedOrder(null); }}
          onAdvance={() => { handleAdvance(selectedOrder); setSelectedOrder(null); }}
          onCancel={() => { handleCancel(selectedOrder); setSelectedOrder(null); }}
        />
      )}
    </div>
  );
}

function OrderCard({ order, loading, onView, onAccept, onAdvance, onCancel }) {
  const nextLabel = order.status === "new" ? "قبول الطلب" : STATUS_LABELS[STATUS_FLOW[order.status]];
  const canAdvance = !!STATUS_FLOW[order.status];
  const canAccept = order.status === "new";

  return (
    <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-[#063f2b]">#{order.orderNumber}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <span className="text-sm text-gray-400">
          {order.createdAt?.toDate ? shortDate(order.createdAt) : "—"}
        </span>
      </div>
      <div className="p-5">
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <Info label="الزبون" value={order.customerName} />
          <Info label="الهاتف" value={order.customerPhone} />
          <Info label="العنوان" value={order.customerAddress} />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {(order.items || []).map((item, i) => (
            <span key={i} className="rounded-2xl bg-gray-100 px-3 py-1 text-xs font-bold">
              {item.name} × {item.quantity}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xl font-black text-[#063f2b]">{money(order.total)}</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={onView} className="flex items-center gap-1.5 rounded-2xl border px-4 py-2 text-sm font-bold hover:bg-gray-50">
              <Eye size={14} /> تفاصيل
            </button>
            {canAccept && (
              <button
                onClick={onAccept}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-2xl bg-[#063f2b] px-4 py-2 text-sm font-black text-white hover:bg-[#0d6a42] disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> قبول الطلب
              </button>
            )}
            {!canAccept && canAdvance && (
              <button
                onClick={onAdvance}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {nextLabel} ←
              </button>
            )}
            {order.status !== "cancelled" && order.status !== "delivered" && (
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <X size={14} /> إلغاء
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailsModal({ order, onClose, onAccept, onAdvance, onCancel }) {
  const canAccept = order.status === "new";
  const canAdvance = !!STATUS_FLOW[order.status];

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* رأس */}
        <div className="flex items-center justify-between border-b bg-[#063f2b] px-6 py-4 text-white">
          <div>
            <h2 className="text-xl font-black">تفاصيل الطلب #{order.orderNumber}</h2>
            <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-black ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/20 hover:bg-white/30">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
          {/* بيانات الزبون */}
          <section>
            <h3 className="mb-3 font-black text-gray-700">بيانات الزبون</h3>
            <div className="grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-3">
              <Info label="الاسم" value={order.customerName} />
              <Info label="الهاتف" value={order.customerPhone} />
              <Info label="العنوان" value={order.customerAddress} />
            </div>
            {order.notes && (
              <div className="mt-2 rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-700">
                ملاحظة: {order.notes}
              </div>
            )}
          </section>

          {/* المنتجات */}
          <section>
            <h3 className="mb-3 font-black text-gray-700">المنتجات المطلوبة</h3>
            <div className="overflow-hidden rounded-2xl border">
              <table className="w-full text-right">
                <thead className="bg-gray-50">
                  <tr>
                    {["المنتج", "الكمية", "السعر", "الإجمالي"].map((h) => (
                      <th key={h} className="p-3 text-sm">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(order.items || []).map((item, i) => (
                    <tr key={i}>
                      <td className="p-3 font-bold">{item.name}</td>
                      <td className="p-3">{item.quantity} {item.unit}</td>
                      <td className="p-3">{money(item.salePrice)}</td>
                      <td className="p-3 font-black text-[#0d6a42]">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* الملخص */}
          <section className="rounded-2xl bg-green-50 p-4">
            <div className="flex justify-between text-sm"><span>المجموع</span><b>{money(order.subtotal)}</b></div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm"><span>التوصيل</span><b>{money(order.deliveryFee)}</b></div>
            )}
            <div className="mt-2 flex justify-between text-xl font-black text-[#063f2b]">
              <span>الإجمالي</span><span>{money(order.total)}</span>
            </div>
          </section>
        </div>

        {/* أزرار */}
        <div className="flex flex-wrap gap-3 border-t p-5">
          {canAccept && (
            <button onClick={onAccept} className="flex items-center gap-2 rounded-2xl bg-[#063f2b] px-5 py-3 font-black text-white hover:bg-[#0d6a42]">
              <CheckCircle2 size={16} /> قبول الطلب
            </button>
          )}
          {!canAccept && canAdvance && (
            <button onClick={onAdvance} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-700">
              {STATUS_LABELS[STATUS_FLOW[order.status]]} ←
            </button>
          )}
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <button onClick={onCancel} className="flex items-center gap-2 rounded-2xl bg-red-50 px-5 py-3 font-bold text-red-600 hover:bg-red-100">
              <X size={16} /> إلغاء الطلب
            </button>
          )}
          <button onClick={handlePrint} className="mr-auto flex items-center gap-2 rounded-2xl border px-5 py-3 font-bold text-gray-600 hover:bg-gray-50">
            <Printer size={16} /> طباعة
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// إعدادات المتجر الإلكتروني
// ──────────────────────────────────────────────
function StoreSettingsPanel() {
  const [form, setForm] = useState(DEFAULT_STORE_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStoreSettings().then(setForm);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveStoreSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("خطأ في الحفظ: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {saved && (
        <div className="flex items-center gap-2 rounded-2xl bg-green-50 p-3 font-bold text-green-700">
          <CheckCircle2 size={18} /> تم حفظ الإعدادات بنجاح
        </div>
      )}

      {/* تفعيل المتجر */}
      <div className="overflow-hidden rounded-3xl border bg-white">
        <div className="border-b bg-gray-50 px-5 py-3">
          <h3 className="font-black text-gray-700">حالة المتجر</h3>
        </div>
        <div className="p-5 space-y-4">
          <ToggleField
            label="تفعيل المتجر الإلكتروني"
            description="عند التعطيل لن يتمكن الزبائن من الوصول للمتجر"
            value={form.onlineStoreEnabled}
            onChange={(v) => setForm({ ...form, onlineStoreEnabled: v })}
          />
          <ToggleField
            label="قبول الطلبات"
            description="عند التعطيل يمكن الزبائن تصفح المنتجات لكن لا يمكنهم الطلب"
            value={form.onlineOrdersEnabled}
            onChange={(v) => setForm({ ...form, onlineOrdersEnabled: v })}
          />
        </div>
      </div>

      {/* معلومات المتجر */}
      <div className="overflow-hidden rounded-3xl border bg-white">
        <div className="border-b bg-gray-50 px-5 py-3">
          <h3 className="font-black text-gray-700">معلومات المتجر</h3>
        </div>
        <div className="p-5 grid gap-4 md:grid-cols-2">
          <SettingsField label="اسم المتجر" value={form.storeName} onChange={(v) => setForm({ ...form, storeName: v })} />
          <SettingsField label="رقم الهاتف" value={form.storePhone} onChange={(v) => setForm({ ...form, storePhone: v })} type="tel" />
          <SettingsField label="العنوان" value={form.storeAddress} onChange={(v) => setForm({ ...form, storeAddress: v })} />
          <SettingsField label="أوقات العمل" value={form.workingHours} onChange={(v) => setForm({ ...form, workingHours: v })} placeholder="مثال: 9:00 ص - 9:00 م" />
          <SettingsField
            label="رسوم التوصيل (دج)"
            value={form.deliveryFee}
            onChange={(v) => setForm({ ...form, deliveryFee: Number(v) })}
            type="number"
          />
          <div className="md:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700">رسالة الترحيب</span>
              <textarea
                value={form.welcomeMessage}
                onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                rows={3}
                className="w-full rounded-2xl border px-4 py-3 text-right focus:border-[#0d6a42] focus:outline-none"
              />
            </label>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-2xl bg-[#063f2b] px-8 py-4 font-black text-white shadow-md hover:bg-[#0d6a42] active:scale-95 disabled:opacity-50"
      >
        {saving ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────
// مكوّنات مساعدة
// ──────────────────────────────────────────────
function ToggleField({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-bold">{label}</p>
        {description && <p className="text-sm text-gray-400">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`flex items-center gap-2 rounded-2xl px-4 py-2 font-bold transition ${
          value ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
        }`}
      >
        {value ? <ToggleRight size={22} className="text-green-600" /> : <ToggleLeft size={22} />}
        {value ? "مفعّل" : "معطّل"}
      </button>
    </div>
  );
}

function SettingsField({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-gray-700">{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border px-4 py-3 text-right focus:border-[#0d6a42] focus:outline-none"
      />
    </label>
  );
}

function MiniStat({ label, value, color }) {
  const colors = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-600",
    gray: "bg-gray-100 text-gray-600",
    orange: "bg-orange-50 text-orange-700",
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[color] || colors.gray}`}>
      <p className="text-2xl font-black">{number(value)}</p>
      <p className="mt-0.5 text-sm font-bold opacity-80">{label}</p>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <b className="text-sm">{value || "-"}</b>
    </div>
  );
}

