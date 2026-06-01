"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Box, Filter, Grid2X2, Plus, QrCode, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-provider";
import type { Product } from "@/types";
import { formatCurrency, formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

function statusFor(product: Product) {
  if (product.quantity <= 0) {
    return { label: "نفد", className: "bg-red-50 text-red-600", tone: "red" as const };
  }
  if (product.quantity <= product.lowStockAlert) {
    return { label: "منخفض", className: "bg-orange-50 text-orange-600", tone: "orange" as const };
  }
  return { label: "متوفر", className: "bg-leaf-50 text-leaf-700", tone: "green" as const };
}

export default function InventoryPage() {
  const { data, deleteProduct } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const categories = useMemo(
    () => [...new Set((data?.products ?? []).map((product) => product.category).filter(Boolean))],
    [data?.products],
  );

  const products = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.products ?? [])
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
        if (filter.startsWith("category:")) return product.category === filter.replace("category:", "");
        return true;
      });
  }, [data?.products, filter, query]);

  if (!data) {
    return null;
  }

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="" className="ios-avatar" />
        <div className="flex-1 pt-2">
          <h1 className="ios-title">المخزون</h1>
          <p className="ios-subtitle">إدارة وتتبع جميع منتجاتك</p>
        </div>
        <button className="ios-circle-button" title="بحث">
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">المخزون</h1>
          <p className="mt-1 text-market-ink/60">قائمة المنتجات، الكميات، أسعار البيع وتنبيهات النفاد.</p>
        </div>
        <Link href="/products/new" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          إضافة منتج
        </Link>
      </div>

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
        <button className="ios-chip min-h-10 px-4">
          <SlidersHorizontal className="h-4 w-4" />
          الأحدث أولاً
        </button>
      </div>

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {products.map((product) => {
          const status = statusFor(product);
          return (
            <article key={product.id} className="ios-card-tight flex items-center gap-4">
              <button className="self-start rounded-full p-2 text-market-ink/55" onClick={() => setDeleting(product)} title="حذف">
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{product.name}</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-market-ink/55">
                      QR {product.qrCode}
                      <QrCode className="h-4 w-4" />
                    </p>
                  </div>
                  <span className={cn("rounded-2xl px-4 py-2 text-sm font-black", status.className)}>{status.label}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="font-bold text-leaf-700">سعر البيع {formatCurrency(product.sellPrice)}</p>
                  <p className={status.tone === "green" ? "text-leaf-700" : "text-red-600"}>
                    {formatNumber(product.quantity)} وحدة
                  </p>
                </div>
              </div>
              {product.imageUrl ? (
                <button onClick={() => setEditing(product)} className="h-24 w-24 shrink-0 rounded-[22px] border border-black/5 bg-white p-2 shadow-soft">
                  <img src={product.imageUrl} alt="" className="h-full w-full object-contain" />
                </button>
              ) : (
                <button onClick={() => setEditing(product)} className="ios-icon h-20 w-20 shrink-0">
                  <Box className="h-8 w-8" />
                </button>
              )}
            </article>
          );
        })}
      </div>

      <Link
        href="/products/new"
        className="fixed bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-leaf-600 px-8 py-4 text-lg font-black text-white shadow-glass lg:hidden"
      >
        <Plus className="h-6 w-6" />
        إضافة منتج
      </Link>

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
