import type { Sale, StoreProfile } from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";

export function Receipt({ sale, store }: { sale: Sale; store: StoreProfile }) {
  return (
    <div className="print-area hidden w-[72mm] bg-white p-2 text-black">
      <div className="text-center">
        <h1 className="text-base font-black">{store.name}</h1>
        <p className="text-xs">وصل {sale.type === "cash" ? "بيع سالك" : "بيع كريدي"}</p>
      </div>
      <div className="mt-2 border-y border-dashed border-black py-2 text-xs">
        <p>رقم: {sale.receiptNumber}</p>
        <p>التاريخ: {formatDate(sale.createdAt)}</p>
        {sale.customerName ? <p>الزبون: {sale.customerName}</p> : null}
      </div>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 text-right">المنتج</th>
            <th className="py-1">ك</th>
            <th className="py-1 text-left">المجموع</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={`${sale.id}-${item.productId}`}>
              <td className="py-1">{item.name}</td>
              <td className="py-1 text-center">{item.quantity}</td>
              <td className="py-1 text-left">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 border-t border-dashed border-black pt-2 text-sm font-black">
        <p className="flex justify-between">
          <span>الإجمالي</span>
          <span>{formatCurrency(sale.totalAmount)}</span>
        </p>
        <p className="flex justify-between text-xs font-bold">
          <span>المدفوع</span>
          <span>{formatCurrency(sale.paidAmount)}</span>
        </p>
        {sale.remainingAmount > 0 ? (
          <p className="flex justify-between text-xs font-bold">
            <span>المتبقي</span>
            <span>{formatCurrency(sale.remainingAmount)}</span>
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs">شكراً لزيارتكم</p>
    </div>
  );
}
