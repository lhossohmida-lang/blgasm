"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChartNoAxesCombined, Printer, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ReportPrint } from "@/components/print/report-print";
import { useStore } from "@/components/providers/store-provider";
import type { DashboardStats, Sale } from "@/types";
import { computeDashboardStats, roundMoney } from "@/utils/calculations";
import { formatCurrency, formatNumber, formatPercent } from "@/utils/format";

function rangeFilter(sales: Sale[], from: string, to: string) {
  const start = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const end = to ? new Date(`${to}T23:59:59`) : new Date();
  return sales.filter((sale) => {
    const createdAt = new Date(sale.createdAt);
    return createdAt >= start && createdAt <= end;
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <p className="text-xs font-bold text-market-ink/55 dark:text-white/55">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { data } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const report = useMemo(() => {
    if (!data) {
      return null;
    }

    const sales = rangeFilter(data.sales, from, to);
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
      stats: customStats,
      sales,
      cashSalesTotal: roundMoney(cashSales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
      creditSalesTotal: roundMoney(creditSales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
    };
  }, [data, from, to]);

  if (!data || !report) {
    return null;
  }

  const lowStock = data.products.filter((product) => product.quantity <= product.lowStockAlert);
  const highestProfit = [...data.products].sort((a, b) => b.profitPerUnit - a.profitPerUnit).slice(0, 6);
  const weakProfit = [...data.products].sort((a, b) => a.profitPercent - b.profitPercent).slice(0, 6);

  return (
    <div>
      <PageHeader
        icon={ChartNoAxesCombined}
        title="التقارير والأرباح"
        description="أرباح يومية وأسبوعية وشهرية وسنوية وفترة مخصصة مع فصل الكريدي عن النقد."
        action={
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input label="من تاريخ" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input label="إلى تاريخ" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={() => {
              setFrom(monthStart);
              setTo(today);
            }}>
              <CalendarDays className="h-4 w-4" />
              هذا الشهر
            </Button>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="ربح اليوم" value={formatCurrency(report.stats.todayProfit)} />
        <Metric label="ربح الأسبوع" value={formatCurrency(report.stats.weekProfit)} />
        <Metric label="ربح الفترة" value={formatCurrency(report.stats.monthProfit)} />
        <Metric label="ربح السنة" value={formatCurrency(report.stats.yearProfit)} />
        <Metric label="المبيعات النقدية" value={formatCurrency(report.cashSalesTotal)} />
        <Metric label="مبيعات الكريدي" value={formatCurrency(report.creditSalesTotal)} />
        <Metric label="المال المقبوض نقداً" value={formatCurrency(report.stats.cashCollected)} />
        <Metric label="غير المقبوض/الكريدي" value={formatCurrency(report.stats.creditUncollected)} />
        <Metric label="الديون المتبقية" value={formatCurrency(report.stats.totalDebt)} />
        <Metric label="عدد عمليات الفترة" value={formatNumber(report.sales.length)} />
        <Metric label="منتجات أوشكت على النفاد" value={formatNumber(lowStock.length)} />
        <Metric label="إجمالي المبيعات" value={formatCurrency(report.stats.monthSales)} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-leaf-600" />
            <h2 className="text-lg font-black">الأكثر مبيعاً</h2>
          </div>
          <div className="space-y-3">
            {report.stats.topProducts.map((product) => (
              <div key={product.name} className="flex items-center justify-between gap-3">
                <span className="font-bold">{product.name}</span>
                <span className="text-sm text-market-ink/60 dark:text-white/60">{formatNumber(product.quantity)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-leaf-600" />
            <h2 className="text-lg font-black">الأعلى ربحاً</h2>
          </div>
          <div className="space-y-3">
            {highestProfit.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3">
                <span className="font-bold">{product.name}</span>
                <span className="text-sm text-leaf-700 dark:text-leaf-200">{formatCurrency(product.profitPerUnit)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-black">ضعيفة الربح</h2>
          </div>
          <div className="space-y-3">
            {weakProfit.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3">
                <span className="font-bold">{product.name}</span>
                <span className="text-sm text-orange-700 dark:text-orange-200">{formatPercent(product.profitPercent)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="mt-6">
        <h2 className="text-lg font-black">منتجات أوشكت على النفاد</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lowStock.map((product) => (
            <div key={product.id} className="rounded-lg border border-black/5 bg-white/58 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="font-black">{product.name}</p>
              <p className="mt-1 text-sm text-market-ink/60 dark:text-white/60">
                الكمية {formatNumber(product.quantity)} · التنبيه عند {formatNumber(product.lowStockAlert)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <ReportPrint store={data.store} title="تقرير الفترة" stats={report.stats} />
    </div>
  );
}
