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
    <div className="print-area hidden w-[72mm] bg-white p-2 text-black">
      <div className="text-center">
        <h1 className="text-base font-black">{store.name}</h1>
        <p className="text-xs">كشف حساب كريدي</p>
      </div>
      <div className="mt-2 border-y border-dashed border-black py-2 text-xs">
        <p>الزبون: {customer.name}</p>
        {customer.phone ? <p>الهاتف: {customer.phone}</p> : null}
        <p>المتبقي: {formatCurrency(customer.remainingDebt)}</p>
      </div>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 text-right">النوع</th>
            <th className="py-1">التاريخ</th>
            <th className="py-1 text-left">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="py-1">{transaction.type === "invoice" ? "فاتورة" : "دفعة"}</td>
              <td className="py-1 text-center">{formatDate(transaction.createdAt)}</td>
              <td className="py-1 text-left">{formatCurrency(transaction.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
