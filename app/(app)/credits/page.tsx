"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Filter, Plus, Printer, Search, Trash2, UserRound, UsersRound, Wallet } from "lucide-react";
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

function customerStatus(customer: CreditCustomer) {
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
  const [form, setForm] = useState({ name: "", phone: "", address: "", openingDebt: 0 });
  const [payment, setPayment] = useState({ amount: 0, note: "" });

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

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const customer = await upsertCustomer({
        name: form.name,
        phone: form.phone,
        address: form.address,
        totalDebt: form.openingDebt,
        remainingDebt: form.openingDebt,
      });
      setSelectedId(customer.id);
      setForm({ name: "", phone: "", address: "", openingDebt: 0 });
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
            return (
              <button
                key={customer.id}
                onClick={() => setSelectedId(customer.id)}
                className={cn(
                  "ios-card-tight grid w-full grid-cols-[1fr_130px] items-center gap-3 text-right",
                  selected?.id === customer.id && "ring-2 ring-leaf-500/40",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="ios-icon">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-black">{customer.name}</p>
                    <p className="text-sm text-market-ink/60">{customer.phone ?? "بدون هاتف"}</p>
                  </div>
                </div>
                <div className="border-r border-black/5 pr-3">
                  <p className="text-xs text-market-ink/50">دين متبقي</p>
                  <p className="text-xl font-black">{formatCurrency(customer.remainingDebt)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-market-ink/55">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(customer.lastActivityAt).split("،")[0]}
                  </p>
                </div>
                <div className="col-span-2 flex items-center justify-between border-t border-black/5 pt-3">
                  <div className={cn("inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black", status.className)}>
                    <Icon className="h-4 w-4" />
                    {status.label}
                  </div>
                  <span className="text-sm text-market-ink/60">{status.sub}</span>
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

              <div className="mt-5">
                <h3 className="mb-3 text-xl font-black">سجل المعاملات</h3>
                <div className="divide-y divide-black/5">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className={transaction.type === "payment" ? "font-black text-leaf-700" : "font-black text-orange-600"}>
                          {transaction.type === "payment" ? "دفعة" : "فاتورة"}
                        </p>
                        <p className="text-xs text-market-ink/55">{formatDate(transaction.createdAt)}</p>
                      </div>
                      <p className="font-black">{formatCurrency(transaction.amount)}</p>
                    </div>
                  ))}
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
