"use client";

import { useMemo, useState } from "react";
import { Camera, Minus, Plus, Printer, ReceiptText, ScanLine, Search, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { QrCameraScanner } from "@/components/scanner/qr-camera-scanner";
import { KeyboardScanner } from "@/components/scanner/keyboard-scanner";
import { Receipt } from "@/components/print/receipt";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { Sale, SaleItem, SaleType } from "@/types";
import { buildSaleItem, calculateSaleTotals } from "@/utils/calculations";
import { cn } from "@/utils/cn";
import { formatCurrency, formatNumber } from "@/utils/format";

export default function PosPage() {
  const { data, findProductByCode, createSale, upsertCustomer } = useStore();
  const { notify } = useToast();
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [qr, setQr] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [saleType, setSaleType] = useState<SaleType>("cash");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(() => calculateSaleTotals(cart), [cart]);

  function addByCode(code: string) {
    const product = findProductByCode(code);
    if (!product) {
      notify({ tone: "warning", title: "المنتج غير موجود", body: code });
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? buildSaleItem(product, item.quantity + 1) : item,
        );
      }
      return [buildSaleItem(product, 1), ...current];
    });
    setQr("");
  }

  function updateQty(productId: string, quantity: number) {
    const product = data?.products.find((item) => item.id === productId);
    if (!product) {
      return;
    }
    setCart((current) =>
      current.map((item) => (item.productId === productId ? buildSaleItem(product, Math.max(1, quantity)) : item)),
    );
  }

  async function completeSale() {
    if (!data) {
      return;
    }

    setSubmitting(true);
    try {
      let selectedCustomerId = customerId;
      let selectedCustomerName = data.creditCustomers.find((customer) => customer.id === customerId)?.name;

      if (saleType === "credit" && !selectedCustomerId && newCustomerName.trim()) {
        const customer = await upsertCustomer({ name: newCustomerName });
        selectedCustomerId = customer.id;
        selectedCustomerName = customer.name;
        setCustomerId(customer.id);
      }

      const sale = await createSale({
        type: saleType,
        items: totals.items,
        customerId: selectedCustomerId || undefined,
        customerName: selectedCustomerName,
        paidAmount,
      });
      setLastSale(sale);
      setCart([]);
      setPaidAmount(0);
      setNewCustomerName("");
    } catch (error) {
      notify({
        tone: "error",
        title: "تعذر إتمام البيع",
        body: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return null;
  }

  return (
    <div>
      <PageHeader icon={ReceiptText} title="صفحة البيع" description="POS سريع للبيع السالك والكريدي مع QR وإيصال للطباعة." />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5">
          <Card>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                label="خانة مسح QR"
                value={qr}
                onChange={(event) => setQr(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addByCode(qr);
                  }
                }}
                placeholder="امسح أو اكتب QR"
              />
              <div className="flex items-end gap-2">
                <Button type="button" onClick={() => addByCode(qr)}>
                  <Search className="h-4 w-4" />
                  إضافة
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowCamera((value) => !value)}>
                <Camera className="h-4 w-4" />
                فتح الكاميرا
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowScanner((value) => !value)}>
                <ScanLine className="h-4 w-4" />
                وضع الماسح
              </Button>
            </div>
            {showCamera ? (
              <div className="mt-4">
                <QrCameraScanner onScan={addByCode} />
              </div>
            ) : null}
            {showScanner ? (
              <div className="mt-4">
                <KeyboardScanner onScan={addByCode} />
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-lg font-black">منتجات سريعة</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.products.slice(0, 8).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addByCode(product.qrCode)}
                  className="rounded-lg border border-black/8 bg-white/60 p-3 text-right transition hover:bg-white dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/12"
                >
                  <p className="font-bold">{product.name}</p>
                  <p className="mt-1 text-xs text-market-ink/55 dark:text-white/55">
                    {formatCurrency(product.sellPrice)} · {formatNumber(product.quantity)} قطعة
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </section>

        <section className="space-y-5">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">الفاتورة</h2>
              <div className="flex gap-2">
                {(["cash", "credit"] as SaleType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSaleType(type)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-black transition",
                      saleType === type
                        ? "bg-leaf-600 text-white dark:bg-leaf-400 dark:text-market-ink"
                        : "bg-white/70 text-market-ink/66 dark:bg-white/8 dark:text-white/66",
                    )}
                  >
                    {type === "cash" ? "بيع سالك" : "بيع كريدي"}
                  </button>
                ))}
              </div>
            </div>

            {cart.length ? (
              <div className="space-y-3">
                {totals.items.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-lg border border-black/5 bg-white/58 p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{item.name}</p>
                        <p className="text-xs text-market-ink/55 dark:text-white/55">{formatCurrency(item.unitPrice)} للقطعة</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCart((current) => current.filter((cartItem) => cartItem.productId !== item.productId))}
                        title="حذف من الفاتورة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" onClick={() => updateQty(item.productId, item.quantity - 1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          aria-label="الكمية"
                          className="w-20 text-center"
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) => updateQty(item.productId, Number(event.target.value))}
                        />
                        <Button type="button" variant="secondary" onClick={() => updateQty(item.productId, item.quantity + 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-left">
                        <p className="font-black">{formatCurrency(item.total)}</p>
                        <p className="text-xs text-leaf-700 dark:text-leaf-200">ربح {formatCurrency(item.profit)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={ReceiptText} title="الفاتورة فارغة" body="امسح QR أو اختر منتجاً سريعاً لإضافة عناصر." />
            )}

            {saleType === "credit" ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Select label="حساب كريدي" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">اختر زبوناً</option>
                  {data.creditCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {formatCurrency(customer.remainingDebt)}
                    </option>
                  ))}
                </Select>
                <Input
                  label="إنشاء زبون جديد"
                  value={newCustomerName}
                  onChange={(event) => setNewCustomerName(event.target.value)}
                  placeholder="اسم الزبون"
                />
                <Input
                  label="دفعة مباشرة اختيارية"
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(Number(event.target.value))}
                />
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <p className="text-xs text-market-ink/55 dark:text-white/55">إجمالي الفاتورة</p>
                <p className="mt-2 text-xl font-black">{formatCurrency(totals.totalAmount)}</p>
              </div>
              <div className="metric-card">
                <p className="text-xs text-market-ink/55 dark:text-white/55">ربح الفاتورة</p>
                <p className="mt-2 text-xl font-black">{formatCurrency(totals.totalProfit)}</p>
              </div>
              <div className="metric-card">
                <p className="text-xs text-market-ink/55 dark:text-white/55">عدد المنتجات</p>
                <p className="mt-2 text-xl font-black">{formatNumber(totals.items.length)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCart([])} disabled={!cart.length}>
                <Trash2 className="h-4 w-4" />
                تفريغ
              </Button>
              <Button type="button" onClick={completeSale} disabled={!cart.length} loading={submitting}>
                <ReceiptText className="h-4 w-4" />
                إتمام البيع
              </Button>
              {lastSale ? (
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  طباعة الوصل
                </Button>
              ) : null}
            </div>
          </Card>

          {lastSale ? (
            <Card>
              <h2 className="text-lg font-black">آخر وصل</h2>
              <p className="mt-2 text-sm text-market-ink/62 dark:text-white/62">
                {lastSale.receiptNumber} · {formatCurrency(lastSale.totalAmount)} · ربح {formatCurrency(lastSale.totalProfit)}
              </p>
            </Card>
          ) : null}
        </section>
      </div>

      {lastSale ? <Receipt sale={lastSale} store={data.store} /> : null}
    </div>
  );
}
