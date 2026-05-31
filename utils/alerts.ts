import type { AppData, SmartAlert } from "@/types";
import { daysBetween } from "@/utils/dates";
import { formatCurrency } from "@/utils/format";

export function buildSmartAlerts(data: AppData, isOnline: boolean): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  if (!isOnline) {
    alerts.push({
      id: "offline",
      tone: "warning",
      title: "أنت تعمل بدون إنترنت",
      body: "كل العمليات تحفظ محلياً وستتم مزامنتها عند رجوع الاتصال.",
    });
  }

  data.products
    .filter((product) => product.quantity <= 0)
    .slice(0, 3)
    .forEach((product) => {
      alerts.push({
        id: `out-${product.id}`,
        tone: "error",
        title: "منتج نفد من المخزون",
        body: `${product.name} يحتاج إلى إعادة شراء فوراً.`,
      });
    });

  data.products
    .filter((product) => product.quantity > 0 && product.quantity <= product.lowStockAlert)
    .slice(0, 4)
    .forEach((product) => {
      alerts.push({
        id: `low-${product.id}`,
        tone: "warning",
        title: "منتج أوشك على النفاد",
        body: `${product.name}: الكمية الحالية ${product.quantity}.`,
      });
    });

  data.creditCustomers
    .filter((customer) => customer.remainingDebt >= 10000)
    .slice(0, 3)
    .forEach((customer) => {
      alerts.push({
        id: `debt-${customer.id}`,
        tone: "warning",
        title: "دين كبير",
        body: `${customer.name} عليه ${formatCurrency(customer.remainingDebt)}.`,
      });
    });

  data.creditTransactions
    .filter((transaction) => transaction.type === "invoice" && transaction.remainingAmount > 0)
    .filter((transaction) => daysBetween(transaction.createdAt) > 30)
    .slice(0, 3)
    .forEach((transaction) => {
      const customer = data.creditCustomers.find((item) => item.id === transaction.customerId);
      alerts.push({
        id: `old-credit-${transaction.id}`,
        tone: "info",
        title: "فاتورة كريدي قديمة",
        body: `${customer?.name ?? "زبون"} لديه فاتورة غير مدفوعة منذ أكثر من شهر.`,
      });
    });

  data.syncQueue
    .filter((operation) => operation.status === "failed")
    .slice(0, 3)
    .forEach((operation) => {
      alerts.push({
        id: `sync-${operation.id}`,
        tone: "error",
        title: "فشل المزامنة",
        body: operation.lastError ?? "تعذر إرسال عملية إلى Firebase.",
      });
    });

  return alerts;
}
