"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Radar, Usb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/toast-provider";
import { tryHardwareScannerDiscovery } from "@/lib/qr/cloud";

const SCANNER_TIMEOUT_MS = 6000;

export function KeyboardScanner({ onScan }: { onScan: (code: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [value, setValue] = useState("");
  const [testing, setTesting] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function consume(code: string) {
    const normalized = code.trim();
    if (!normalized) {
      return;
    }
    onScan(normalized);
    setValue("");
    setTesting(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    notify({ tone: "success", title: "تم استقبال قراءة من الماسح", body: normalized });
  }

  function testScanner() {
    setTesting(true);
    inputRef.current?.focus();
    notify({ tone: "info", title: "مرّر أي QR أمام الماسح الآن" });
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setTesting(false);
      notify({
        tone: "warning",
        title: "الماسح غير متصل أو لم يتم اكتشافه",
        body: "الرجاء توصيل ماسح QR بالحاسوب ثم المحاولة مرة أخرى.",
      });
    }, SCANNER_TIMEOUT_MS);
  }

  async function detectDevice() {
    const message = await tryHardwareScannerDiscovery();
    notify({ tone: "info", title: "فحص الجهاز", body: message });
  }

  return (
    <div className="space-y-3">
      <Input
        ref={inputRef}
        label="وضع الماسح"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            consume(value);
          }
        }}
        placeholder="الخانة جاهزة للقراءة من ماسح QR أو Barcode"
        helper={testing ? "بانتظار قراءة من الماسح..." : "الماسح المتصل بالحاسوب يعمل غالباً كأنه لوحة مفاتيح."}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => consume(value)}>
          <Keyboard className="h-4 w-4" />
          إدخال القراءة
        </Button>
        <Button type="button" variant="secondary" onClick={testScanner}>
          <Radar className="h-4 w-4" />
          اختبار اتصال الماسح
        </Button>
        <Button type="button" variant="secondary" onClick={detectDevice}>
          <Usb className="h-4 w-4" />
          WebUSB / WebHID
        </Button>
      </div>
    </div>
  );
}
