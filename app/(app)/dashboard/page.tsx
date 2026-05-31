"use client";

import {
  AlertTriangle,
  Boxes,
  ChartNoAxesCombined,
  CircleDollarSign,
  PackageCheck,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/components/providers/store-provider";
import { buildSmartAlerts } from "@/utils/alerts";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/utils/format";

function Metric({
  label,
  value,
  icon: Icon,
  accent = "leaf",
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  accent?: "leaf" | "orange" | "yellow" | "sky";
}) {
  const colors = {
    leaf: "bg-leaf-100 text-leaf-700 dark:bg-leaf-500/20 dark:text-leaf-50",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-50",
    yellow: "bg-citrus-100 text-amber-900 dark:bg-citrus-500/20 dark:text-citrus-100",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-50",
  };

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-market-ink/58 dark:text-white/58">{label}</p>
        <div className={`rounded-lg p-2 ${colors[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, stats, isOnline } = useStore();

  if (!data || !stats) {
    return null;
  }

  const alerts = buildSmartAlerts(data, isOnline).slice(0, 6);
  const recentSales = data.sales.slice(0, 5);

  return (
    <div>
      <PageHeader
        icon={ChartNoAxesCombined}
        title="لوحة التحكم"
        description="نظرة سريعة على المبيعات، الأرباح، المخزون، والكريديات."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="مبيعات اليوم" value={formatCurrency(stats.todaySales)} icon={ReceiptText} />
        <Metric label="ربح اليوم" value={formatCurrency(stats.todayProfit)} icon={TrendingUp} accent="orange" />
        <Metric label="مبيعات الأسبوع" value={formatCurrency(stats.weekSales)} icon={WalletCards} accent="sky" />
        <Metric label="ربح الأسبوع" value={formatCurrency(stats.weekProfit)} icon={TrendingUp} accent="yellow" />
        <Metric label="مبيعات الشهر" value={formatCurrency(stats.monthSales)} icon={ReceiptText} />
        <Metric label="ربح الشهر" value={formatCurrency(stats.monthProfit)} icon={TrendingUp} accent="orange" />
        <Metric label="مبيعات السنة" value={formatCurrency(stats.yearSales)} icon={WalletCards} accent="sky" />
        <Metric label="ربح السنة" value={formatCurrency(stats.yearProfit)} icon={TrendingUp} accent="yellow" />
        <Metric label="عدد المنتجات" value={formatNumber(stats.productCount)} icon={Boxes} />
        <Metric label="أوشكت على النفاد" value={formatNumber(stats.lowStockCount)} icon={AlertTriangle} accent="yellow" />
        <Metric label="نفدت من المخزون" value={formatNumber(stats.outOfStockCount)} icon={PackageCheck} accent="orange" />
        <Metric label="إجمالي الديون" value={formatCurrency(stats.totalDebt)} icon={CircleDollarSign} accent="sky" />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-lg font-black">آخر عمليات البيع</h2>
          <div className="mt-4 space-y-3">
            {recentSales.length ? (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/5 bg-white/58 p-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div>
                    <p className="font-bold">{sale.receiptNumber}</p>
                    <p className="text-xs text-market-ink/55 dark:text-white/55">
                      {sale.type === "cash" ? "بيع سالك" : `كريدي - ${sale.customerName ?? "زبون"}`} ·{" "}
                      {formatDate(sale.createdAt)}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-black">{formatCurrency(sale.totalAmount)}</p>
                    <p className="text-xs text-leaf-700 dark:text-leaf-200">ربح {formatCurrency(sale.totalProfit)}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={ReceiptText} title="لا توجد مبيعات بعد" body="ابدأ من صفحة البيع لإظهار العمليات هنا." />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-black">تنبيهات ذكية</h2>
          <div className="mt-4 space-y-3">
            {alerts.length ? (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-black/5 bg-white/58 p-3 dark:border-white/10 dark:bg-white/5"
                >
                  <p className="font-bold">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-market-ink/62 dark:text-white/62">{alert.body}</p>
                </div>
              ))
            ) : (
              <EmptyState icon={PackageCheck} title="الوضع جيد" body="لا توجد تنبيهات مهمة حالياً." />
            )}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-black">أكثر المنتجات مبيعاً</h2>
          <div className="mt-4 space-y-3">
            {stats.topProducts.length ? (
              stats.topProducts.map((product) => (
                <div key={product.name} className="flex items-center justify-between gap-3">
                  <span className="font-bold">{product.name}</span>
                  <span className="text-sm text-market-ink/60 dark:text-white/60">{formatNumber(product.quantity)} قطعة</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-market-ink/60 dark:text-white/60">ستظهر بعد تسجيل المبيعات.</p>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-black">منتجات ربحها جيد</h2>
          <div className="mt-4 space-y-3">
            {stats.highProfitProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3">
                <span className="font-bold">{product.name}</span>
                <span className="text-sm text-leaf-700 dark:text-leaf-200">{formatPercent(product.profitPercent)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-black">منتجات ربحها ضعيف</h2>
          <div className="mt-4 space-y-3">
            {stats.weakProfitProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3">
                <span className="font-bold">{product.name}</span>
                <span className="text-sm text-orange-700 dark:text-orange-200">{formatPercent(product.profitPercent)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
