"use client";

import { FormEvent, useMemo, useState } from "react";
import { CircleDollarSign, Edit, Filter, Printer, Search, Trash2, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { CreditStatement } from "@/components/print/credit-statement";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { CreditCustomer } from "@/types";
import { cn } from "@/utils/cn";
import { formatCurrency, formatDate } from "@/utils/format";

export default function CreditsPage() {
  const { data, upsertCustomer, deleteCustomer, addPayment } = useStore();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [largeOnly, setLargeOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [editing, setEditing] = useState<CreditCustomer | null>(null);
  const [deleting, setDeleting] = useState<CreditCustomer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [payment, setPayment] = useState({ amount: 0, note: "" });

  const customers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.creditCustomers ?? [])
      .filter((customer) => !normalized || customer.name.toLowerCase().includes(normalized))
      .filter((customer) => !largeOnly || customer.remainingDebt >= 10000)
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
        id: editing?.id,
        name: form.name,
        phone: form.phone,
        address: form.address,
      });
      setSelectedId(customer.id);
      setEditing(null);
      setForm({ name: "", phone: "", address: "" });
    } catch (error) {
      notify({ tone: "error", title: "تعذر حفظ الحساب", body: error instanceof Error ? error.message : undefined });
    }
  }

  function startEdit(customer: CreditCustomer) {
    setEditing(customer);
    setForm({ name: customer.name, phone: customer.phone ?? "", address: customer.address ?? "" });
  }

  async function submitPayment(full = false) {
    if (!selected) {
      return;
    }
    const amount = full ? selected.remainingDebt : payment.amount;
    try {
      await addPayment(selected.id, amount, payment.note || (full ? "دفع كامل الدين" : undefined));
      setPayment({ amount: 0, note: "" });
    } catch (error) {
      notify({ tone: "error", title: "تعذر تسجيل الدفعة", body: error instanceof Error ? error.message : undefined });
    }
  }

  if (!data) {
    return null;
  }

  return (
    <div>
      <PageHeader
        icon={CircleDollarSign}
        title="الكريديات"
        description="حسابات الزبائن، الفواتير، الدفعات، وكشف الحساب."
      />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5">
          <Card>
            <form className="space-y-3" onSubmit={submitCustomer}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">{editing ? "تعديل حساب" : "إنشاء حساب كريدي"}</h2>
                {editing ? (
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                    إلغاء
                  </Button>
                ) : null}
              </div>
              <Input
                label="اسم الشخص"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="رقم الهاتف"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
                <Input
                  label="العنوان"
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                />
              </div>
              <Button>
                <UserPlus className="h-4 w-4" />
                حفظ الحساب
              </Button>
            </form>
          </Card>

          <Card>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input label="بحث باسم الشخص" value={query} onChange={(event) => setQuery(event.target.value)} />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant={largeOnly ? "primary" : "secondary"}
                  onClick={() => setLargeOnly((value) => !value)}
                >
                  <Filter className="h-4 w-4" />
                  ديون كبيرة
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {customers.length ? (
                customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedId(customer.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-right transition",
                      selected?.id === customer.id
                        ? "border-leaf-500 bg-leaf-50/82 dark:bg-leaf-500/15"
                        : "border-black/5 bg-white/58 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{customer.name}</p>
                        <p className="text-xs text-market-ink/55 dark:text-white/55">
                          آخر عملية {formatDate(customer.lastActivityAt)}
                        </p>
                      </div>
                      <span className="font-black text-orange-700 dark:text-orange-200">
                        {formatCurrency(customer.remainingDebt)}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState icon={Search} title="لا توجد حسابات" body="أنشئ حساب كريدي جديد أو غيّر البحث." />
              )}
            </div>
          </Card>
        </section>

        <section>
          {selected ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{selected.name}</h2>
                  <p className="mt-1 text-sm text-market-ink/60 dark:text-white/60">
                    {selected.phone ?? "بدون هاتف"} · {selected.address ?? "بدون عنوان"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => startEdit(selected)}>
                    <Edit className="h-4 w-4" />
                    تعديل
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    طباعة كشف
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(selected)}>
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="metric-card">
                  <p className="text-xs text-market-ink/55 dark:text-white/55">إجمالي الدين</p>
                  <p className="mt-2 text-xl font-black">{formatCurrency(selected.totalDebt)}</p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-market-ink/55 dark:text-white/55">المبلغ المدفوع</p>
                  <p className="mt-2 text-xl font-black">{formatCurrency(selected.totalPaid)}</p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-market-ink/55 dark:text-white/55">المتبقي</p>
                  <p className="mt-2 text-xl font-black">{formatCurrency(selected.remainingDebt)}</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
                <h3 className="font-black">إضافة دفعة</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                  <Input
                    label="المبلغ"
                    type="number"
                    min="0"
                    value={payment.amount}
                    onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))}
                  />
                  <Input
                    label="ملاحظة"
                    value={payment.note}
                    onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))}
                  />
                  <div className="flex items-end">
                    <Button type="button" onClick={() => submitPayment(false)}>
                      <Wallet className="h-4 w-4" />
                      تسجيل
                    </Button>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="secondary" onClick={() => submitPayment(true)}>
                      دفع كامل
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="font-black">سجل الفواتير والدفعات</h3>
                <div className="mt-3 space-y-3">
                  {transactions.length ? (
                    transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/5 bg-white/58 p-3 dark:border-white/10 dark:bg-white/5"
                      >
                        <div>
                          <p className="font-bold">{transaction.type === "invoice" ? "فاتورة كريدي" : "دفعة"}</p>
                          <p className="text-xs text-market-ink/55 dark:text-white/55">
                            {formatDate(transaction.createdAt)} {transaction.note ? `· ${transaction.note}` : ""}
                          </p>
                        </div>
                        <span className={transaction.type === "payment" ? "font-black text-leaf-700 dark:text-leaf-200" : "font-black"}>
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={CircleDollarSign} title="لا يوجد سجل" body="ستظهر فواتير الكريدي والدفعات هنا." />
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState icon={CircleDollarSign} title="اختر حساباً" body="أنشئ أو اختر زبوناً لعرض التفاصيل." />
          )}
        </section>
      </div>

      {selected ? <CreditStatement store={data.store} customer={selected} transactions={transactions} /> : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف حساب كريدي"
        body={`هل تريد حذف حساب ${deleting?.name ?? "هذا الزبون"}؟ سيتم حذف السجل المحلي المرتبط به.`}
        confirmLabel="حذف"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteCustomer(deleting.id);
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
