"use client";

import { useMemo, useState } from "react";
import { Banknote, Minus, Plus, QrCode, ReceiptText, Trash2, UserPlus } from "lucide-react";
import { KeyboardScanner } from "@/components/scanner/keyboard-scanner";
import { Receipt } from "@/components/print/receipt";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { Sale, SaleItem, SaleType } from "@/types";
import { buildSaleItem, calculateSaleTotals } from "@/utils/calculations";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format";

export default function PosPage() {
  const { data, findProductByCode, createSale, upsertCustomer } = useStore();
  const { notify } = useToast();
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [qr, setQr] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("cash");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const totals = useMemo(() => calculateSaleTotals(cart), [cart]);
  const remaining = Math.max(0, totals.totalAmount - paidAmount);

  function addByCode(code: string) {
    const product = findProductByCode(code);
    if (!product) {
      notify({ tone: "warning", title: "المنتج غير موجود", body: code });
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) => (item.productId === product.id ? buildSaleItem(product, item.quantity + 1) : item));
      }
      return [buildSaleItem(product, 1), ...current];
    });
    setQr("");
  }

  function updateQty(productId: string, quantity: number) {
    const product = data?.products.find((item) => item.id === productId);
    if (!product) return;
    setCart((current) =>
      current.map((item) => (item.productId === productId ? buildSaleItem(product, Math.max(1, quantity)) : item)),
    );
  }

  async function completeSale() {
    if (!data) return;
    setSubmitting(true);
    try {
      let selectedCustomerId = customerId;
      let selectedCustomerName = data.creditCustomers.find((customer) => customer.id === customerId)?.name;

      if (saleType === "credit" && !selectedCustomerId && newCustomerName.trim()) {
        const customer = await upsertCustomer({ name: newCustomerName });
        selectedCustomerId = customer.id;
        selectedCustomerName = customer.name;
      }

      const sale = await createSale({
        type: saleType,
        items: totals.items,
        customerId: selectedCustomerId || undefined,
        customerName: selectedCustomerName,
        paidAmount: saleType === "cash" ? totals.totalAmount : paidAmount,
      });
      setLastSale(sale);
      setCart([]);
      setPaidAmount(0);
      setNewCustomerName("");
    } catch (error) {
      notify({ tone: "error", title: "تعذر إتمام البيع", body: error instanceof Error ? error.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) return null;

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="" className="ios-avatar" />
        <div className="flex-1 pt-2">
          <h1 className="ios-title">البيع</h1>
        </div>
        <button className="ios-circle-button" title="تنبيهات">
          <QrCode className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 hidden lg:block">
        <h1 className="text-3xl font-black">البيع</h1>
        <p className="mt-1 text-market-ink/60">نقطة بيع سريعة للسالك والكريدي.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <section className="space-y-5">
          <div className="ios-search">
            <QrCode className="h-7 w-7 text-leaf-700" />
            <input
              value={qr}
              onChange={(event) => setQr(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addByCode(qr);
              }}
              placeholder="امسح أو أدخل باركود المنتج"
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <button onClick={() => addByCode(qr)} className="text-sm font-black text-leaf-700">إضافة</button>
          </div>

          <div className="ios-card-tight grid grid-cols-2 gap-2 p-2">
            {(["cash", "credit"] as SaleType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSaleType(type)}
                className={cn(
                  "h-16 rounded-3xl text-lg font-black transition",
                  saleType === type ? "bg-leaf-50 text-leaf-700 shadow-soft" : "text-market-ink/70",
                )}
              >
                {type === "cash" ? "بيع سالك" : "بيع كريدي"}
              </button>
            ))}
          </div>

          {saleType === "credit" ? (
            <div className="space-y-3">
              <p className="text-xl font-black">العميل</p>
              <div className="grid grid-cols-[1fr_150px] gap-3">
                <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">اختر العميل</option>
                  {data.creditCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </Select>
                <Button variant="secondary">
                  <UserPlus className="h-5 w-5" />
                  عميل جديد
                </Button>
              </div>
              <Input
                value={newCustomerName}
                onChange={(event) => setNewCustomerName(event.target.value)}
                placeholder="أو اكتب اسم عميل جديد"
              />
            </div>
          ) : null}

          <div className="ios-card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-4">
              <button className="text-red-600" onClick={() => setCart([])} title="تفريغ">
                <Trash2 className="h-5 w-5" />
              </button>
              <h2 className="flex items-center gap-2 text-xl font-black">
                قائمة المنتجات
                <span className="rounded-full bg-leaf-50 px-3 py-1 text-base text-leaf-700">{cart.length}</span>
              </h2>
            </div>

            {totals.items.length ? (
              <div className="divide-y divide-black/5">
                {totals.items.map((item) => {
                  const product = data.products.find((candidate) => candidate.id === item.productId);
                  return (
                    <div key={item.productId} className="grid grid-cols-[1fr_116px] gap-3 px-4 py-4">
                      <div className="flex gap-3">
                        {product?.imageUrl ? <img src={product.imageUrl} alt="" className="h-20 w-16 object-contain" /> : <ReceiptText className="h-12 w-12 text-leaf-600" />}
                        <div>
                          <p className="text-lg font-black">{item.name}</p>
                          <p className="text-sm text-market-ink/55">#{item.qrCode.slice(-4)}</p>
                          <p className="mt-1 text-sm font-bold text-leaf-700">ربح الوحدة: {formatCurrency(item.unitPrice - item.unitCost)}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-xl font-black">{formatCurrency(item.total)}</p>
                        <p className="text-sm text-market-ink/55">{formatCurrency(item.unitPrice)} للوحدة</p>
                        <div className="mt-3 inline-flex items-center rounded-2xl border border-black/10 bg-white">
                          <button className="p-2" onClick={() => updateQty(item.productId, item.quantity - 1)}><Minus className="h-4 w-4" /></button>
                          <span className="min-w-10 text-center font-black">{item.quantity}</span>
                          <button className="p-2" onClick={() => updateQty(item.productId, item.quantity + 1)}><Plus className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-market-ink/55">امسح منتجاً أو اختر من المنتجات السريعة</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {data.products.slice(0, 6).map((product) => (
              <button key={product.id} onClick={() => addByCode(product.qrCode)} className="ios-card-tight text-center">
                {product.imageUrl ? <img src={product.imageUrl} alt="" className="mx-auto h-14 w-14 object-contain" /> : null}
                <p className="mt-2 line-clamp-1 text-sm font-bold">{product.name}</p>
              </button>
            ))}
          </div>

          <Button variant="secondary" className="w-full" onClick={() => setShowScanner((value) => !value)}>
            <QrCode className="h-4 w-4" />
            {showScanner ? "إخفاء وضع الماسح" : "اختبار الماسح"}
          </Button>
          {showScanner ? <KeyboardScanner onScan={addByCode} /> : null}
        </section>

        <aside className="space-y-4">
          <div className="ios-card bg-leaf-50/45">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-market-ink/60">إجمالي المنتجات</p>
                <p className="mt-1 text-2xl font-black">{formatCurrency(totals.totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-market-ink/60">إجمالي الربح</p>
                <p className="mt-1 text-2xl font-black text-leaf-700">{formatCurrency(totals.totalProfit)}</p>
              </div>
              <div>
                <p className="text-sm text-market-ink/60">المبلغ المدفوع</p>
                <p className="mt-1 text-2xl font-black">{formatCurrency(saleType === "cash" ? totals.totalAmount : paidAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-market-ink/60">المتبقي</p>
                <p className="mt-1 text-2xl font-black text-red-600">{formatCurrency(saleType === "cash" ? 0 : remaining)}</p>
              </div>
            </div>
          </div>

          {saleType === "credit" ? (
            <div className="ios-card-tight">
              <Input
                label="المبلغ المدفوع"
                type="number"
                value={paidAmount}
                onChange={(event) => setPaidAmount(Number(event.target.value))}
              />
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[20, 50, 100].map((value) => (
                  <button key={value} className="ios-chip min-h-10 px-2" onClick={() => setPaidAmount((current) => current + value)}>
                    +{value}
                  </button>
                ))}
                <button className="ios-chip ios-chip-active min-h-10 px-2" onClick={() => setPaidAmount(totals.totalAmount)}>
                  الكل
                </button>
              </div>
            </div>
          ) : (
            <div className="ios-card-tight flex items-center gap-3">
              <div className="ios-icon">
                <Banknote className="h-6 w-6" />
              </div>
              <div>
                <p className="font-black">الدفع نقدي</p>
                <p className="text-sm text-market-ink/55">سيتم قبض كامل الفاتورة</p>
              </div>
            </div>
          )}

          <Button className="h-16 w-full rounded-3xl text-xl" onClick={completeSale} disabled={!cart.length} loading={submitting}>
            <ReceiptText className="h-6 w-6" />
            إتمام البيع
          </Button>

          {lastSale ? (
            <div className="ios-card-tight">
              <p className="font-black">آخر وصل</p>
              <p className="mt-1 text-sm text-market-ink/60">{lastSale.receiptNumber} - {formatCurrency(lastSale.totalAmount)}</p>
              <Button variant="secondary" className="mt-3 w-full" onClick={() => window.print()}>
                طباعة الوصل
              </Button>
            </div>
          ) : null}
        </aside>
      </div>

      {lastSale ? <Receipt sale={lastSale} store={data.store} /> : null}
    </div>
  );
}
