"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  Package,
  ReceiptText,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Wallet,
  Wifi,
} from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { buildSmartAlerts } from "@/utils/alerts";
import { formatCurrency, formatNumber } from "@/utils/format";
import { useState, useCallback } from "react";
import { PinGate } from "@/components/auth/pin-gate";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import type { Sale } from "@/types";

function HeroMetric({
  title,
  value,
  hint,
  icon: Icon,
  tone = "green",
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  tone?: "green" | "orange" | "red";
}) {
  const iconClass =
    tone === "orange" ? "ios-icon ios-icon-orange" : tone === "red" ? "ios-icon ios-icon-red" : "ios-icon";

  return (
    <div className="ios-card min-h-[152px]">
      <div className={iconClass}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-5 text-sm font-semibold text-market-ink/70 dark:text-white/70">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-sm font-bold text-leaf-700 dark:text-leaf-200">{hint}</p>
    </div>
  );
}

function ProductMini({ name, value, image, rank }: { name: string; value: string; image?: string; rank: number }) {
  return (
    <div className="ios-card-tight min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-sm font-black text-orange-700">
          {rank}
        </span>
        {image ? <img src={image} alt="" className="h-16 w-16 object-contain" /> : <Box className="h-12 w-12 text-leaf-600" />}
      </div>
      <p className="mt-2 truncate text-sm font-bold">{name}</p>
      <p className="mt-1 text-sm font-black text-leaf-700">{value}</p>
    </div>
  );
}

// ──── Sales log row ────────────────────────────────────────────────
function SaleRow({ sale, onDelete }: { sale: Sale; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    await onDelete(sale.id);
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <div className="flex flex-col gap-1 py-3 border-b border-black/5 dark:border-white/10 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="ios-icon h-10 w-10 rounded-2xl shrink-0">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-black truncate">{sale.receiptNumber}</p>
            <p className="text-xs text-market-ink/55 dark:text-white/55">
              {sale.type === "cash" ? "نقدي" : `كريدي${sale.customerName ? ` • ${sale.customerName}` : ""}`}
              {" · "}
              {new Date(sale.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="font-black">{formatCurrency(sale.totalAmount)}</p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition ${
              confirming
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
            }`}
            title="حذف (إعادة البضاعة)"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirming ? "تأكيد؟" : "إرجاع"}
          </button>
        </div>
      </div>
      {sale.items && sale.items.length > 0 && (
        <div className="mr-13 mt-1 text-xs text-market-ink/65 dark:text-white/60">
          <span className="font-bold text-market-ink/50 dark:text-white/40">المنتجات: </span>
          {sale.items.map((item) => `${item.name} (${item.quantity})`).join("، ")}
        </div>
      )}
    </div>
  );
}

// ──── Main page ────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, stats, isOnline, deleteSale } = useStore();
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);

  if (!data || !stats) {
    return null;
  }

  // Demo users skip password gate
  const needsPassword = user && !user.isDemo && !unlocked;
  if (needsPassword) {
    return <PinGate title="لوحة التحكم محمية" onUnlock={() => setUnlocked(true)} />;
  }

  const alerts = buildSmartAlerts(data, isOnline);
  const lowStock = data.products.filter((product) => product.quantity <= product.lowStockAlert).slice(0, 1);
  const allSales = [...data.sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const topProducts = stats.topProducts.length
    ? stats.topProducts
    : data.products.slice(0, 3).map((product) => ({ name: product.name, quantity: product.quantity, total: product.sellPrice }));

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="متجر بلقاسم" className="ios-avatar" />
        <div className="min-w-0 flex-1 pt-2 text-center">
          <h1 className="text-4xl font-black leading-tight">
            مرحباً <span className="text-leaf-700">بلقاسم</span>
          </h1>
          <p className="mt-1 text-lg text-market-ink/70 dark:text-white/70">متجر بلقاسم للمواد الغذائية</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-leaf-700 shadow-soft dark:bg-white/10 dark:text-leaf-100">
            <Wifi className="h-4 w-4" />
            {isOnline ? "متزامن الآن" : "بدون إنترنت"}
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <button className="ios-circle-button" title="التنبيهات">
          <Bell className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 hidden lg:block">
        <h1 className="text-3xl font-black">لوحة التحكم</h1>
        <p className="mt-1 text-market-ink/60 dark:text-white/60">نظرة عامة على المبيعات، الأرباح، المخزون والكريدي.</p>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HeroMetric title="مبيعات اليوم" value={formatCurrency(stats.todaySales)} hint="0%" icon={TrendingUp} />
        <HeroMetric title="ربح اليوم" value={formatCurrency(stats.todayProfit)} hint="0%" icon={Wallet} />
        <HeroMetric title="ربح هذا الأسبوع" value={formatCurrency(stats.weekProfit)} hint="0%" icon={CalendarDays} tone="orange" />
        <HeroMetric title="ربح هذا العام" value={formatCurrency(stats.yearProfit)} hint="0%" icon={ReceiptText} />
      </section>

      <Link href="/inventory" className="ios-card mt-5 flex items-center justify-between gap-4 border-orange-200/80 bg-orange-50/70">
        <ArrowLeft className="h-6 w-6" />
        <div className="flex-1 text-center">
          <p className="text-lg font-black">تنبيهات المخزون المنخفض</p>
          <p className="mt-1 text-sm text-market-ink/62">{formatNumber(stats.lowStockCount)} منتجات بحاجة إلى إعادة طلب</p>
        </div>
        <div className="relative ios-icon ios-icon-orange">
          <Package className="h-6 w-6" />
          <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">
            {stats.lowStockCount}
          </span>
        </div>
      </Link>

      {/* Sales log — full, with delete */}
      <section className="mt-5">
        <div className="ios-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">سجل المبيعات الكامل</h2>
            <span className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-black text-leaf-700 dark:bg-leaf-900/30 dark:text-leaf-300">
              {formatNumber(allSales.length)} عملية
            </span>
          </div>
          <div className="max-h-[500px] overflow-y-auto -mx-1 px-1">
            {allSales.length === 0 && (
              <p className="py-8 text-center text-sm font-bold text-market-ink/50 dark:text-white/40">لا توجد مبيعات بعد</p>
            )}
            {allSales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} onDelete={deleteSale} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="ios-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">المنتجات الأكثر مبيعاً</h2>
            <Link href="/reports" className="text-sm font-bold text-leaf-700">عرض الكل</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {topProducts.slice(0, 3).map((product, index) => {
              const source = data.products.find((item) => item.name === product.name);
              return (
                <ProductMini
                  key={product.name}
                  name={product.name}
                  value={source ? formatCurrency(source.sellPrice) : `${formatNumber(product.quantity)} بيع`}
                  image={source?.imageUrl}
                  rank={index + 1}
                />
              );
            })}
          </div>
        </div>

        <section className="grid gap-4 grid-cols-1 content-start">
          <div className="ios-card">
            <p className="text-sm text-market-ink/55">عدد المنتجات</p>
            <p className="mt-2 text-3xl font-black">{formatNumber(stats.productCount)}</p>
          </div>
          <div className="ios-card">
            <p className="text-sm text-market-ink/55">إجمالي الديون</p>
            <p className="mt-2 text-3xl font-black">{formatCurrency(stats.totalDebt)}</p>
          </div>
          <div className="ios-card">
            <p className="text-sm text-market-ink/55">تنبيهات ذكية</p>
            <p className="mt-2 text-3xl font-black">{formatNumber(alerts.length + lowStock.length)}</p>
          </div>
        </section>
      </section>
    </div>
  );
}
