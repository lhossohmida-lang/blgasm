"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Camera, FileImage, Keyboard, PackagePlus, ScanLine, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "@/components/products/product-form";
import { QrCameraScanner } from "@/components/scanner/qr-camera-scanner";
import { KeyboardScanner } from "@/components/scanner/keyboard-scanner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { decodeQrImageViaCloud } from "@/lib/qr/cloud";
import { cn } from "@/utils/cn";
import { formatCurrency, formatNumber } from "@/utils/format";

type Mode = "manual" | "camera" | "image" | "scanner";

const modes = [
  { id: "manual" as const, label: "يدوي", icon: Keyboard },
  { id: "camera" as const, label: "كاميرا", icon: Camera },
  { id: "image" as const, label: "صورة", icon: FileImage },
  { id: "scanner" as const, label: "ماسح", icon: ScanLine },
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
    <div>
      <PageHeader
        icon={PackagePlus}
        title="إدخال منتج جديد"
        description="إدخال QR يدوي، كاميرا، صورة عبر API، أو ماسح متصل بالحاسوب."
      />

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {modes.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-black transition",
                    mode === item.id
                      ? "border-leaf-600 bg-leaf-600 text-white dark:border-leaf-400 dark:bg-leaf-400 dark:text-market-ink"
                      : "border-black/10 bg-white/60 text-market-ink/66 hover:bg-white dark:border-white/10 dark:bg-white/7 dark:text-white/70 dark:hover:bg-white/12",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {mode === "manual" ? (
            <div className="space-y-3">
              <Input
                label="كتابة QR Code"
                value={qrCode}
                onChange={(event) => setQrCode(event.target.value)}
                placeholder="اكتب أو الصق الكود"
              />
              <Button type="button" onClick={() => setQrCode(qrCode.trim())}>
                <Search className="h-4 w-4" />
                بحث عن المنتج
              </Button>
            </div>
          ) : null}

          {mode === "camera" ? <QrCameraScanner onScan={handleScan} /> : null}

          {mode === "image" ? (
            <div className="space-y-3">
              <Input label="رفع صورة QR" type="file" accept="image/png,image/jpeg" onChange={handleImage} />
              <Button type="button" variant="secondary" loading={imageLoading}>
                <FileImage className="h-4 w-4" />
                معالجة الصورة
              </Button>
            </div>
          ) : null}

          {mode === "scanner" ? <KeyboardScanner onScan={handleScan} /> : null}

          {existing ? (
            <div className="mt-5 rounded-lg border border-leaf-500/20 bg-leaf-50/80 p-4 text-leaf-800 dark:bg-leaf-500/15 dark:text-leaf-50">
              <p className="font-black">المنتج موجود في المخزون</p>
              <p className="mt-1 text-sm">
                {existing.name} · الكمية {formatNumber(existing.quantity)} · السعر {formatCurrency(existing.sellPrice)}
              </p>
            </div>
          ) : qrCode ? (
            <div className="mt-5 rounded-lg border border-citrus-500/25 bg-citrus-100/70 p-4 text-amber-900 dark:bg-citrus-500/15 dark:text-citrus-100">
              <p className="font-black">المنتج غير موجود</p>
              <p className="mt-1 text-sm">يمكنك إنشاء منتج جديد بهذا الكود.</p>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState icon={ScanLine} title="بانتظار QR" body="اختر طريقة إدخال الكود لفتح نموذج المنتج." />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-black">{existing ? "تعديل بيانات المنتج" : "بيانات المنتج"}</h2>
          <ProductForm product={existing} qrCode={qrCode} onSaved={(product) => setQrCode(product.qrCode)} />
        </Card>
      </div>
    </div>
  );
}
