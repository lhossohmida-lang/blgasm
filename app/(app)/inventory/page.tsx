"use client";

import Link from "next/link";
import { useRef, useMemo, useState } from "react";
import { AlertTriangle, Box, ChevronDown, Filter, Grid2X2, Pencil, Plus, Save, Search, SlidersHorizontal, Star, Trash2, X, Zap } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { Product } from "@/types";
import { formatCurrency, formatNumber, formatStockQuantity, unitPriceLabel } from "@/utils/format";
import { cn } from "@/utils/cn";

const SHORTCUTS_KEY = "blgasm-inventory-shortcuts";

function loadShortcuts(): string[] {
  try {
    const stored = window.localStorage.getItem(SHORTCUTS_KEY);
    if (!stored) return Array(9).fill("");
    const parsed = JSON.parse(stored) as string[];
    if (!Array.isArray(parsed)) return Array(9).fill("");
    return [...parsed, ...Array(9).fill("")].slice(0, 9);
  } catch {
    return Array(9).fill("");
  }
}

function saveShortcuts(shortcuts: string[]) {
  window.localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
}

function getExpiryStatus(expiryDate?: string) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "expired"; // red
  if (diffDays <= 30) return "near"; // orange
  return "ok";
}

function statusFor(product: Product) {
  const expiryStatus = getExpiryStatus(product.expiryDate);

  if (product.quantity <= 0) {
    return { label: "نفد", className: "bg-red-50 text-red-600", rowClass: "border-r-4 border-r-red-400 bg-red-50/20", tone: "red" as const };
  }
  if (expiryStatus === "expired") {
    return { label: "منتهي الصلاحية", className: "bg-red-50 text-red-600", rowClass: "border-r-4 border-r-red-400 bg-red-50/20", tone: "red" as const };
  }
  if (product.quantity <= product.lowStockAlert) {
    return { label: "منخفض", className: "bg-orange-50 text-orange-600", rowClass: "border-r-4 border-r-orange-400 bg-orange-50/20", tone: "orange" as const };
  }
  if (expiryStatus === "near") {
    return { label: "قريب الانتهاء", className: "bg-orange-50 text-orange-600", rowClass: "border-r-4 border-r-orange-400 bg-orange-50/20", tone: "orange" as const };
  }
  return { label: "متوفر", className: "bg-leaf-50 text-leaf-700", rowClass: "", tone: "green" as const };
}

