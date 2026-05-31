"use client";

import { useMemo, useState } from "react";
import { Edit, PackageSearch, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-provider";
import type { Product } from "@/types";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/utils/format";

export default function InventoryPage() {
  const { data, deleteProduct } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const values = new Set(data?.products.map((product) => product.category));
    return ["all", ...values];
  }, [data?.products]);

  const products = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.products ?? []).filter((product) => {
      const matchesQuery =
        !normalized ||
        product.name.toLowerCase().includes(normalized) ||
        product.qrCode.toLowerCase().includes(normalized) ||
        product.category.toLowerCase().includes(normalized);
      const matchesCategory = category === "all" || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [category, data?.products, query]);

  return (
    <div>
      <PageHeader
        icon={PackageSearch}
        title="المخزون"
        description="جدول وبطاقات لكل المنتجات مع حسابات الربح والتنبيهات."
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            label="بحث"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث بالاسم أو QR أو التصنيف"
          />
          <Select label="فلترة التصنيف" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "كل التصنيفات" : item}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {products.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black">{product.name}</p>
                  <p className="mt-1 text-xs text-market-ink/55 dark:text-white/55">
                    {product.qrCode} · {product.category}
                  </p>
                </div>
                <div
                  className={`rounded-lg px-3 py-2 text-sm font-black ${
                    product.quantity <= 0
                      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100"
                      : product.quantity <= product.lowStockAlert
                        ? "bg-citrus-100 text-amber-900 dark:bg-citrus-500/20 dark:text-citrus-100"
                        : "bg-leaf-100 text-leaf-700 dark:bg-leaf-500/20 dark:text-leaf-50"
                  }`}
                >
                  {formatNumber(product.quantity)} قطعة
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-market-ink/55 dark:text-white/55">تكلفة القطعة</p>
                  <p className="font-black">{formatCurrency(product.unitCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-market-ink/55 dark:text-white/55">سعر البيع</p>
                  <p className="font-black">{formatCurrency(product.sellPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-market-ink/55 dark:text-white/55">ربح القطعة</p>
                  <p className="font-black">{formatCurrency(product.profitPerUnit)}</p>
                </div>
                <div>
                  <p className="text-xs text-market-ink/55 dark:text-white/55">نسبة الربح</p>
                  <p className="font-black">{formatPercent(product.profitPercent)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3 text-xs text-market-ink/55 dark:border-white/10 dark:text-white/55">
                <span>آخر تعديل: {formatDate(product.updatedAt)}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(product)} title="تعديل">
                    <Edit className="h-4 w-4" />
                    تعديل
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(product)} title="حذف">
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Search} title="لا توجد منتجات مطابقة" body="غيّر البحث أو أضف منتجاً جديداً من صفحة إدخال المنتج." />
      )}

      {editing ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-3xl">
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">تعديل المنتج</h2>
                <Button variant="secondary" onClick={() => setEditing(null)}>
                  إغلاق
                </Button>
              </div>
              <ProductForm product={editing} onSaved={() => setEditing(null)} />
            </Card>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف المنتج"
        body={`هل تريد حذف ${deleting?.name ?? "هذا المنتج"}؟ لا يمكن التراجع عن العملية بعد المزامنة.`}
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
