"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock3, Filter, Package, Plus, Printer, Search, ShoppingBag, Trash2, UserRound, UsersRound, Wallet, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreditStatement } from "@/components/print/credit-statement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { CreditCustomer } from "@/types";
import { daysBetween } from "@/utils/dates";
import { formatCurrency, formatDate, formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

/** هل حلّ تاريخ الدفع الخاص بالزبون أو تجاوزه؟ */
function isPaymentOverdue(customer: CreditCustomer): boolean {
  if (!customer.paymentDueDate || customer.remainingDebt <= 0) return false;
  return new Date(customer.paymentDueDate) <= new Date();
}

function customerStatus(customer: CreditCustomer) {
  if (isPaymentOverdue(customer)) {
    return { label: "حلّ الأجل", sub: "تاريخ الدفع انقضى", icon: AlertCircle, className: "bg-red-50 text-red-600" };
  }
  const lateDays = daysBetween(customer.lastActivityAt);
  if (lateDays > 7) return { label: "متأخر", sub: `متأخر ${lateDays} يوم`, icon: Clock3, className: "bg-red-50 text-red-600" };
  if (customer.remainingDebt > 50000) return { label: "تنبيه", sub: "دين مرتفع", icon: Clock3, className: "bg-orange-50 text-orange-600" };
  return { label: "سليم", sub: "على الموعد", icon: CheckCircle2, className: "bg-leaf-50 text-leaf-700" };
}

export default function CreditsPage() {
  const { data, upsertCustomer, deleteCustomer, addPayment } = useStore();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [largeOnly, setLargeOnly] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [deleting, setDeleting] = useState<CreditCustomer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", openingDebt: 0, paymentDueDate: "" });
  const [payment, setPayment] = useState({ amount: 0, note: "" });
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const customers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.creditCustomers ?? [])
      .filter((customer) => !normalized || customer.name.toLowerCase().includes(normalized) || customer.phone?.includes(normalized))
      .filter((customer) => !largeOnly || customer.remainingDebt >= 50000)
      .sort((a, b) => b.remainingDebt - a.remainingDebt);
  }, [data?.creditCustomers, largeOnly, query]);

  const selected = data?.creditCustomers.find((customer) => customer.id === selectedId) ?? customers[0];
  const transactions = useMemo(
    () =>
      selected
        ? (data?.creditTransactions ?? [])
            .filter((transaction) => transaction.customerId === selected.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [data?.creditTransactions, selected],
  );

  const ledgerTransactions = useMemo(() => {
    if (!selected) return [];
    // Sort oldest first to calculate running balance accurately
    const sortedOldestFirst = [...transactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    let balance = 0;
    const withRunningBalance = sortedOldestFirst.map((tx) => {
      if (tx.type === "invoice") {
        balance += tx.amount;
      } else {
        balance -= tx.amount;
      }
      return {
        ...tx,
        runningBalance: balance,
      };
    });
    return withRunningBalance.reverse();
  }, [transactions, selected]);


  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const customer = await upsertCustomer({
        name: form.name,
        phone: form.phone,
        address: form.address,
        totalDebt: form.openingDebt,
        remainingDebt: form.openingDebt,
        paymentDueDate: form.paymentDueDate || undefined,
      });
      setSelectedId(customer.id);
      setForm({ name: "", phone: "", address: "", openingDebt: 0, paymentDueDate: "" });
      setShowForm(false);
    } catch (error) {
      notify({ tone: "error", title: "تعذر حفظ الحساب", body: error instanceof Error ? error.message : undefined });
    }
  }

  async function submitPayment(full = false) {
    if (!selected) return;
    const amount = full ? selected.remainingDebt : payment.amount;
    try {
      await addPayment(selected.id, amount, payment.note || (full ? "دفع كامل الدين" : undefined));
      setPayment({ amount: 0, note: "" });
    } catch (error) {
      notify({ tone: "error", title: "تعذر تسجيل الدفعة", body: error instanceof Error ? error.message : undefined });
    }
  }

  if (!data) return null;

  const activeDebt = customers.reduce((sum, customer) => sum + customer.remainingDebt, 0);

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="" className="ios-avatar" />
        <div className="flex-1 pt-2">
          <h1 className="ios-title">الكريدي</h1>
          <p className="ios-subtitle">إدارة حسابات الزبائن الكريديين</p>
        </div>
        <button className="ios-circle-button" title="تنبيهات">
          <UsersRound className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 hidden lg:block">
        <h1 className="text-3xl font-black">الكريديات</h1>
        <p className="mt-1 text-market-ink/60">إدارة حسابات الزبائن والدفعات وكشوف الحساب.</p>
      </div>

      <section className="ios-card mb-5 grid grid-cols-2 divide-x divide-x-reverse divide-black/5">
        <div className="flex items-center gap-3 px-2">
          <div className="ios-icon"><Wallet className="h-6 w-6" /></div>
          <div>
            <p className="text-sm text-market-ink/60">إجمالي الدين</p>
            <p className="text-2xl font-black">{formatCurrency(activeDebt)}</p>
            <p className="text-sm text-market-ink/50">إجمالي المبلغ المستحق</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-2">
          <div className="ios-icon"><UsersRound className="h-6 w-6" /></div>
          <div>
            <p className="text-sm text-market-ink/60">الحسابات النشطة</p>
            <p className="text-3xl font-black">{formatNumber(customers.length)}</p>
            <p className="text-sm text-leaf-700">حساب نشط</p>
          </div>
        </div>
      </section>

      <div className="ios-search mb-4">
        <Search className="h-6 w-6 text-market-ink/45" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث عن زبون بالاسم أو رقم الهاتف..."
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto">
        <button className={cn("ios-chip", !largeOnly && "ios-chip-active")} onClick={() => setLargeOnly(false)}>
          الكل
        </button>
        <button className={cn("ios-chip", largeOnly && "ios-chip-active")} onClick={() => setLargeOnly(true)}>
          أعلى دين
        </button>
        <button className="ios-chip">
          <Clock3 className="h-4 w-4" />
          متأخر
        </button>
        <button className="ios-chip">
          <Filter className="h-4 w-4" />
          فلترة
        </button>
        <button className="ios-chip ios-chip-active" onClick={() => setShowForm((value) => !value)}>
          <Plus className="h-4 w-4" />
          إضافة حساب
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <section className="space-y-3">
          {customers.map((customer) => {
            const status = customerStatus(customer);
            const Icon = status.icon;
            const overdue = isPaymentOverdue(customer);
            return (
              <button
                key={customer.id}
                onClick={() => {
                  setSelectedId(customer.id);
                  setDetailOpen(true);
                }}
                className={cn(
                  "ios-card-tight grid w-full grid-cols-[1fr_130px] items-center gap-3 text-right transition-all",
                  selected?.id === customer.id && "ring-2 ring-leaf-500/40",
                  overdue && "border-2 border-red-400 bg-red-50/60 dark:bg-red-950/20",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("ios-icon", overdue && "bg-red-100 dark:bg-red-950/40")}>
                    <UserRound className={cn("h-6 w-6", overdue && "text-red-600")} />
                  </div>
                  <div>
                    <p className={cn("text-lg font-black", overdue && "text-red-700 dark:text-red-400")}>{customer.name}</p>
                    <p className="text-sm text-market-ink/60">{customer.phone ?? "بدون هاتف"}</p>
                  </div>
                </div>
                <div className="border-r border-black/5 pr-3">
                  <p className="text-xs text-market-ink/50">دين متبقي</p>
                  <p className={cn("text-xl font-black", overdue && "text-red-600")}>{formatCurrency(customer.remainingDebt)}</p>
                  {customer.paymentDueDate ? (
                    <p className={cn("mt-1 flex items-center gap-1 text-xs", overdue ? "text-red-500 font-bold" : "text-market-ink/55")}>
                      <CalendarDays className="h-3 w-3" />
                      {overdue ? "انتهى: " : "أجل: "}{new Date(customer.paymentDueDate).toLocaleDateString("ar-DZ")}
                    </p>
                  ) : (
                    <p className="mt-1 flex items-center gap-1 text-xs text-market-ink/55">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(customer.lastActivityAt).split("،")[0]}
                    </p>
                  )}
                </div>
                <div className={cn("col-span-2 flex items-center justify-between border-t pt-3", overdue ? "border-red-200" : "border-black/5")}>
                  <div className={cn("inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black", status.className)}>
                    <Icon className="h-4 w-4" />
                    {status.label}
                  </div>
                  <span className={cn("text-sm", overdue ? "text-red-500 font-bold" : "text-market-ink/60")}>{status.sub}</span>
                </div>
              </button>
            );
          })}
        </section>

        <aside className="space-y-4">
          {selected ? (
            <div className="ios-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="ios-icon h-16 w-16 rounded-full">
                    <UserRound className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-leaf-700">{selected.name}</h2>
                    <p className="text-sm text-market-ink/60">{selected.phone ?? "بدون هاتف"}</p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => window.print()} title="طباعة كشف">
                  <Printer className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="ios-card-tight text-center">
                  <p className="text-xs text-market-ink/55">إجمالي المدفوع</p>
                  <p className="mt-2 font-black">{formatCurrency(selected.totalPaid)}</p>
                </div>
                <div className="ios-card-tight text-center">
                  <p className="text-xs text-market-ink/55">إجمالي الفواتير</p>
                  <p className="mt-2 font-black">{formatCurrency(selected.totalDebt)}</p>
                </div>
                <div className="ios-card-tight text-center">
                  <p className="text-xs text-market-ink/55">المتبقي</p>
                  <p className="mt-2 font-black">{formatCurrency(selected.remainingDebt)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button className="h-14" onClick={() => submitPayment(false)}>
                  <Plus className="h-5 w-5" />
                  إضافة دفعة
                </Button>
                <Button variant="secondary" className="h-14" onClick={() => window.print()}>
                  كشف الحساب
                </Button>
              </div>

              <div className="mt-4 grid gap-3">
                <Input
                  label="مبلغ الدفعة"
                  type="number"
                  value={payment.amount}
                  onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))}
                />
                <Input
                  label="ملاحظة"
                  value={payment.note}
                  onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))}
                />
                <Button variant="secondary" onClick={() => submitPayment(true)}>دفع كامل الدين</Button>
              </div>

              {/* Transaction history with purchase items */}
              <div className="mt-5">
                <h3 className="mb-3 text-xl font-black">سجل المعاملات</h3>
                <div className="divide-y divide-black/5">
                  {transactions.map((transaction) => {
                    const isExpanded = expandedTx === transaction.id;
                    const hasItems = transaction.type === "invoice" && transaction.items && transaction.items.length > 0;
                    return (
                      <div key={transaction.id} className="py-3">
                        <button
                          className="flex w-full items-center justify-between gap-2 text-right"
                          onClick={() => hasItems ? setExpandedTx(isExpanded ? null : transaction.id) : undefined}
                        >
                          <div className="flex items-center gap-2">
                            {transaction.type === "invoice"
                              ? <ShoppingBag className="h-4 w-4 text-orange-500" />
                              : <Wallet className="h-4 w-4 text-leaf-600" />
                            }
                            <div>
                              <p className={transaction.type === "payment" ? "font-black text-leaf-700" : "font-black text-orange-600"}>
                                {transaction.type === "payment" ? "دفعة" : "فاتورة كريدي"}
                              </p>
                              <p className="text-xs text-market-ink/55">{formatDate(transaction.createdAt)}</p>
                              {transaction.note ? <p className="text-xs text-market-ink/45">{transaction.note}</p> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-black">{formatCurrency(transaction.amount)}</p>
                            {hasItems ? (
                              isExpanded ? <ChevronUp className="h-4 w-4 text-market-ink/40" /> : <ChevronDown className="h-4 w-4 text-market-ink/40" />
                            ) : null}
                          </div>
                        </button>
                        {isExpanded && hasItems ? (
                          <div className="mt-2 space-y-1 rounded-2xl bg-orange-50/60 p-3">
                            <p className="mb-2 text-xs font-bold text-orange-700">المنتجات المشتراة:</p>
                            {transaction.items!.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Package className="h-3 w-3 text-orange-400" />
                                  <span className="font-bold">{item.name}</span>
                                  <span className="text-market-ink/55">× {item.quantity}</span>
                                </div>
                                <span className="font-black text-orange-700">{formatCurrency(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button variant="danger" className="mt-4 w-full" onClick={() => setDeleting(selected)}>
                <Trash2 className="h-4 w-4" />
                حذف الحساب
              </Button>
            </div>
          ) : null}

          {showForm ? (
            <form className="ios-card space-y-3" onSubmit={submitCustomer}>
              <h2 className="text-xl font-black">إضافة حساب كريدي</h2>
              <Input label="اسم الشخص" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              <Input label="رقم الهاتف" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              <Input label="العنوان" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
              <Input
                label="المبلغ غير المدفوع"
                type="number"
                min="0"
                value={form.openingDebt}
                onChange={(event) => setForm((current) => ({ ...current, openingDebt: Number(event.target.value) }))}
              />
              <div className="space-y-1">
                <label className="block text-sm font-bold text-market-ink/70">
                  <CalendarDays className="inline h-4 w-4 ml-1 text-red-500" />
                  تاريخ الدفع المحدد
                </label>
                <input
                  type="date"
                  value={form.paymentDueDate}
                  onChange={(event) => setForm((current) => ({ ...current, paymentDueDate: event.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/20 dark:border-white/10"
                />
                <p className="text-xs text-market-ink/45">عند حلول هذا التاريخ تتحول بطاقة الزبون للأحمر تلقائياً</p>
              </div>
              <Button className="w-full">حفظ الحساب</Button>
            </form>
          ) : null}
        </aside>
      </div>

      <button
        className="fixed bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-leaf-600 px-8 py-4 text-lg font-black text-white shadow-glass lg:hidden"
        onClick={() => setShowForm((value) => !value)}
      >
        <Plus className="h-6 w-6" />
        إضافة حساب كريدي
      </button>

      {selected ? <CreditStatement store={data.store} customer={selected} transactions={transactions} /> : null}

      {detailOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in no-print text-right">
          <div className="w-full max-w-4xl bg-white dark:bg-[#14211b] rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-black/10 dark:border-white/10">
            {/* Modal Header */}
            <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-leaf-50/50 dark:bg-leaf-950/20">
              <div className="flex items-center gap-3">
                <div className="ios-icon h-12 w-12 rounded-full">
                  <UserRound className="h-6 w-6 text-leaf-700 dark:text-leaf-400" />
                </div>
                <div>
                  <h2 className={cn("text-xl font-black", isPaymentOverdue(selected) ? "text-red-700 dark:text-red-400" : "text-leaf-800 dark:text-leaf-300")}>{selected.name}</h2>
                  <p className="text-xs text-market-ink/60 dark:text-white/60">
                    {selected.phone ? `الهاتف: ${selected.phone}` : "بدون هاتف"} 
                    {selected.address ? ` • العنوان: ${selected.address}` : ""}
                  </p>
                  {selected.paymentDueDate ? (
                    <p className={cn("mt-1 flex items-center gap-1 text-xs font-bold", isPaymentOverdue(selected) ? "text-red-500" : "text-market-ink/60 dark:text-white/60")}>
                      <CalendarDays className="h-3 w-3" />
                      {isPaymentOverdue(selected) ? "انتهى تاريخ الدفع: " : "تاريخ الدفع: "}
                      {new Date(selected.paymentDueDate).toLocaleDateString("ar-DZ")}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => window.print()} title="طباعة كشف الحساب">
                  <Printer className="h-4 w-4" />
                  طباعة الكشف
                </Button>
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className="ios-circle-button h-10 w-10 min-h-10 border border-black/5 dark:border-white/5 flex items-center justify-center"
                >
                  <X className="h-5 w-5 text-market-ink dark:text-white" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="ios-card-tight text-center bg-leaf-50/30 dark:bg-leaf-950/10 py-4 border border-leaf-100 dark:border-leaf-900/30">
                  <p className="text-xs text-market-ink/55 dark:text-white/55">إجمالي الفواتير (الديون)</p>
                  <p className="mt-2 text-lg font-black text-orange-600">{formatCurrency(selected.totalDebt)}</p>
                </div>
                <div className="ios-card-tight text-center bg-leaf-50/30 dark:bg-leaf-950/10 py-4 border border-leaf-100 dark:border-leaf-900/30">
                  <p className="text-xs text-market-ink/55 dark:text-white/55">إجمالي المدفوع (المسدد)</p>
                  <p className="mt-2 text-lg font-black text-leaf-700 dark:text-leaf-400">{formatCurrency(selected.totalPaid)}</p>
                </div>
                <div className="ios-card-tight text-center bg-leaf-600/10 dark:bg-leaf-500/10 py-4 border border-leaf-500/20">
                  <p className="text-xs text-market-ink/55 dark:text-white/55">الدين المتبقي الحالي</p>
                  <p className="mt-2 text-2xl font-black text-leaf-700 dark:text-leaf-400">{formatCurrency(selected.remainingDebt)}</p>
                </div>
              </div>

              {/* Add Payment Form */}
              <div className="bg-black/[0.02] dark:bg-white/[0.02] p-5 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
                <h3 className="text-base font-black text-market-ink/75 dark:text-white/75 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-leaf-600 dark:text-leaf-400" />
                  تسجيل دفعة جديدة لحساب الزبون
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="مبلغ الدفعة"
                    type="number"
                    value={payment.amount || ""}
                    onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))}
                    placeholder="مثال: 5000"
                  />
                  <Input
                    label="ملاحظة"
                    value={payment.note}
                    onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))}
                    placeholder="كتابة ملاحظة اختيارية..."
                  />
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="secondary" onClick={() => submitPayment(true)} className="h-11">
                    دفع كامل الدين ({formatCurrency(selected.remainingDebt)})
                  </Button>
                  <Button onClick={() => submitPayment(false)} className="h-11 px-6">
                    <Plus className="h-4 w-4" />
                    تسجيل الدفعة
                  </Button>
                </div>
              </div>

              {/* Running Balance Ledger */}
              <div className="space-y-3">
                <h3 className="text-lg font-black text-market-ink/80 dark:text-white/80">كشف المعاملات والديون بالتدقيق التفصيلي</h3>
                <div className="overflow-x-auto border border-black/5 dark:border-white/5 rounded-2xl">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/5 dark:border-white/5 text-xs font-black text-market-ink/70 dark:text-white/70">
                        <th className="p-3">التاريخ والوقت</th>
                        <th className="p-3">نوع المعاملة</th>
                        <th className="p-3">الملاحظات والتفاصيل</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3 text-left">الرصيد/الميزان الجاري</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm">
                      {ledgerTransactions.map((transaction) => {
                        const isExpanded = expandedTx === transaction.id;
                        const hasItems = transaction.type === "invoice" && transaction.items && transaction.items.length > 0;
                        return (
                          <>
                            <tr
                              key={transaction.id}
                              onClick={() => hasItems ? setExpandedTx(isExpanded ? null : transaction.id) : undefined}
                              className={cn(
                                "hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition",
                                hasItems && "cursor-pointer"
                              )}
                            >
                              <td className="p-3 text-xs text-market-ink/60 dark:text-white/60">
                                {formatDate(transaction.createdAt)}
                              </td>
                              <td className="p-3 font-bold">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black",
                                  transaction.type === "payment" 
                                    ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-950/40 dark:text-leaf-300"
                                    : "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                                )}>
                                  {transaction.type === "payment" ? "تأدية/دفعة" : "شراء بالكريدي"}
                                </span>
                              </td>
                              <td className="p-3 text-xs">
                                {transaction.type === "payment" ? (
                                  <span className="text-market-ink/75 dark:text-white/75">{transaction.note || "بدون ملاحظات"}</span>
                                ) : hasItems ? (
                                  <span className="flex items-center gap-1 text-leaf-600 dark:text-leaf-400 font-bold">
                                    <ShoppingBag className="h-3.5 w-3.5" />
                                    عرض المنتجات المشتراة ({transaction.items?.length})
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </span>
                                ) : (
                                  <span className="text-market-ink/50 dark:text-white/50">رصيد افتتاحي / تفاصيل أخرى</span>
                                )}
                              </td>
                              <td className={cn("p-3 font-black", transaction.type === "payment" ? "text-leaf-600 dark:text-leaf-400" : "text-orange-600")}>
                                {transaction.type === "payment" ? "-" : "+"}
                                {formatCurrency(transaction.amount)}
                              </td>
                              <td className="p-3 font-black text-left">
                                {formatCurrency(transaction.runningBalance)}
                              </td>
                            </tr>
                            {isExpanded && hasItems ? (
                              <tr key={`${transaction.id}-details`} className="bg-orange-50/20 dark:bg-orange-950/10">
                                <td colSpan={5} className="p-4 border-t border-black/5 dark:border-white/5">
                                  <div className="space-y-2 max-w-xl pr-4">
                                    <p className="text-xs font-black text-orange-700 dark:text-orange-400 mb-2">المنتجات:</p>
                                    <div className="space-y-1.5">
                                      {transaction.items!.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5">
                                          <div className="flex items-center gap-2">
                                            <Package className="h-3.5 w-3.5 text-orange-400" />
                                            <span className="font-bold text-market-ink dark:text-white">{item.name}</span>
                                            <span className="text-market-ink/50 dark:text-white/50">({formatNumber(item.quantity)} × {formatCurrency(item.quantity > 0 ? item.total / item.quantity : item.total)})</span>
                                          </div>
                                          <span className="font-black text-orange-600">{formatCurrency(item.total)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </>
                        );
                      })}
                      {ledgerTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-market-ink/40 dark:text-white/40">
                            لا توجد معاملات مسجلة لهذا الحساب.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex justify-between gap-3">
              <Button variant="danger" onClick={() => { setDeleting(selected); setDetailOpen(false); }}>
                <Trash2 className="h-4 w-4" />
                حذف الحساب نهائياً
              </Button>
              <Button onClick={() => setDetailOpen(false)} variant="secondary">
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف حساب كريدي"
        body={`هل تريد حذف حساب ${deleting?.name ?? "هذا الزبون"}؟ سيتم حذف السجل المحلي المرتبط به.`}
        confirmLabel="حذف"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteCustomer(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
