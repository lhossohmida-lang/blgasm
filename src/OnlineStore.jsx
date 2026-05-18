/**
 * OnlineStore.jsx
 * واجهة المتجر الإلكتروني للزبائن — عامة بدون تسجيل دخول.
 * تصميم RTL عربي متجاوب، مطابق لهوية التطبيق الرئيسية.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  getBestProductImage,
  STATUS_LABELS,
  createOnlineOrder,
  subscribeOnlineProducts,
  useStoreSettings,
} from "./lib/onlineStoreService";

// ──────────────────────────────────────────────
// ثوابت
// ──────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "featured", label: "الأكثر تميزًا" },
  { value: "price_asc", label: "السعر: الأقل أولاً" },
  { value: "price_desc", label: "السعر: الأعلى أولاً" },
  { value: "newest", label: "الأحدث" },
];

const ONLINE_CATEGORIES = ["الكل", "مواد أساسية", "مشروبات", "ألبان", "حلويات", "منظفات", "أخرى"];

function money(v) {
  return `${Number(v || 0).toLocaleString("ar-DZ-u-nu-latn")} دج`;
}

// ──────────────────────────────────────────────
// OnlineStore — المكوّن الجذري
// ──────────────────────────────────────────────
export default function OnlineStore() {
  const [products, setProducts] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const [sort, setSort] = useState("featured");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // جلب الإعدادات — useStoreSettings هي دالة subscribe وليست React hook
  useEffect(() => {
    const unsub = useStoreSettings((s) => setStoreSettings(s));
    return unsub;
  }, []);

  // جلب المنتجات — مع معالجة الخطأ لضمان إيقاف حالة التحميل دائماً
  useEffect(() => {
    setLoading(true);
    setFetchError(null);

    const unsub = subscribeOnlineProducts(
      (data) => {
        setProducts(data);
        setLoading(false);
        setFetchError(null);
      },
      (err) => {
        // فشل الاستعلام: أوقف التحميل وأظهر رسالة خطأ
        setFetchError(err.message || "خطأ في جلب المنتجات");
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  // ── مساعدة: هل يوجد مخزون كافٍ؟
  function hasStock(product, currentQty = 0) {
    if (product.isWeightBased) {
      // للمنتجات الوزنية نسمح دائماً بالإضافة (الكمية تُدخَل لاحقاً)
      return Number(product.stockInGrams || 0) > 0;
    }
    return Number(product.quantity || 0) > currentQty;
  }

  // عمليات السلة
  function addToCart(product) {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        if (!hasStock(product, exists.qty)) return prev;
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }

  function changeQty(id, delta) {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
        .filter((i) => i.qty > 0)
    );
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  const cartTotal = cart.reduce((s, i) => s + i.salePrice * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // تصفية وترتيب المنتجات
  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const matchCat = category === "الكل" || p.category === category;
      const matchSearch = !search || `${p.name} ${p.category}`.includes(search);
      return matchCat && matchSearch;
    });
    if (sort === "price_asc") list = [...list].sort((a, b) => a.salePrice - b.salePrice);
    else if (sort === "price_desc") list = [...list].sort((a, b) => b.salePrice - a.salePrice);
    else if (sort === "newest") list = [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    else list = [...list].sort((a, b) => (b.featuredOnline ? 1 : 0) - (a.featuredOnline ? 1 : 0));
    return list;
  }, [products, category, search, sort]);

  const featured = products.filter((p) => {
    const inStock = p.isWeightBased
      ? Number(p.stockInGrams || 0) > 0
      : Number(p.quantity || 0) > 0;
    return p.featuredOnline && inStock;
  });

  const settings = storeSettings || {
    storeName: "متجر المواد الغذائية",
    welcomeMessage: "أهلاً بكم في متجرنا الإلكتروني!",
    deliveryFee: 0,
    onlineStoreEnabled: true,
    onlineOrdersEnabled: true,
    workingHours: "9:00 ص - 9:00 م",
    storePhone: "",
    storeAddress: "",
  };

  if (!settings.onlineStoreEnabled) {
    return <StoreClosed settings={settings} />;
  }

  return (
    <div className="min-h-screen bg-[#f8faf8] font-[system-ui] text-right" dir="rtl">
      <StoreHeader
        settings={settings}
        cartCount={cartCount}
        search={search}
        setSearch={setSearch}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 pb-32 pt-6 md:pb-10">
        {/* بانر ترحيبي */}
        {settings.welcomeMessage && (
          <StoreBanner settings={settings} />
        )}

        {/* منتجات مميزة */}
        {featured.length > 0 && (
          <FeaturedSection
            products={featured}
            onAdd={addToCart}
            cart={cart}
            onQty={changeQty}
          />
        )}

        {/* الفلاتر */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            {ONLINE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-2xl border px-5 py-2.5 text-sm font-bold transition-all ${
                  category === c
                    ? "border-[#063f2b] bg-[#063f2b] text-white shadow-md"
                    : "border-gray-200 bg-white text-gray-600 hover:border-[#0d6a42] hover:text-[#0d6a42]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-bold text-gray-700 focus:border-[#0d6a42] focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute left-3 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* شبكة المنتجات */}
        {loading ? (
          <ProductSkeleton />
        ) : fetchError ? (
          <ErrorState message={fetchError} onRetry={() => window.location.reload()} />
        ) : filtered.length === 0 ? (
          <EmptyState search={search} category={category} totalProducts={products.length} />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-800">
                {category === "الكل" ? "جميع المنتجات" : category}
                <span className="mr-2 text-base font-bold text-gray-400">({filtered.length})</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAdd={() => addToCart(p)}
                  cartQty={cart.find((i) => i.id === p.id)?.qty || 0}
                  onQty={(delta) => changeQty(p.id, delta)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* زر سلة عائم — موبايل */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#063f2b] px-7 py-4 text-white shadow-2xl shadow-[#063f2b]/40 transition-all hover:scale-105 active:scale-95 md:hidden"
        >
          <ShoppingCart size={22} />
          <span className="font-black">السلة ({cartCount})</span>
          <span className="rounded-full bg-white/20 px-3 py-0.5 text-sm font-black">{money(cartTotal)}</span>
        </button>
      )}

      {/* درج السلة */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          settings={settings}
          onQty={changeQty}
          onRemove={removeFromCart}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        />
      )}

      {/* نموذج إتمام الطلب */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          settings={settings}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={(order) => {
            setCart([]);
            setCheckoutOpen(false);
            setSuccessOrder(order);
          }}
        />
      )}

      {/* تأكيد الطلب */}
      {successOrder && (
        <OrderSuccessModal order={successOrder} onClose={() => setSuccessOrder(null)} />
      )}

      <StoreFooter settings={settings} />
    </div>
  );
}

