"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/components/providers/store-provider";
import type { Product, ProductDraft } from "@/types";
import { calculateProductPricing } from "@/utils/calculations";
import { formatCurrency, formatPercent } from "@/utils/format";

const emptyDraft: ProductDraft = {
  qrCode: "",
  name: "",
  category: "مواد غذائية",
  wholesalePrice: 0,
  unitsPerWholesale: 1,
  sellPrice: 0,
  quantity: 0,
  lowStockAlert: 5,
  imageUrl: "",
};

function toDraft(product?: Product, qrCode?: string): ProductDraft {
  if (!product) {
    return { ...emptyDraft, qrCode: qrCode ?? "" };
  }

  return {
    id: product.id,
    qrCode: product.qrCode,
    name: product.name,
    category: product.category,
    wholesalePrice: product.wholesalePrice,
    unitsPerWholesale: product.unitsPerWholesale,
    sellPrice: product.sellPrice,
    quantity: product.quantity,
    lowStockAlert: product.lowStockAlert,
    imageUrl: product.imageUrl,
  };
}

export function ProductForm({
  product,
  qrCode,
  onSaved,
}: {
  product?: Product;
  qrCode?: string;
  onSaved?: (product: Product) => void;
}) {
  const { upsertProduct } = useStore();
  const [draft, setDraft] = useState<ProductDraft>(() => toDraft(product, qrCode));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(toDraft(product, qrCode));
  }, [product, qrCode]);

  const pricing = useMemo(
    () =>
      calculateProductPricing({
        wholesalePrice: draft.wholesalePrice,
        unitsPerWholesale: draft.unitsPerWholesale,
        sellPrice: draft.sellPrice,
        quantity: draft.quantity,
      }),
    [draft.quantity, draft.sellPrice, draft.unitsPerWholesale, draft.wholesalePrice],
  );

  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await upsertProduct(draft);
      onSaved?.(saved);
      if (!product) {
        setDraft(emptyDraft);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="QR Code"
          value={draft.qrCode}
          onChange={(event) => update("qrCode", event.target.value)}
          placeholder="613..."
          required
        />
        <Input
          label="اسم المنتج"
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="مثال: حليب 1 لتر"
          required
        />
        <Input
          label="التصنيف"
          value={draft.category}
          onChange={(event) => update("category", event.target.value)}
          placeholder="مواد أساسية"
        />
        <Input
          label="صورة المنتج اختيارية"
          value={draft.imageUrl ?? ""}
          onChange={(event) => update("imageUrl", event.target.value)}
          placeholder="https://..."
        />
        <Input
          label="سعر الجملة"
          type="number"
          min="0"
          value={draft.wholesalePrice}
          onChange={(event) => update("wholesalePrice", Number(event.target.value))}
          required
        />
        <Input
          label="عدد القطع في الجملة/الكرتون"
          type="number"
          min="1"
          value={draft.unitsPerWholesale}
          onChange={(event) => update("unitsPerWholesale", Number(event.target.value))}
          required
        />
        <Input
          label="سعر البيع للقطعة"
          type="number"
          min="0"
          value={draft.sellPrice}
          onChange={(event) => update("sellPrice", Number(event.target.value))}
          required
        />
        <Input
          label="الكمية الحالية"
          type="number"
          min="0"
          value={draft.quantity}
          onChange={(event) => update("quantity", Number(event.target.value))}
          required
        />
        <Input
          label="الكمية المنخفضة للتنبيه"
          type="number"
          min="0"
          value={draft.lowStockAlert}
          onChange={(event) => update("lowStockAlert", Number(event.target.value))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="metric-card">
          <p className="text-xs font-bold text-market-ink/55 dark:text-white/55">تكلفة القطعة</p>
          <p className="mt-2 text-lg font-black">{formatCurrency(pricing.unitCost)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-bold text-market-ink/55 dark:text-white/55">ربح القطعة</p>
          <p className="mt-2 text-lg font-black">{formatCurrency(pricing.profitPerUnit)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-bold text-market-ink/55 dark:text-white/55">نسبة الربح</p>
          <p className="mt-2 text-lg font-black">{formatPercent(pricing.profitPercent)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-bold text-market-ink/55 dark:text-white/55">فائدة المخزون</p>
          <p className="mt-2 text-lg font-black">{formatCurrency(pricing.expectedStockProfit)}</p>
        </div>
      </div>

      <Button loading={saving}>
        <Save className="h-4 w-4" />
        حفظ المنتج
      </Button>
    </form>
  );
}
