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
  saleMode: "unit",
  purchaseUnit: "piece",
  saleUnit: "piece",
  sellPrice: 0,
  quantity: 0,
  lowStockAlert: 5,
  imageUrl: "",
  expiryDate: "",
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
    saleMode: product.saleMode ?? (product.saleUnit === "gram" ? "weight" : product.unitsPerWholesale > 1 ? "carton" : "unit"),
    purchaseUnit: product.purchaseUnit ?? "piece",
    saleUnit: product.saleUnit ?? "piece",
    unitCost: product.unitCost,
    sellPrice: product.sellPrice,
    quantity: product.quantity,
    lowStockAlert: product.lowStockAlert,
    imageUrl: product.imageUrl,
    expiryDate: product.expiryDate ?? "",
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
  const [restock, setRestock] = useState({ quantity: 0, wholesalePrice: product?.wholesalePrice ?? 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(toDraft(product, qrCode));
    setRestock({ quantity: 0, wholesalePrice: product?.wholesalePrice ?? 0 });
  }, [product, qrCode]);

  const unitsPerPurchase = Math.max(1, Number(draft.unitsPerWholesale) || 1);
  const restockPurchaseQuantity = Math.max(0, Number(restock.quantity) || 0);
  const restockStockQuantity =
    product && restockPurchaseQuantity > 0
      ? draft.saleMode === "unit"
        ? restockPurchaseQuantity
        : restockPurchaseQuantity * unitsPerPurchase
      : 0;
  const restockUnitCost = restock.wholesalePrice > 0 ? restock.wholesalePrice / unitsPerPurchase : 0;
  const mergedUnitCost =
    product && restockStockQuantity > 0
      ? (product.quantity * product.unitCost + restockStockQuantity * restockUnitCost) /
        Math.max(1, product.quantity + restockStockQuantity)
      : draft.unitCost;
  const pricingQuantity = draft.quantity + restockStockQuantity;

  const pricing = useMemo(
    () =>
      calculateProductPricing({
        wholesalePrice: draft.wholesalePrice,
        unitsPerWholesale: draft.unitsPerWholesale,
        saleMode: draft.saleMode,
        saleUnit: draft.saleUnit,
        unitCost: mergedUnitCost,
        sellPrice: draft.sellPrice,
        quantity: pricingQuantity,
      }),
    [
      draft.saleMode,
      draft.saleUnit,
      draft.sellPrice,
      draft.unitsPerWholesale,
      draft.wholesalePrice,
      mergedUnitCost,
      pricingQuantity,
    ],
  );

  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const stockQuantityValue = draft.saleMode === "weight" ? draft.quantity / 1000 : draft.quantity;
  const lowStockAlertValue = draft.saleMode === "weight" ? draft.lowStockAlert / 1000 : draft.lowStockAlert;

  function updateStockQuantity(value: number) {
    update("quantity", draft.saleMode === "weight" ? value * 1000 : value);
  }

  function updateLowStockAlert(value: number) {
    update("lowStockAlert", draft.saleMode === "weight" ? value * 1000 : value);
  }

  function updateSaleMode(value: ProductDraft["saleMode"]) {
    setDraft((current) => {
      const wasWeight = current.saleMode === "weight" || current.saleUnit === "gram";
      const isWeight = value === "weight";
      return {
        ...current,
        saleMode: value,
        saleUnit: isWeight ? "gram" : "piece",
        unitCost: undefined,
        purchaseUnit: isWeight ? "kilogram" : value === "carton" ? "carton" : "piece",
        unitsPerWholesale: value === "unit" ? 1 : isWeight ? 1000 : Math.max(2, current.unitsPerWholesale),
        quantity: isWeight && !wasWeight ? current.quantity * 1000 : !isWeight && wasWeight ? current.quantity / 1000 : current.quantity,
        lowStockAlert: isWeight && !wasWeight ? 500 : !isWeight && wasWeight ? current.lowStockAlert / 1000 : current.lowStockAlert,
      };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const draftToSave =
        product && restockStockQuantity > 0
          ? {
              ...draft,
              wholesalePrice: restock.wholesalePrice,
              quantity: draft.quantity + restockStockQuantity,
              unitCost: mergedUnitCost,
            }
          : draft;
      const saved = await upsertProduct(draftToSave);
      onSaved?.(saved);
      if (!product) {
        setDraft(emptyDraft);
        setRestock({ quantity: 0, wholesalePrice: 0 });
      }
    } finally {
      setSaving(false);
    }
  }

  const restockQuantityLabel =
    draft.saleMode === "weight"
      ? "عدد الكيلوغرامات الجديدة"
      : draft.saleMode === "carton"
        ? "عدد الكراتين الجديدة"
        : "عدد الوحدات الجديدة";
  const restockPriceLabel =
    draft.saleMode === "weight"
      ? "سعر شراء الكيلوغرام الجديد"
      : draft.saleMode === "carton"
        ? "سعر شراء الكرتون الجديد"
        : "سعر شراء الوحدة الجديدة";
  const restockStockText =
    draft.saleMode === "weight"
      ? `${restockStockQuantity / 1000} كغ`
      : `${restockStockQuantity} حبة`;
  const costDifference = product ? restockUnitCost - product.unitCost : 0;

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
        <Select
          label="نوع البيع"
          value={draft.saleMode ?? "unit"}
          onChange={(event) => updateSaleMode(event.target.value as ProductDraft["saleMode"])}
        >
          <option value="unit">وحدة: أشتري وحدة وأبيع وحدة</option>
          <option value="carton">كرتون: أشتري كرتون وأبيع بالحبة</option>
          <option value="weight">وزن: أشتري بالكيلوغرام وأبيع حسب الغرام</option>
        </Select>
        <Input
          label={draft.saleMode === "weight" ? "سعر شراء الكيلوغرام" : draft.saleMode === "carton" ? "سعر شراء الكرتون" : "سعر شراء الوحدة"}
          type="number"
          min="0"
          value={draft.wholesalePrice}
          onChange={(event) => update("wholesalePrice", Number(event.target.value))}
          required
        />
        <Input
          label={draft.saleMode === "weight" ? "عدد الغرامات في الكيلوغرام" : draft.saleMode === "carton" ? "عدد الحبات في الكرتون" : "عدد الوحدات"}
          type="number"
          min="1"
          value={draft.unitsPerWholesale}
          onChange={(event) => update("unitsPerWholesale", Number(event.target.value))}
          readOnly={draft.saleMode !== "carton"}
          required
        />
        <Input
          label={draft.saleMode === "weight" ? "تكلفة الغرام" : "تكلفة الحبة"}
          value={pricing.unitCost}
          readOnly
        />
        <Input
          label={draft.saleMode === "weight" ? "سعر البيع للكيلوغرام" : "سعر البيع للحبة"}
          type="number"
          min="0"
          value={draft.sellPrice}
          onChange={(event) => update("sellPrice", Number(event.target.value))}
          required
        />
        <Input
          label={draft.saleMode === "weight" ? "المخزون الحالي بالكيلوغرام" : draft.saleMode === "carton" ? "المخزون الحالي بالحبات" : "المخزون الحالي بالحبة"}
          type="number"
          min="0"
          step={draft.saleMode === "weight" ? "0.001" : "1"}
          value={stockQuantityValue}
          onChange={(event) => updateStockQuantity(Number(event.target.value))}
          required
        />
        <Input
          label={draft.saleMode === "weight" ? "تنبيه المخزون المنخفض بالكيلوغرام" : "تنبيه المخزون المنخفض بالحبة"}
          type="number"
          min="0"
          step={draft.saleMode === "weight" ? "0.001" : "1"}
          value={lowStockAlertValue}
          onChange={(event) => updateLowStockAlert(Number(event.target.value))}
        />
      </div>

      {product ? (
        <div className="ios-card space-y-4 border-leaf-500/20 bg-leaf-50/45">
          <div>
            <h2 className="text-xl font-black text-leaf-700">إضافة شراء جديد بسعر مختلف</h2>
            <p className="mt-1 text-sm text-market-ink/60">
              أضف الكمية الجديدة فقط، وسيحسب التطبيق متوسط تكلفة المخزون والربح تلقائيًا.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={restockQuantityLabel}
              type="number"
              min="0"
              step={draft.saleMode === "weight" ? "0.001" : "1"}
              value={restock.quantity}
              onChange={(event) => setRestock((current) => ({ ...current, quantity: Number(event.target.value) }))}
            />
            <Input
              label={restockPriceLabel}
              type="number"
              min="0"
              value={restock.wholesalePrice}
              onChange={(event) => setRestock((current) => ({ ...current, wholesalePrice: Number(event.target.value) }))}
            />
          </div>

          {restockStockQuantity > 0 ? (
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-market-ink/55">الكمية المضافة</p>
                <p className="mt-1 font-black">{restockStockText}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-market-ink/55">تكلفة الوحدة الجديدة</p>
                <p className="mt-1 font-black">{formatCurrency(restockUnitCost)}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-market-ink/55">فرق السعر</p>
                <p className={costDifference > 0 ? "mt-1 font-black text-red-600" : "mt-1 font-black text-leaf-700"}>
                  {formatCurrency(costDifference)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-market-ink/55">متوسط التكلفة الجديد</p>
                <p className="mt-1 font-black">{formatCurrency(mergedUnitCost ?? 0)}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Input
        label="تاريخ انتهاء الصلاحية (اختياري)"
        type="date"
        value={draft.expiryDate ?? ""}
        onChange={(event) => update("expiryDate", event.target.value)}
      />
      <Input
        label="صورة المنتج اختيارية"
        value={draft.imageUrl ?? ""}
        onChange={(event) => update("imageUrl", event.target.value)}
        placeholder="/products/milk.svg أو رابط صورة"
      />

      <div className="grid grid-cols-3 gap-3">
        <CalcCard label={draft.saleMode === "weight" ? "الربح للغرام" : "الربح للحبة"} value={formatCurrency(pricing.profitPerUnit)} icon={TrendingUp} />
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
