import type { CreditCustomer, CreditTransaction, StoreProfile } from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";

export function CreditStatement({
  store,
  customer,
  transactions,
}: {
  store: StoreProfile;
  customer: CreditCustomer;
  transactions: CreditTransaction[];
}) {
  return (
    <div className="print-area hidden w-[72mm] bg-white p-4 text-black text-right">
      <div className="text-center border-b border-dashed border-black pb-2">
        <h1 className="text-base font-black">{store.name}</h1>
        <p className="text-xs font-bold mt-1">كشف حساب زبون</p>
        <p className="text-[10px] text-gray-600 mt-0.5">تاريخ الطباعة: {formatDate(new Date().toISOString())}</p>
      </div>
      
      <div className="mt-3 space-y-1 text-xs">
        <p className="font-black text-sm">الزبون: {customer.name}</p>
        {customer.phone ? <p>الهاتف: {customer.phone}</p> : null}
        {customer.address ? <p>العنوان: {customer.address}</p> : null}
      </div>

      <div className="mt-3 border border-dashed border-black p-3 rounded-lg space-y-2 text-xs">
        <div className="flex justify-between font-bold">
          <span>إجمالي الفواتير:</span>
          <span>{formatCurrency(customer.totalDebt)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>إجمالي المدفوع:</span>
          <span>{formatCurrency(customer.totalPaid)}</span>
        </div>
        <div className="flex justify-between border-t border-dashed border-black pt-2 text-sm font-black">
          <span>الدين المتبقي:</span>
          <span>{formatCurrency(customer.remainingDebt)}</span>
        </div>
      </div>

      <p className="mt-4 text-center text-xs font-bold border-t border-dashed border-black pt-2">
        شكراً لتعاملكم معنا
      </p>
    </div>
  );
}
