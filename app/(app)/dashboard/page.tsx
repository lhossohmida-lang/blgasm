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
  TrendingUp,
  Wallet,
  Wifi,
} from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import { buildSmartAlerts } from "@/utils/alerts";
import { formatCurrency, formatNumber } from "@/utils/format";

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

export default function DashboardPage() {
  const { data, stats, isOnline } = useStore();

  if (!data || !stats) {
    return null;
  }

  const alerts = buildSmartAlerts(data, isOnline);
  const lowStock = data.products.filter((product) => product.quantity <= product.lowStockAlert).slice(0, 1);
  const recentSales = data.sales.slice(0, 3);
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

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="ios-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">أحدث المبيعات</h2>
            <Link href="/pos" className="text-sm font-bold text-leaf-700">عرض الكل</Link>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="ios-icon h-10 w-10 rounded-2xl">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black">{sale.receiptNumber}</p>
                      <p className="text-xs text-market-ink/55">{sale.type === "cash" ? "نقدي" : "كريدي"}</p>
                    </div>
                  </div>
                  <p className="font-black">{formatCurrency(sale.totalAmount)}</p>
                </div>
              ))}
            {!recentSales.length ? <p className="py-4 text-center text-sm font-bold text-market-ink/50">لا توجد مبيعات</p> : null}
          </div>
        </div>

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
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
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
    </div>
  );
}
