"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Camera, ChevronLeft, CloudUpload, Monitor, QrCode, Search } from "lucide-react";
import { ProductForm } from "@/components/products/product-form";
import { QrCameraScanner } from "@/components/scanner/qr-camera-scanner";
import { KeyboardScanner } from "@/components/scanner/keyboard-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { decodeQrImageViaCloud } from "@/lib/qr/cloud";
import { formatCurrency, formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

type Mode = "manual" | "image" | "scanner" | "camera";

const modes = [
  { id: "manual" as const, label: "كتابة QR", icon: QrCode },
  { id: "image" as const, label: "من صورة", icon: Camera },
  { id: "scanner" as const, label: "ماسح الحاسوب", icon: Monitor },
];

export default function NewProductPage() {
  const { findProductByCode, upsertProduct, data } = useStore();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>("manual");
  const [qrCode, setQrCode] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [restockAmount, setRestockAmount] = useState<Record<string, string>>({});

  const existing = useMemo(() => {
    if (!qrCode) return undefined;
    const clean = qrCode.trim().toLowerCase();
    const byCode = findProductByCode(clean);
    if (byCode) return byCode;
    // Find by exact name match
    return (data?.products ?? []).find((p) => p.name.toLowerCase() === clean);
  }, [findProductByCode, qrCode, data?.products]);

  const manualSuggestions = useMemo(() => {
    if (!qrCode) return [];
    const clean = qrCode.trim().toLowerCase();
    if (findProductByCode(clean)) return [];
    if ((data?.products ?? []).some((p) => p.name.toLowerCase() === clean)) return [];
    return (data?.products ?? [])
      .filter((p) => p.name.toLowerCase().includes(clean) || p.qrCode.toLowerCase().includes(clean))
      .slice(0, 5);
  }, [qrCode, findProductByCode, data?.products]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return (data?.products ?? []).filter(
      (p) => p.name.toLowerCase().includes(q) || p.qrCode.includes(q)
    ).slice(0, 5);
  }, [searchQuery, data?.products]);

  function handleScan(code: string) {
    setQrCode(code.trim());
  }

  async function handleAddQuantity(product: any, amountStr: string) {
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      notify({ tone: "warning", title: "أدخل كمية صالحة أكبر من الصفر" });
      return;
    }
    try {
      const updated = {
        ...product,
        quantity: product.quantity + amount,
      };
      await upsertProduct(updated);
      notify({
        tone: "success",
        title: "تم إضافة الكمية بنجاح",
        body: `تم إضافة ${amount} إلى ${product.name}. الكمية الحالية: ${product.quantity + amount}`,
      });
      setRestockAmount((prev) => ({ ...prev, [product.id]: "" }));
    } catch (error) {
      notify({
        tone: "error",
        title: "تعذر تحديث الكمية",
        body: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImageLoading(true);
    try {
      const code = await decodeQrImageViaCloud(file);
      setQrCode(code);
      notify({ tone: "success", title: "تم استخراج QR من الصورة", body: code });
    } catch (error) {
      notify({
        tone: "error",
        title: "تعذر معالجة الصورة",
        body: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="" className="ios-avatar" />
        <div className="flex-1 pt-2">
          <h1 className="ios-title">شراء</h1>
        </div>
        <button className="ios-circle-button" title="رجوع" onClick={() => history.back()}>
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>

      <div className="mb-6 hidden lg:block">
        <h1 className="text-3xl font-black">شراء</h1>
        <p className="mt-1 text-market-ink/60">أدخل QR يدوياً، من صورة، أو من ماسح متصل بالحاسوب.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <section className="space-y-5">
          <div className="ios-card">
            <h2 className="mb-4 text-center text-xl font-black">طرق إضافة المنتج</h2>
            <div className="grid grid-cols-3 gap-3">
              {modes.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={cn(
                      "flex min-h-24 flex-col items-center justify-center gap-3 rounded-3xl border text-sm font-black transition",
                      mode === item.id
                        ? "border-leaf-600 bg-leaf-50 text-leaf-700"
                        : "border-black/10 bg-white/70 text-market-ink/75",
                    )}
                  >
                    <span className={item.id === "image" ? "ios-icon ios-icon-orange" : "ios-icon"}>
                      <Icon className="h-6 w-6" />
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ios-card">
            {mode === "manual" ? (
              <div className="space-y-3 relative">
                <Input
                  label="كتابة الباركود أو اسم المنتج"
                  value={qrCode}
                  onChange={(event) => setQrCode(event.target.value)}
                  placeholder="أدخل الكود أو ابحث باسم المنتج..."
                />

                {manualSuggestions.length > 0 ? (
                  <div className="absolute top-[76px] left-0 right-0 z-50 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#14211b]/95">
                    <div className="divide-y divide-black/5 dark:divide-white/5 max-h-48 overflow-y-auto">
                      {manualSuggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            setQrCode(product.qrCode);
                          }}
                          className="w-full text-right px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl flex items-center justify-between gap-3 text-xs font-bold transition"
                        >
                          <span className="text-market-ink dark:text-white">{product.name}</span>
                          <span className="text-[10px] text-market-ink/50 dark:text-white/50">{product.qrCode}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Button type="button" onClick={() => {
                  const trimmed = qrCode.trim();
                  if (manualSuggestions.length > 0) {
                    setQrCode(manualSuggestions[0].qrCode);
                  } else {
                    setQrCode(trimmed);
                  }
                }}>
                  <Search className="h-4 w-4" />
                  بحث عن المنتج
                </Button>
              </div>
            ) : null}

            {mode === "image" ? (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-white/55 p-8 text-center">
                <CloudUpload className="mx-auto h-12 w-12 text-market-ink/45" />
                <p className="mt-4 text-lg font-black">اختر صورة تحتوي على QR Code</p>
                <p className="mt-2 text-sm text-market-ink/55">PNG, JPG بحجم أقل من 5MB</p>
                <label className="btn btn-secondary mt-5 cursor-pointer">
                  اختر صورة
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImage} />
                </label>
                {imageLoading ? <p className="mt-3 text-sm font-bold text-leaf-700">جاري معالجة الصورة...</p> : null}
              </div>
            ) : null}

            {mode === "scanner" ? <KeyboardScanner onScan={handleScan} /> : null}

            {mode === "camera" ? <QrCameraScanner onScan={handleScan} /> : null}

            <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => setMode("camera")}>
              <Camera className="h-4 w-4" />
              فتح الكاميرا
            </Button>

            {existing ? (
              <div className="mt-5 rounded-3xl border border-leaf-200 bg-leaf-50 p-4 text-leaf-800 space-y-3">
                <div>
                  <p className="font-black">المنتج موجود في المخزون</p>
                  <p className="mt-1 text-sm">
                    {existing.name} - الكمية {formatNumber(existing.quantity)} - السعر {formatCurrency(existing.sellPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-leaf-200">
                  <input
                    type="number"
                    min="1"
                    placeholder="إضافة كمية..."
                    value={restockAmount[existing.id] ?? ""}
                    onChange={(e) => setRestockAmount((prev) => ({ ...prev, [existing.id]: e.target.value }))}
                    className="w-24 px-3 py-1.5 rounded-xl border border-leaf-300 text-center font-black text-black text-sm bg-white"
                  />
                  <Button
                    type="button"
                    onClick={() => handleAddQuantity(existing, restockAmount[existing.id] ?? "")}
                    className="flex-1 min-h-9 py-1 px-3 bg-leaf-600 hover:bg-leaf-700 text-white rounded-xl text-xs font-black border-none"
                  >
                    إضافة كمية
                  </Button>
                </div>
              </div>
            ) : qrCode ? (
              <div className="mt-5 rounded-3xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
                <p className="font-black">المنتج غير موجود</p>
                <p className="mt-1 text-sm">يمكنك إنشاء منتج جديد بهذا الكود.</p>
              </div>
            ) : null}
          </div>

          {/* New Panel: Add quantity to a previous/existing product */}
          <div className="ios-card space-y-4">
            <h2 className="text-lg font-black text-market-ink/75">إضافة كمية لمنتوج سابق</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-market-ink/45" />
              <input
                type="text"
                placeholder="ابحث عن منتج بالاسم أو الباركود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white/80 pl-11 pr-4 py-3 text-sm text-market-ink outline-none placeholder:text-market-ink/42 focus:border-leaf-500"
              />
            </div>
            {searchResults.length > 0 ? (
              <div className="divide-y divide-black/5 max-h-64 overflow-y-auto pr-1">
                {searchResults.map((product) => (
                  <div key={product.id} className="py-3 flex items-center justify-between gap-3 text-right">
                    <div>
                      <p className="font-black text-sm">{product.name}</p>
                      <p className="text-xs text-market-ink/50">الكمية الحالية: {formatNumber(product.quantity)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="الكمية"
                        value={restockAmount[product.id] ?? ""}
                        onChange={(e) => setRestockAmount((prev) => ({ ...prev, [product.id]: e.target.value }))}
                        className="w-16 px-2 py-1.5 rounded-xl border border-black/10 text-center font-black text-sm bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddQuantity(product, restockAmount[product.id] ?? "")}
                        className="px-3 py-1.5 bg-leaf-600 hover:bg-leaf-700 text-white rounded-xl text-xs font-black"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <p className="text-xs text-market-ink/45 text-center">لا توجد نتائج مطابقة</p>
            ) : null}
          </div>
        </section>

        <section>
          <ProductForm product={existing} qrCode={qrCode} onSaved={(product) => setQrCode(product.qrCode)} />
        </section>
      </div>
    </div>
  );
}
