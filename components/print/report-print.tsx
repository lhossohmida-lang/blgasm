import type { DashboardStats, StoreProfile } from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";

export function ReportPrint({
  store,
  title,
  stats,
}: {
  store: StoreProfile;
  title: string;
  stats: DashboardStats;
}) {
  return (
    <div className="print-area hidden w-[72mm] bg-white p-2 text-black">
      <div className="text-center">
        <h1 className="text-base font-black">{store.name}</h1>
        <p className="text-xs">{title}</p>
        <p className="text-xs">{formatDate(new Date())}</p>
      </div>
      <div className="mt-2 space-y-1 border-y border-dashed border-black py-2 text-xs">
        <p className="flex justify-between">
          <span>المبيعات</span>
          <span>{formatCurrency(stats.monthSales)}</span>
        </p>
        <p className="flex justify-between">
          <span>الربح</span>
          <span>{formatCurrency(stats.monthProfit)}</span>
        </p>
        <p className="flex justify-between">
          <span>النقد المقبوض</span>
          <span>{formatCurrency(stats.cashCollected)}</span>
        </p>
        <p className="flex justify-between">
          <span>الكريدي غير المقبوض</span>
          <span>{formatCurrency(stats.creditUncollected)}</span>
        </p>
        <p className="flex justify-between">
          <span>الديون المتبقية</span>
          <span>{formatCurrency(stats.totalDebt)}</span>
        </p>
      </div>
    </div>
  );
}
