"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Banknote, Minus, Percent, Plus, QrCode, ReceiptText, Tag, Trash2, UserPlus, Zap, Printer } from "lucide-react";
import { KeyboardScanner } from "@/components/scanner/keyboard-scanner";
import { Receipt } from "@/components/print/receipt";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { Sale, SaleItem, SaleType } from "@/types";
import { buildSaleItem, calculateSaleTotals } from "@/utils/calculations";
import { cn } from "@/utils/cn";
import { formatCurrency, formatQuantity, unitPriceLabel } from "@/utils/format";

function saleStep(item: SaleItem) {
  return item.saleUnit === "gram" ? 100 : 1;
}

function amountStep(amount: number) {
  if (amount >= 1000) return 100;
  if (amount >= 100) return 50;
  return 10;
}

function parseCartNumber(value: string) {
  const normalized = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(",", ".")
    .replace("٫", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanCartNumberInput(value: string, mode: "amount" | "quantity") {
  const allowed = mode === "amount" ? /[^0-9٠-٩۰-۹,.٫]/g : /[^0-9٠-٩۰-۹]/g;
  return value.replace(allowed, "");
}

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
  const [focusProductId, setFocusProductId] = useState("");
  const [cartInputValues, setCartInputValues] = useState<Record<string, string>>({});
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [autoPrint, setAutoPrint] = useState(true);

  const totals = useMemo(() => calculateSaleTotals(cart), [cart]);

  // When discount% changes, recompute amount; when amount changes, recompute %
  const effectiveDiscount = Math.min(discountAmount, totals.totalAmount);
  const finalAmount = Math.max(0, totals.totalAmount - effectiveDiscount);
  const remaining = Math.max(0, finalAmount - paidAmount);

  useEffect(() => {
    if (!focusProductId) return;
    const input = document.querySelector<HTMLInputElement>(`[data-cart-input="${focusProductId}"]`);
    if (!input) return;
    input.focus();
    input.select();
    setFocusProductId("");
  }, [cart, focusProductId]);

  function addItem(product: any) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) => (item.productId === product.id ? buildSaleItem(product, item.quantity + saleStep(item)) : item));
      }
      return [buildSaleItem(product, product.saleUnit === "gram" ? 100 : 1), ...current];
    });
    setFocusProductId(product.id);
    setQr("");
  }

  function addByCode(code: string) {
    const product = findProductByCode(code);
    if (!product) {
      notify({ tone: "warning", title: "المنتج غير موجود", body: code });
      return;
    }
    addItem(product);
  }

  useEffect(() => {
    function handleAdd(e: Event) {
      const customEvent = e as CustomEvent<{ code: string }>;
      if (customEvent.detail && customEvent.detail.code) {
        addByCode(customEvent.detail.code);
      }
    }
    window.addEventListener("blgasm-add-to-cart", handleAdd);
    return () => {
      window.removeEventListener("blgasm-add-to-cart", handleAdd);
    };
  }, [addByCode]);

  useEffect(() => {
    const pending = window.localStorage.getItem("blgasm-pending-add");
    if (pending) {
      addByCode(pending);
      window.localStorage.removeItem("blgasm-pending-add");
    }
  }, [addByCode]);

  useEffect(() => {
    if (lastSale && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [lastSale, autoPrint]);

  const suggestions = useMemo(() => {
    if (!qr.trim()) return [];
    const q = qr.toLowerCase();
    return (data?.products ?? []).filter(
      (p) => p.name.toLowerCase().includes(q) || p.qrCode.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [qr, data?.products]);

  function updateQty(productId: string, quantity: number) {
    const product = data?.products.find((item) => item.id === productId);
    if (!product) return;
    setCart((current) =>
      current.map((item) => (item.productId === productId ? buildSaleItem(product, Math.max(0, quantity)) : item)),
    );
  }

  function updateAmount(productId: string, amount: number) {
    const product = data?.products.find((item) => item.id === productId);
    if (!product) return;
    const unitPrice = product.saleUnit === "gram" ? product.sellPrice / product.unitsPerWholesale : product.sellPrice;
    const quantity = unitPrice > 0 ? amount / unitPrice : 1;
    updateQty(productId, quantity);
  }

  function changeCartInput(productId: string, rawValue: string, mode: "amount" | "quantity") {
    const cleanValue = cleanCartNumberInput(rawValue, mode);
    setCartInputValues((current) => ({ ...current, [productId]: cleanValue }));
    const value = parseCartNumber(cleanValue);
    if (value === null) return;
    if (mode === "amount") {
      updateAmount(productId, value);
    } else {
      updateQty(productId, value);
    }
  }

  function commitCartInput(productId: string) {
    setCartInputValues((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function stepCartInput(item: SaleItem, direction: 1 | -1) {
    const rawValue = cartInputValues[item.productId];
    const typedValue = rawValue === undefined ? null : parseCartNumber(rawValue);
    if (item.saleUnit === "gram") {
      const currentAmount = typedValue ?? item.total;
      const nextAmount = Math.max(0, currentAmount + direction * amountStep(currentAmount));
      changeCartInput(item.productId, String(nextAmount), "amount");
      return;
    }
    const currentQuantity = typedValue ?? item.quantity;
    const nextQuantity = Math.max(0, currentQuantity + direction * saleStep(item));
    changeCartInput(item.productId, String(nextQuantity), "quantity");
  }

  function handleCartInputKey(event: KeyboardEvent<HTMLInputElement>, item: SaleItem) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      stepCartInput(item, 1);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      stepCartInput(item, -1);
      return;
    }
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
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
        paidAmount: saleType === "cash" ? finalAmount : paidAmount,
        discountAmount: effectiveDiscount,
      });
      setLastSale(sale);
      setCart([]);
      setCartInputValues({});
      setPaidAmount(0);
      setDiscountAmount(0);
      setDiscountPercent(0);
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
          <div className="relative">
            <div className="ios-search">
              <QrCode className="h-7 w-7 text-leaf-700" />
              <input
                value={qr}
                onChange={(event) => setQr(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    const match = findProductByCode(qr);
                    if (match) {
                      addByCode(qr);
                    } else if (suggestions.length > 0) {
                      addItem(suggestions[0]);
                    } else {
                      addByCode(qr);
                    }
                  }
                }}
                placeholder="امسح الباركود أو ابحث باسم المنتج..."
                className="min-w-0 flex-1 bg-transparent text-base outline-none text-right"
              />
              {qr ? (
                <button
                  type="button"
                  onClick={() => setQr("")}
                  className="text-xs font-bold text-market-ink/40 dark:text-white/40 hover:text-market-ink/60 px-2"
                >
                  مسح
                </button>
              ) : null}
              <button onClick={() => addByCode(qr)} className="text-sm font-black text-leaf-700">إضافة</button>
            </div>

            {suggestions.length > 0 ? (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-white/18 dark:bg-[#14211b]/95">
                <div className="divide-y divide-black/5 dark:divide-white/5 max-h-60 overflow-y-auto">
                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        addItem(product);
                      }}
                      className="w-full text-right px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl flex items-center justify-between gap-3 text-sm font-bold transition"
                    >
                      <span className="text-market-ink dark:text-white">{product.name}</span>
                      <span className="text-xs text-market-ink/50 dark:text-white/50">{formatCurrency(product.sellPrice)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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

          {/* Cart as rows */}
          <div className="ios-card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-4">
              <button
                className="text-red-600"
                onClick={() => { setCart([]); setCartInputValues({}); }}
                title="تفريغ"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <h2 className="flex items-center gap-2 text-xl font-black">
                قائمة المنتجات
                <span className="rounded-full bg-leaf-50 px-3 py-1 text-base text-leaf-700">{cart.length}</span>
              </h2>
            </div>

            {totals.items.length ? (
              <div className="divide-y divide-black/5">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_80px_90px_36px] gap-2 bg-market-ink/3 px-4 py-2 text-xs font-bold text-market-ink/50">
                  <span>المنتج</span>
                  <span className="text-center">الكمية</span>
                  <span className="text-left">الإجمالي</span>
                  <span />
                </div>
                {totals.items.map((item) => (
                  <div key={item.productId} className="grid grid-cols-[1fr_80px_90px_36px] items-center gap-2 px-4 py-3">
                    {/* Name + price */}
                    <div>
                      <p className="font-black leading-tight">{item.name}</p>
                      <p className="text-xs text-market-ink/50">
                        {formatCurrency(item.saleUnit === "gram" ? item.unitPrice * 1000 : item.unitPrice)} {unitPriceLabel(item.saleUnit)}
                      </p>
                    </div>

                    {/* Qty stepper */}
                    <div className="flex items-center justify-center rounded-2xl border border-black/10 bg-white">
                      <button
                        type="button"
                        className="px-1.5 py-1.5"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => stepCartInput(item, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        className="w-10 bg-transparent text-center text-sm font-black outline-none"
                        type="text"
                        inputMode={item.saleUnit === "gram" ? "decimal" : "numeric"}
                        value={cartInputValues[item.productId] ?? (item.saleUnit === "gram" ? item.total : item.quantity)}
                        data-cart-input={item.productId}
                        onChange={(event) => changeCartInput(item.productId, event.target.value, item.saleUnit === "gram" ? "amount" : "quantity")}
                        onBlur={() => commitCartInput(item.productId)}
                        onKeyDown={(event) => handleCartInputKey(event, item)}
                        aria-label={`كمية ${item.name}`}
                      />
                      <button
                        type="button"
                        className="px-1.5 py-1.5"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => stepCartInput(item, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Total */}
                    <p className="text-left font-black">{formatCurrency(item.total)}</p>

                    {/* Remove */}
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-50"
                      onClick={() => setCart((c) => c.filter((i) => i.productId !== item.productId))}
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-market-ink/55">امسح منتجاً أو اختر من الاختصارات</div>
            )}
          </div>

          {/* Shortcuts grid */}




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
              {effectiveDiscount > 0 ? (
                <div>
                  <p className="text-sm text-market-ink/60">الخصم</p>
                  <p className="mt-1 text-2xl font-black text-orange-600">-{formatCurrency(effectiveDiscount)}</p>
                </div>
              ) : null}
              <div>
                <p className="text-sm text-market-ink/60">المبلغ المدفوع</p>
                <p className="mt-1 text-2xl font-black">{formatCurrency(saleType === "cash" ? finalAmount : paidAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-market-ink/60">المتبقي</p>
                <p className="mt-1 text-2xl font-black text-red-600">{formatCurrency(saleType === "cash" ? 0 : remaining)}</p>
              </div>
            </div>
          </div>

          {/* Discount field */}
          <div className="ios-card-tight space-y-3">
            <p className="font-black flex items-center gap-2">
              <Percent className="h-4 w-4 text-orange-500" />
              الخصم
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-market-ink/60">خصم بالمبلغ (دج)</label>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDiscountAmount(val);
                    setDiscountPercent(totals.totalAmount > 0 ? Math.round((val / totals.totalAmount) * 100) : 0);
                  }}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-center font-black outline-none focus:border-leaf-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-market-ink/60">خصم بالنسبة (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    setDiscountPercent(pct);
                    setDiscountAmount(Math.round((pct / 100) * totals.totalAmount));
                  }}
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-center font-black outline-none focus:border-leaf-500"
                />
              </div>
            </div>
            {effectiveDiscount > 0 ? (
              <p className="rounded-2xl bg-orange-50 px-3 py-2 text-center text-sm font-bold text-orange-700">
                السعر بعد الخصم: {formatCurrency(finalAmount)}
              </p>
            ) : null}
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
                <button className="ios-chip ios-chip-active min-h-10 px-2" onClick={() => setPaidAmount(finalAmount)}>
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

          <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl border border-black/5 bg-white/40 dark:border-white/5 dark:bg-white/[0.02] select-none">
            <span className="text-xs font-black text-market-ink/75 dark:text-white/80 flex items-center gap-1.5">
              <Printer className="h-4 w-4 text-leaf-600 dark:text-leaf-400" />
              طباعة التذكرة تلقائياً
            </span>
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
              className="h-4.5 w-4.5 rounded border-black/10 text-leaf-600 focus:ring-leaf-500 accent-leaf-600 cursor-pointer"
            />
          </div>

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
