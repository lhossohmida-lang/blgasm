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
  const { findProductByCode } = useStore();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>("manual");
  const [qrCode, setQrCode] = useState("");
  const [imageLoading, setImageLoading] = useState(false);

  const existing = useMemo(() => (qrCode ? findProductByCode(qrCode) : undefined), [findProductByCode, qrCode]);

  function handleScan(code: string) {
    setQrCode(code.trim());
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
          <h1 className="ios-title">إضافة منتج</h1>
        </div>
        <button className="ios-circle-button" title="رجوع" onClick={() => history.back()}>
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>

      <div className="mb-6 hidden lg:block">
        <h1 className="text-3xl font-black">إضافة منتج</h1>
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
              <div className="space-y-3">
                <Input
                  label="كتابة QR Code"
                  value={qrCode}
                  onChange={(event) => setQrCode(event.target.value)}
                  placeholder="أدخل أو الصق الكود"
                />
                <Button type="button" onClick={() => setQrCode(qrCode.trim())}>
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
              <div className="mt-5 rounded-3xl border border-leaf-200 bg-leaf-50 p-4 text-leaf-800">
                <p className="font-black">المنتج موجود في المخزون</p>
                <p className="mt-1 text-sm">
                  {existing.name} - الكمية {formatNumber(existing.quantity)} - السعر {formatCurrency(existing.sellPrice)}
                </p>
              </div>
            ) : qrCode ? (
              <div className="mt-5 rounded-3xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
                <p className="font-black">المنتج غير موجود</p>
                <p className="mt-1 text-sm">يمكنك إنشاء منتج جديد بهذا الكود.</p>
              </div>
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