export default function InventoryPage() {
  const { data, deleteProduct } = useStore();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcuts, setShortcuts] = useState<string[]>(() => {
    if (typeof window === "undefined") return Array(9).fill("");
    return loadShortcuts();
  });
  const [shortcutsDirty, setShortcutsDirty] = useState(false);
  const [assigningSlot, setAssigningSlot] = useState<number | null>(null);

  const categories = useMemo(
    () => [...new Set((data?.products ?? []).map((product) => product.category).filter(Boolean))],
    [data?.products],
  );

  const sortOptions = [
    { id: "newest", label: "الأحدث أولاً" },
    { id: "oldest", label: "الأقدم أولاً" },
    { id: "name_asc", label: "الاسم أ-ي" },
    { id: "name_desc", label: "الاسم ي-أ" },
    { id: "qty_asc", label: "أقل كمية" },
    { id: "qty_desc", label: "أعلى كمية" },
  ];

  const products = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = (data?.products ?? [])
      .filter((product) => {
        if (!normalized) return true;
        return (
          product.name.toLowerCase().includes(normalized) ||
          product.qrCode.toLowerCase().includes(normalized) ||
          product.category.toLowerCase().includes(normalized)
        );
      })
      .filter((product) => {
        if (filter === "low") return product.quantity <= product.lowStockAlert;
        if (filter === "expiring") {
          const s = getExpiryStatus(product.expiryDate);
          return s === "near" || s === "expired";
        }
        if (filter.startsWith("category:")) return product.category === filter.replace("category:", "");
        return true;
      });

    return [...filtered].sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "name_asc") return a.name.localeCompare(b.name, "ar");
      if (sort === "name_desc") return b.name.localeCompare(a.name, "ar");
      if (sort === "qty_asc") return a.quantity - b.quantity;
      if (sort === "qty_desc") return b.quantity - a.quantity;
      return 0;
    });
  }, [data?.products, filter, query, sort]);

  function setShortcutAt(index: number, productId: string) {
    const next = [...shortcuts];
    next[index] = productId;
    setShortcuts(next);
    setShortcutsDirty(true);
    setAssigningSlot(null);
  }

  function clearShortcut(index: number) {
    const next = [...shortcuts];
    next[index] = "";
    setShortcuts(next);
    setShortcutsDirty(true);
  }

  function persistShortcuts() {
    saveShortcuts(shortcuts);
    setShortcutsDirty(false);
    window.dispatchEvent(new CustomEvent("blgasm-shortcuts-updated", { detail: { shortcuts } }));
    notify({ tone: "success", title: "تم حفظ الاختصارات بنجاح" });
  }

  if (!data) {
    return null;
  }

  const shortcutProducts = shortcuts.map((id) => data.products.find((p) => p.id === id) ?? null);

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="" className="ios-avatar" />
        <div className="flex-1 pt-2">
          <h1 className="ios-title">المخزون</h1>
          <p className="ios-subtitle">إدارة وتتبع جميع منتجاتك</p>
        </div>
        <Link href="/products/new" className="ios-circle-button text-leaf-600 bg-leaf-50 flex items-center justify-center lg:hidden" title="إضافة منتج">
          <Plus className="h-5 w-5" />
        </Link>
        <button className="ios-circle-button" title="بحث">
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">المخزون</h1>
          <p className="mt-1 text-market-ink/60">قائمة المنتجات، الكميات، أسعار البيع وتنبيهات النفاد.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowShortcuts((v) => !v)}>
            <Zap className="h-4 w-4" />
            الاختصارات
          </Button>
          <Link href="/products/new" className="btn btn-primary">
            <Plus className="h-4 w-4" />
            إضافة منتج
          </Link>
        </div>
      </div>

      {/* Shortcuts panel */}
      {showShortcuts ? (
        <div className="mb-6 ios-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              اختصارات البيع السريع
            </h2>
            <button onClick={() => setAssigningSlot(null)} className="text-market-ink/40 hover:text-market-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-market-ink/55">اضغط على خانة لتعيين منتج اختصار. ستظهر هذه المنتجات كأزرار سريعة في صفحة البيع.</p>
          <div className="grid grid-cols-3 gap-3">
            {shortcutProducts.map((product, idx) => (
              <div key={idx} className="relative">
                {product ? (
                  <button
                    onClick={() => setAssigningSlot(idx)}
                    className="w-full rounded-3xl border-2 border-leaf-200 bg-leaf-50 p-3 text-center transition hover:border-leaf-400"
                  >
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt="" className="mx-auto h-10 w-10 object-contain" />
                      : <Star className="mx-auto h-8 w-8 text-leaf-400" />
                    }
                    <p className="mt-1 line-clamp-1 text-xs font-black">{product.name}</p>
                    <p className="text-xs text-leaf-700">{formatCurrency(product.sellPrice)}</p>
                  </button>
                ) : (
                  <button
                    onClick={() => setAssigningSlot(idx)}
                    className="flex h-28 w-full items-center justify-center rounded-3xl border-2 border-dashed border-black/15 bg-white/50 transition hover:border-leaf-400 hover:bg-leaf-50"
                  >
                    <div className="text-center">
                      <Plus className="mx-auto h-6 w-6 text-market-ink/30" />
                      <p className="mt-1 text-xs text-market-ink/40">خانة {idx + 1}</p>
                    </div>
                  </button>
                )}
                {product ? (
                  <button
                    onClick={() => clearShortcut(idx)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-soft"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {/* Product picker for slot assignment */}
          {assigningSlot !== null ? (
            <div className="mt-4 space-y-2 rounded-3xl border border-black/10 bg-white/70 p-4">
              <p className="font-black text-market-ink/70">اختر منتجاً للخانة {assigningSlot + 1}:</p>
              <div className="max-h-52 overflow-y-auto space-y-1">
                {data.products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setShortcutAt(assigningSlot, product.id)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-right hover:bg-leaf-50 transition"
                  >
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-lg object-contain" />
                      : <Box className="h-8 w-8 flex-shrink-0 text-leaf-400" />
                    }
                    <span className="flex-1 font-bold">{product.name}</span>
                    <span className="text-sm font-black text-leaf-700">{formatCurrency(product.sellPrice)}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setAssigningSlot(null)} className="w-full text-sm font-bold text-market-ink/45 underline">إلغاء</button>
            </div>
          ) : null}

          <Button type="button" className="w-full" onClick={persistShortcuts} disabled={!shortcutsDirty}>
            <Save className="h-4 w-4" />
            حفظ الاختصارات
          </Button>
        </div>
      ) : null}

      <div className="ios-search mb-4">
        <Search className="h-6 w-6 text-market-ink/45" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث عن منتج بالاسم أو الباركود"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-market-ink/42"
        />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "الكل", icon: Grid2X2 },
          { id: "low", label: "منخفض", icon: AlertTriangle },
          { id: "expiring", label: "قريب الانتهاء", icon: AlertTriangle },
          ...categories.map((category) => ({ id: `category:${category}`, label: category, icon: Box })),
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn("ios-chip shrink-0", filter === item.id && "ios-chip-active")}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
        <button type="button" className="ios-chip shrink-0">
          <Filter className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-market-ink/65">{formatNumber(products.length)} منتج</span>
        <div className="relative" ref={sortMenuRef}>
          <button
            type="button"
            className="ios-chip min-h-10 px-4 gap-1"
            onClick={() => setShowSortMenu((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {sortOptions.find((o) => o.id === sort)?.label ?? "الأحدث أولاً"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSortMenu && "rotate-180")} />
          </button>
          {showSortMenu ? (
            <div className="absolute left-0 top-full mt-2 z-30 w-44 rounded-2xl border border-black/10 bg-white shadow-glass dark:bg-[#14211b] dark:border-white/10 overflow-hidden">
              {sortOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setSort(option.id); setShowSortMenu(false); }}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-3 text-sm text-right transition hover:bg-leaf-50 dark:hover:bg-leaf-950/30",
                    sort === option.id && "font-black text-leaf-700 bg-leaf-50/60 dark:bg-leaf-950/20"
                  )}
                >
                  {sort === option.id && <span className="h-1.5 w-1.5 rounded-full bg-leaf-600 flex-shrink-0" />}
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Products as rows */}
      <div className="ios-card overflow-hidden p-0">
        {/* Table header */}
        <div className="grid grid-cols-[1.5fr_65px_70px_70px] lg:grid-cols-[1fr_80px_90px_90px_90px] gap-2 border-b border-black/5 bg-market-ink/3 px-4 py-3 text-xs font-bold text-market-ink/50">
          <span>المنتج</span>
          <span className="text-center">الكمية</span>
          <span className="hidden lg:block text-center">سعر الشراء</span>
          <span className="text-center">سعر البيع</span>
          <span className="text-left">الإجراءات</span>
        </div>
        <div className="divide-y divide-black/5">
          {products.map((product) => {
            const status = statusFor(product);
            const expiryStatus = getExpiryStatus(product.expiryDate);
            return (
              <div
                key={product.id}
                className={cn(
                  "grid grid-cols-[1.5fr_65px_70px_70px] lg:grid-cols-[1fr_80px_90px_90px_90px] items-center gap-2 px-4 py-3 transition",
                  status.rowClass,
                )}
              >
                {/* Name + status */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-lg object-contain" />
                      : null
                    }
                    <div className="min-w-0">
                      <p className="truncate font-black">{product.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-bold", status.className)}>
                          {status.label}
                        </span>
                        {expiryStatus === "near" && product.expiryDate ? (
                          <span className="text-xs text-orange-600 font-bold">
                            ينتهي {new Date(product.expiryDate).toLocaleDateString("ar-DZ")}
                          </span>
                        ) : null}
                        {expiryStatus === "expired" && product.expiryDate ? (
                          <span className="text-xs text-red-600 font-bold">
                            انتهى {new Date(product.expiryDate).toLocaleDateString("ar-DZ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quantity */}
                <div className="text-center">
                  <p className={cn(
                    "font-black text-sm",
                    status.tone === "red" ? "text-red-600" : status.tone === "orange" ? "text-orange-600" : "text-leaf-700"
                  )}>
                    {formatStockQuantity(product.quantity, product.saleUnit)}
                  </p>
                </div>

                {/* Buy price */}
                <div className="hidden lg:block text-center">
                  <p className="text-sm font-bold text-market-ink/70">{formatCurrency(product.wholesalePrice)}</p>
                  <p className="text-xs text-market-ink/40">{unitPriceLabel(product.saleUnit)}</p>
                </div>

                {/* Sell price */}
                <div className="text-center">
                  <p className="text-sm font-black text-leaf-700">{formatCurrency(product.sellPrice)}</p>
                  <p className="text-xs text-market-ink/40">{unitPriceLabel(product.saleUnit)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf-50 text-leaf-700 hover:bg-leaf-100 transition"
                    onClick={() => setEditing(product)}
                    title="تعديل"
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition"
                    onClick={() => setDeleting(product)}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {products.length === 0 ? (
            <div className="px-5 py-10 text-center text-market-ink/45">لا توجد منتجات</div>
          ) : null}
        </div>
      </div>

      {/* Mobile shortcuts toggle */}
      <button
        className="fixed bottom-28 right-5 z-20 flex items-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-lg font-black text-white shadow-glass lg:hidden"
        onClick={() => setShowShortcuts((v) => !v)}
      >
        <Zap className="h-5 w-5" />
      </button>

      {editing ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-3xl">
            <div className="ios-card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">تعديل المنتج</h2>
                <Button variant="secondary" onClick={() => setEditing(null)}>إغلاق</Button>
              </div>
              <ProductForm product={editing} onSaved={() => setEditing(null)} />
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف المنتج"
        body={`هل تريد حذف ${deleting?.name ?? "هذا المنتج"}؟ لا يمكن التراجع بعد المزامنة.`}
        confirmLabel="حذف"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteProduct(deleting.id);
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
