"use client";

import { useMemo, useState } from "react";
import { Banknote, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Printer, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportPrint } from "@/components/print/report-print";
import { useStore } from "@/components/providers/store-provider";
import type { DashboardStats, Sale } from "@/types";
import { computeDashboardStats, roundMoney } from "@/utils/calculations";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";

type Period = "day" | "week" | "month" | "year";

function rangeFilter(sales: Sale[], period: Period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "day") start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(now.getDate() - 7);
  if (period === "month") start.setMonth(now.getMonth() - 1);
  if (period === "year") start.setFullYear(now.getFullYear() - 1);
  return sales.filter((sale) => new Date(sale.createdAt) >= start);
}

function ReportMetric({
  label,
  value,
  hint,
  icon: Icon,
  orange,
  wide,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  orange?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn("ios-card", wide && "col-span-2")}>
      <div className={orange ? "ios-icon ios-icon-orange" : "ios-icon"}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm text-market-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className={cn("mt-2 text-sm font-bold", hint.includes("↓") ? "text-red-600" : "text-leaf-700")}>{hint}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { data } = useStore();
  const [period, setPeriod] = useState<Period>("day");

  const report = useMemo(() => {
    if (!data) return null;
    const sales = rangeFilter(data.sales, period);
    const stats = computeDashboardStats(data.products, sales, data.creditCustomers);
    const cashSales = sales.filter((sale) => sale.type === "cash");
    const creditSales = sales.filter((sale) => sale.type === "credit");
    const customStats: DashboardStats = {
      ...stats,
      monthSales: roundMoney(sales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
      monthProfit: roundMoney(sales.reduce((sum, sale) => sum + sale.totalProfit, 0)),
      cashCollected: roundMoney(cashSales.reduce((sum, sale) => sum + sale.paidAmount, 0)),
      creditUncollected: roundMoney(creditSales.reduce((sum, sale) => sum + sale.remainingAmount, 0)),
    };
    return {
      sales,
      stats: customStats,
      cashSalesTotal: roundMoney(cashSales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
      creditSalesTotal: roundMoney(creditSales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
    };
  }, [data, period]);

  if (!data || !report) return null;

  const lowStock = data.products.filter((product) => product.quantity <= product.lowStockAlert);
  const highestProfit = [...data.products].sort((a, b) => b.profitPerUnit - a.profitPerUnit).slice(0, 3);
  const bars = report.sales.length ? [38, 48, 55, 72, 64, 82, 88] : [0, 0, 0, 0, 0, 0, 0];
  const totalPaymentSales = report.cashSalesTotal + report.creditSalesTotal;
  const cashPercent = totalPaymentSales > 0 ? Math.round((report.cashSalesTotal / totalPaymentSales) * 100) : 0;
  const creditPercent = totalPaymentSales > 0 ? Math.round((report.creditSalesTotal / totalPaymentSales) * 100) : 0;

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="" className="ios-avatar" />
        <div className="flex-1 pt-2">
          <h1 className="ios-title">التقارير</h1>
          <p className="ios-subtitle">نظرة عامة على أداء متجرك</p>
        </div>
        <button className="ios-circle-button" title="التاريخ">
          <CalendarDays className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">التقارير والأرباح</h1>
          <p className="mt-1 text-market-ink/60">مبيعات نقدية، كريدي، أرباح، ديون وتنبيهات المخزون.</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          طباعة التقرير
        </Button>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <button className="ios-circle-button h-12 w-12">
          <CalendarDays className="h-5 w-5" />
        </button>
        <div className="ios-card-tight grid flex-1 grid-cols-4 gap-2 p-2">
          {[
            ["day", "يومي"],
            ["week", "أسبوعي"],
            ["month", "شهري"],
            ["year", "سنوي"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod(id as Period)}
              className={cn(
                "h-12 rounded-3xl text-sm font-black",
                period === id ? "bg-leaf-600 text-white" : "text-market-ink/70",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-center gap-8 text-lg font-black">
        <ChevronRight className="h-6 w-6" />
        <span>الأحد، 25 مايو 2025</span>
        <ChevronLeft className="h-6 w-6" />
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ReportMetric label="مبيعات نقدية" value={formatCurrency(report.cashSalesTotal)} hint="0%" icon={Banknote} />
        <ReportMetric label="إجمالي الربح" value={formatCurrency(report.stats.monthProfit)} hint="0%" icon={WalletCards} />
        <ReportMetric label="إجمالي المبيعات" value={formatCurrency(report.stats.monthSales)} hint="0%" icon={TrendingUp} />
        <ReportMetric label="مبيعات آجلة" value={formatCurrency(report.creditSalesTotal)} hint="0%" icon={CalendarDays} orange />
        <ReportMetric label="المتبقي من الديون" value={formatCurrency(report.stats.totalDebt)} hint="0%" icon={BarChart3} orange wide />
      </section>

      <section className="ios-card mt-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">اتجاه الربح</h2>
          <span className="ios-chip min-h-9 px-4">آخر 7 أيام</span>
        </div>
        <div className="flex h-48 items-end gap-3 border-b border-black/5 pb-4">
          {bars.map((height, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-2xl bg-leaf-600/85" style={{ height: `${height}%` }} />
              <span className="text-xs text-market-ink/50">مايو {19 + index}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-4">
        <div className="ios-card">
          <h2 className="text-lg font-black">أفضل الأقسام مبيعاً</h2>
          <div className="mx-auto mt-4 flex h-32 w-32 items-center justify-center rounded-full border-[18px] border-leaf-600 border-l-orange-400 border-b-blue-500">
            <div className="text-center">
              <p className="text-sm font-black">{formatCurrency(report.stats.monthSales)}</p>
              <p className="text-xs text-market-ink/50">إجمالي</p>
            </div>
          </div>
        </div>
        <div className="ios-card">
          <h2 className="text-lg font-black">أعلى طرق الدفع</h2>
          <div className="mt-6 space-y-5">
            <div>
              <div className="flex justify-between text-sm font-black"><span>نقدي</span><span>{cashPercent}%</span></div>
              <div className="mt-2 h-3 rounded-full bg-black/5"><div className="h-3 rounded-full bg-leaf-600" style={{ width: `${cashPercent}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm font-black"><span>آجل</span><span>{creditPercent}%</span></div>
              <div className="mt-2 h-3 rounded-full bg-black/5"><div className="h-3 rounded-full bg-orange-400" style={{ width: `${creditPercent}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ios-card mt-5">
        <h2 className="text-xl font-black">تنبيهات المخزون المنخفض</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {lowStock.slice(0, 3).map((product) => (
            <div key={product.id} className="ios-card-tight text-center">
              {product.imageUrl ? <img src={product.imageUrl} alt="" className="mx-auto h-14 w-14 object-contain" /> : null}
              <p className="mt-2 line-clamp-1 text-sm font-bold">{product.name}</p>
              <p className="text-lg font-black text-red-600">{product.quantity}</p>
              <p className="text-xs text-red-600">منخفض</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ios-card mt-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">المنتجات الأعلى ربحاً</h2>
          <span className="text-sm font-bold text-leaf-700">عرض الكل</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {highestProfit.map((product, index) => (
            <div key={product.id} className="ios-card-tight text-center">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-sm font-black">{index + 1}</span>
              {product.imageUrl ? <img src={product.imageUrl} alt="" className="mx-auto h-14 w-14 object-contain" /> : null}
              <p className="mt-2 line-clamp-1 text-sm font-bold">{product.name}</p>
              <p className="text-sm font-black text-leaf-700">{formatCurrency(product.profitPerUnit)}</p>
            </div>
          ))}
        </div>
      </section>

      <ReportPrint store={data.store} title="تقرير الفترة" stats={report.stats} />
    </div>
  );
}