// ──────────────────────────────────────────────
// رأس المتجر
// ──────────────────────────────────────────────
function StoreHeader({ settings, cartCount, search, setSearch, onCartClick }) {
  return (
    <header className="sticky top-0 z-30 bg-[#063f2b] text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <img src="/logo.png" alt="logo" className="h-12 w-12 shrink-0 object-contain drop-shadow" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black">{settings.storeName}</h1>
          {settings.workingHours && (
            <p className="flex items-center gap-1 text-xs text-white/70">
              <Clock size={11} /> {settings.workingHours}
            </p>
          )}
        </div>
        {/* بحث */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute right-3 top-3 text-white/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-64 rounded-2xl border border-white/20 bg-white/10 py-2.5 pl-4 pr-10 text-sm text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
          />
        </div>
        {/* سلة */}
        <button
          onClick={onCartClick}
          className="relative flex shrink-0 items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 font-bold transition hover:bg-white/25"
        >
          <ShoppingCart size={20} />
          <span className="hidden sm:inline">السلة</span>
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-orange-400 text-xs font-black text-white">
              {cartCount}
            </span>
          )}
        </button>
      </div>
      {/* بحث موبايل */}
      <div className="px-4 pb-3 md:hidden">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-full rounded-2xl border-none bg-white py-2.5 pl-4 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────
// بانر ترحيبي
// ──────────────────────────────────────────────
function StoreBanner({ settings }) {
  return (
    <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-l from-[#063f2b] to-[#0d6a42] p-6 text-white shadow-xl md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-bold text-white/75">مرحباً بكم في</p>
          <h2 className="text-2xl font-black md:text-3xl">{settings.storeName}</h2>
          <p className="mt-2 text-sm text-white/80 md:text-base">{settings.welcomeMessage}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {settings.storePhone && (
              <a href={`tel:${settings.storePhone}`} className="flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2 text-sm font-bold hover:bg-white/30">
                <Phone size={14} /> {settings.storePhone}
              </a>
            )}
            {settings.storeAddress && (
              <span className="flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2 text-sm font-bold">
                <MapPin size={14} /> {settings.storeAddress}
              </span>
            )}
            {settings.deliveryFee > 0 && (
              <span className="flex items-center gap-2 rounded-2xl bg-orange-500/80 px-4 py-2 text-sm font-bold">
                <Tag size={14} /> توصيل: {money(settings.deliveryFee)}
              </span>
            )}
            {settings.deliveryFee === 0 && (
              <span className="flex items-center gap-2 rounded-2xl bg-green-500/80 px-4 py-2 text-sm font-bold">
                <Zap size={14} /> توصيل مجاني
              </span>
            )}
          </div>
        </div>
        <img src="/logo.png" alt="" className="hidden h-28 w-28 object-contain opacity-20 md:block" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// قسم المنتجات المميزة
// ──────────────────────────────────────────────
function FeaturedSection({ products, onAdd, cart, onQty }) {
  const scrollRef = useRef(null);
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-600">
          <Star size={18} fill="currentColor" />
        </div>
        <h2 className="text-xl font-black text-gray-800">منتجات مميزة</h2>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3"
        style={{ scrollbarWidth: "none" }}
      >
        {products.map((p) => {
          const { url } = getBestProductImage(p);
          const cartItem = cart.find((i) => i.id === p.id);
          return (
            <div key={p.id} className="shrink-0 w-44 md:w-52">
              <div className="relative overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-md">
                <div className="absolute left-2 top-2 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-white">
                  <Star size={10} className="inline" fill="white" /> مميز
                </div>
                <div className="h-36 overflow-hidden bg-gray-50">
                  {url ? (
                    <img src={url} alt={p.name} className="h-full w-full object-cover transition-transform hover:scale-105" />
                  ) : (
                    <div className="grid h-full place-items-center text-gray-300">
                      <Package size={40} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-black text-gray-800">{p.name}</p>
                  <p className="mt-1 text-base font-black text-[#0d6a42]">{money(p.salePrice)}</p>
                  {cartItem ? (
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-green-50">
                      <button onClick={() => onQty(p.id, -1)} className="px-3 py-1.5 font-black text-[#0d6a42]">-</button>
                      <span className="font-black text-[#063f2b]">{cartItem.qty}</span>
                      <button
                        onClick={() => { if (cartItem.qty < Number(p.quantity)) onQty(p.id, 1); }}
                        className="px-3 py-1.5 font-black text-[#0d6a42]"
                      >+</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAdd(p)}
                      className="mt-2 w-full rounded-xl bg-[#063f2b] py-1.5 text-xs font-black text-white transition hover:bg-[#0d6a42] active:scale-95"
                    >
                      إضافة للسلة
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────
// بطاقة منتج
// ──────────────────────────────────────────────
function ProductCard({ product, onAdd, cartQty, onQty }) {
  const [imgErr, setImgErr] = useState(false);

  // أولوية الصورة: imageUrl → autoImageUrl → placeholder داخلي
  const imgSrc = !imgErr
    ? (product.imageUrl || product.autoImageUrl || null)
    : null;

  // تحقق من المخزون بشكل صحيح للمنتجات الوزنية والعادية
  const available = product.isWeightBased
    ? Number(product.stockInGrams || 0) > 0
    : Number(product.quantity || 0) > 0;

  // حد الكمية في السلة
  const maxQty = product.isWeightBased ? 99 : Number(product.quantity || 0);

  return (
    <div className={`group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all hover:shadow-md ${!available ? "opacity-60" : ""}`}>
      {/* شارات */}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        {product.featuredOnline && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-white">
            <Star size={9} className="inline" fill="white" /> مميز
          </span>
        )}
        {product.isWeightBased && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-600">⚖️ وزني</span>
        )}
      </div>

      {/* صورة المنتج */}
      <div className="relative h-36 overflow-hidden bg-gray-50 md:h-44">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-gray-200">
            <Package size={48} />
          </div>
        )}
        {!available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white px-4 py-1.5 text-sm font-black text-gray-700">غير متوفر</span>
          </div>
        )}
      </div>

      {/* بيانات المنتج */}
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-black leading-tight text-gray-800">{product.name}</p>
        {product.onlineDescription && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{product.onlineDescription}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-black text-[#0d6a42]">
            {money(product.salePrice)}
            {product.isWeightBased && <span className="text-xs font-normal text-gray-400">/كغ</span>}
          </span>
          <span className="text-xs text-gray-400">{product.unit}</span>
        </div>

        {available ? (
          cartQty > 0 ? (
            <div className="mt-2 flex items-center justify-between rounded-2xl border border-green-100 bg-green-50">
              <button onClick={() => onQty(-1)} className="rounded-r-2xl px-3 py-2 text-lg font-black text-[#0d6a42] hover:bg-green-100">-</button>
              <span className="font-black text-[#063f2b]">{cartQty}</span>
              <button
                onClick={() => { if (cartQty < maxQty) onQty(1); }}
                disabled={cartQty >= maxQty}
                className="rounded-l-2xl px-3 py-2 text-lg font-black text-[#0d6a42] hover:bg-green-100 disabled:opacity-40"
              >+</button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#063f2b] py-2 text-sm font-black text-white transition hover:bg-[#0d6a42] active:scale-95"
            >
              <Plus size={15} /> إضافة
            </button>
          )
        ) : (
          <div className="mt-2 rounded-2xl bg-gray-100 py-2 text-center text-sm font-bold text-gray-400">
            غير متوفر
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// درج السلة
// ──────────────────────────────────────────────
function CartDrawer({ cart, settings, onQty, onRemove, onClose, onCheckout }) {
  const subtotal = cart.reduce((s, i) => s + i.salePrice * i.qty, 0);
  const deliveryFee = Number(settings.deliveryFee || 0);
  const total = subtotal + deliveryFee;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl" dir="rtl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <ShoppingBag className="text-[#0d6a42]" /> سلة المشتريات
          </h2>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
            <ShoppingCart size={64} strokeWidth={1} />
            <p className="text-lg font-bold">السلة فارغة</p>
            <button onClick={onClose} className="rounded-2xl bg-[#063f2b] px-6 py-3 font-black text-white">
              تصفح المنتجات
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => {
                const { url } = getBestProductImage(item);
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border bg-gray-50 p-3">
                    {url ? (
                      <img src={url} alt={item.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-green-50 text-[#0d6a42]">
                        <Package size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-bold text-gray-800">{item.name}</p>
                      <p className="text-sm font-black text-[#0d6a42]">{money(item.salePrice)}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex items-center rounded-xl bg-white border">
                          <button onClick={() => onQty(item.id, -1)} className="px-3 py-1 font-black text-gray-600">-</button>
                          <span className="px-2 font-black">{item.qty}</span>
                          <button
                            onClick={() => { if (item.qty < Number(item.quantity)) onQty(item.id, 1); }}
                            disabled={item.qty >= Number(item.quantity)}
                            className="px-3 py-1 font-black text-gray-600 disabled:opacity-40"
                          >+</button>
                        </div>
                        <span className="text-sm text-gray-400">{money(item.salePrice * item.qty)}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemove(item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ملخص */}
            <div className="border-t p-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-500">المجموع</span><b>{money(subtotal)}</b></div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">رسوم التوصيل</span><b>{money(deliveryFee)}</b></div>
              )}
              {deliveryFee === 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">التوصيل</span><b className="text-green-600">مجاني</b></div>
              )}
              <div className="flex justify-between text-xl font-black border-t pt-3">
                <span>الإجمالي</span><span className="text-[#063f2b]">{money(total)}</span>
              </div>
              <button
                onClick={onCheckout}
                disabled={!settings.onlineOrdersEnabled}
                className="w-full rounded-2xl bg-[#063f2b] py-4 text-lg font-black text-white transition hover:bg-[#0d6a42] active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {settings.onlineOrdersEnabled ? "إتمام الطلب ←" : "الطلبات مغلقة مؤقتاً"}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// ──────────────────────────────────────────────
// نموذج إتمام الطلب
// ──────────────────────────────────────────────
function CheckoutModal({ cart, settings, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const subtotal = cart.reduce((s, i) => s + i.salePrice * i.qty, 0);
  const deliveryFee = Number(settings.deliveryFee || 0);
  const total = subtotal + deliveryFee;

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError("الاسم مطلوب");
    if (!form.phone.trim()) return setError("رقم الهاتف مطلوب");
    if (!form.address.trim()) return setError("العنوان مطلوب");
    setError("");
    setLoading(true);
    try {
      const { id, orderNumber } = await createOnlineOrder({
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        customerAddress: form.address.trim(),
        notes: form.notes.trim(),
        items: cart.map((i) => ({
          productId: i.id,
          name: i.name,
          quantity: i.qty,
          unit: i.unit,
          salePrice: i.salePrice,
          total: i.salePrice * i.qty,
        })),
        subtotal,
        deliveryFee,
        total,
      });
      onSuccess({ id, orderNumber, total, customerName: form.name });
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إرسال الطلب");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" dir="rtl">
      <div className="mx-auto my-8 w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-black">إتمام الطلب</h2>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100">
            <X />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-red-600">
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          <FormField label="الاسم الكامل *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="أدخل اسمك الكامل" />
          <FormField label="رقم الهاتف *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="05XXXXXXXX" type="tel" />
          <FormField label="العنوان *" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="الحي، الشارع، رقم البناية..." />
          <FormField label="ملاحظات (اختياري)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="أي تعليمات خاصة بالطلب..." />

          {/* ملخص الطلب */}
          <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
            <h3 className="font-black text-gray-700">ملخص الطلب</h3>
            {cart.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span>{i.name} × {i.qty}</span>
                <b>{money(i.salePrice * i.qty)}</b>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-black text-[#063f2b] text-base">
              <span>الإجمالي</span><span>{money(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#063f2b] py-4 text-lg font-black text-white transition hover:bg-[#0d6a42] active:scale-95 disabled:bg-gray-300"
          >
            {loading ? "جاري إرسال الطلب..." : "تأكيد وإرسال الطلب"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right focus:border-[#0d6a42] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d6a42]/20"
      />
    </label>
  );
}

// ──────────────────────────────────────────────
// نجاح الطلب
// ──────────────────────────────────────────────
function OrderSuccessModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-green-50 text-[#0d6a42]">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-2xl font-black text-gray-800">تم إرسال طلبك!</h2>
        <p className="mt-2 text-gray-500">شكراً {order.customerName}، سنتواصل معك قريباً لتأكيد الطلب.</p>
        <div className="my-5 rounded-2xl bg-green-50 p-4">
          <p className="text-sm text-gray-500">رقم الطلب</p>
          <p className="text-3xl font-black text-[#063f2b]">#{order.orderNumber}</p>
          <p className="mt-1 text-sm text-gray-500">الإجمالي: <b className="text-[#0d6a42]">{money(order.total)}</b></p>
        </div>
        <button onClick={onClose} className="w-full rounded-2xl bg-[#063f2b] py-3 font-black text-white hover:bg-[#0d6a42]">
          العودة للمتجر
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// المتجر مغلق
// ──────────────────────────────────────────────
function StoreClosed({ settings }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f8faf8] p-6" dir="rtl">
      <div className="max-w-sm text-center">
        <img src="/logo.png" alt="logo" className="mx-auto mb-6 h-24 w-24 object-contain" />
        <h1 className="text-3xl font-black text-[#063f2b]">{settings.storeName}</h1>
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-md">
          <p className="text-4xl">🔒</p>
          <h2 className="mt-3 text-xl font-black text-gray-800">المتجر مغلق مؤقتاً</h2>
          <p className="mt-2 text-gray-500">نعمل على تحديث متجرنا، نعود قريباً بأفضل تجربة لكم.</p>
          {settings.workingHours && (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Clock size={14} /> أوقات العمل: {settings.workingHours}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// خطأ في التحميل
// ──────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" dir="rtl">
      <div className="mb-4 grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-400">
        <AlertTriangle size={40} />
      </div>
      <h3 className="text-lg font-black text-gray-700">حدث خطأ أثناء تحميل المنتجات</h3>
      <p className="mt-2 max-w-xs text-sm text-gray-400">{message || "تأكد من اتصالك بالإنترنت وحاول مجدداً."}</p>
      <button
        onClick={onRetry}
        className="mt-6 rounded-2xl bg-[#063f2b] px-6 py-3 font-black text-white hover:bg-[#0d6a42]"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// لا نتائج
// ──────────────────────────────────────────────
function EmptyState({ search, category, totalProducts }) {
  // إذا كان هناك منتجات لكنها مخفية في هذا الفلتر
  const hasProductsElsewhere = totalProducts > 0;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400" dir="rtl">
      <Package size={64} strokeWidth={1} />
      <p className="mt-4 text-lg font-bold text-gray-600">
        {search
          ? `لا توجد نتائج لـ "${search}"`
          : category !== "الكل" && hasProductsElsewhere
          ? `لا توجد منتجات في قسم "${category}"`
          : "لا توجد منتجات متاحة في المتجر حاليًا"}
      </p>
      {(search || (category !== "الكل" && hasProductsElsewhere)) && (
        <p className="mt-1 text-sm text-gray-400">جرّب اختيار "الكل" أو بحثاً مختلفاً</p>
      )}
      {!search && !hasProductsElsewhere && (
        <p className="mt-2 text-sm text-gray-400">نحن نعمل على إضافة المنتجات، تفقدنا قريباً!</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Skeleton تحميل
// ──────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border bg-white">
          <div className="h-36 animate-pulse bg-gray-100 md:h-44" />
          <div className="p-3 space-y-2">
            <div className="h-4 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-gray-100" />
            <div className="h-8 animate-pulse rounded-2xl bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// تذييل المتجر
// ──────────────────────────────────────────────
function StoreFooter({ settings }) {
  return (
    <footer className="mt-16 bg-[#063f2b] py-8 text-center text-white" dir="rtl">
      <img src="/logo.png" alt="logo" className="mx-auto mb-3 h-12 w-12 object-contain opacity-80" />
      <p className="font-bold">{settings.storeName}</p>
      {settings.storePhone && (
        <a href={`tel:${settings.storePhone}`} className="mt-1 flex items-center justify-center gap-2 text-sm text-white/70 hover:text-white">
          <Phone size={13} /> {settings.storePhone}
        </a>
      )}
      {settings.storeAddress && (
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-white/70">
          <MapPin size={13} /> {settings.storeAddress}
        </p>
      )}
      <p className="mt-4 text-xs text-white/40">
        {settings.workingHours && `أوقات العمل: ${settings.workingHours}`}
      </p>
    </footer>
  );
}
