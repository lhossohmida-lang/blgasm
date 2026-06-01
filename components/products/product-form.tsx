"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, Boxes, Calculator, Grid2X2, Percent, QrCode, Save, Tag, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
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

function CalcCard({
  label,
  value,
  icon: Icon,
  orange,
}: {
  label: string;
  value: string;
  icon: typeof Calculator;
  orange?: boolean;
}) {
  return (
    <div className="ios-card-tight">
      <div className={orange ? "ios-icon ios-icon-orange" : "ios-icon"}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-bold text-market-ink/65 dark:text-white/65">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
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
      <div className="ios-card space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <Tag className="pointer-events-none absolute left-4 top-[42px] h-5 w-5 text-leaf-700" />
            <Input
              label="اسم المنتج"
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="أدخل اسم المنتج"
              required
            />
          </div>
          <div className="relative">
            <Grid2X2 className="pointer-events-none absolute left-4 top-[42px] h-5 w-5 text-leaf-700" />
            <Select label="الفئة / التصنيف" value={draft.category} onChange={(event) => update("category", event.target.value)}>
              <option>مواد غذائية</option>
              <option>مشروبات</option>
              <option>زيوت</option>
              <option>حلويات</option>
              <option>تنظيف</option>
            </Select>
          </div>
          <div className="relative md:col-span-2">
            <QrCode className="pointer-events-none absolute left-4 top-[42px] h-5 w-5 text-leaf-700" />
            <Input
              label="QR المنتج"
              value={draft.qrCode}
              onChange={(event) => update("qrCode", event.target.value)}
              placeholder="أدخل أو امسح QR للمنتج"
              required
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="سعر الجملة (الكرتون)"
          type="number"
          min="0"
          value={draft.wholesalePrice}
          onChange={(event) => update("wholesalePrice", Number(event.target.value))}
          required
        />
        <Input
          label="عدد الوحدات في الكرتون"
          type="number"
          min="1"
          value={draft.unitsPerWholesale}
          onChange={(event) => update("unitsPerWholesale", Number(event.target.value))}
          required
        />
        <Input
          label="تكلفة الوحدة"
          value={pricing.unitCost}
          readOnly
        />
        <Input
          label="سعر البيع (الوحدة)"
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
          label="تنبيه المخزون المنخفض"
          type="number"
          min="0"
          value={draft.lowStockAlert}
          onChange={(event) => update("lowStockAlert", Number(event.target.value))}
        />
      </div>

      <Input
        label="صورة المنتج اختيارية"
        value={draft.imageUrl ?? ""}
        onChange={(event) => update("imageUrl", event.target.value)}
        placeholder="/products/milk.svg أو رابط صورة"
      />

      <div className="grid grid-cols-3 gap-3">
        <CalcCard label="الربح للوحدة" value={formatCurrency(pricing.profitPerUnit)} icon={TrendingUp} />
        <CalcCard label="نسبة الربح" value={formatPercent(pricing.profitPercent)} icon={Percent} />
        <CalcCard label="الربح المتوقع" value={formatCurrency(pricing.expectedStockProfit)} icon={Wallet} orange />
      </div>

      <div className="grid gap-3">
        <Button className="h-16 w-full rounded-3xl text-xl" loading={saving}>
          <Save className="h-6 w-6" />
          حفظ المنتج
        </Button>
        <Button type="button" variant="secondary" className="h-14 w-full rounded-3xl text-lg text-leaf-700">
          <QrCode className="h-5 w-5" />
          توليد QR
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-full bg-leaf-50 px-4 py-3 text-sm font-bold text-market-ink/60">
        <Bell className="h-4 w-4" />
        سيتم حفظ المنتج وإضافته إلى المخزون بعد تأكيد البيانات
        <Boxes className="h-4 w-4" />
      </div>
    </form>
  );
}
