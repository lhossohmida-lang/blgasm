"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Square } from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";

export function QrCameraScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [active, setActive] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  async function start() {
    if (!videoRef.current) {
      return;
    }

    try {
      const reader = new BrowserMultiFormatReader();
      setActive(true);
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        const text = result?.getText();
        if (text) {
          onScan(text);
          notify({ tone: "success", title: "تمت قراءة QR بنجاح", body: text });
          controlsRef.current?.stop();
          setActive(false);
        }
      });
    } catch (error) {
      setActive(false);
      notify({
        tone: "error",
        title: "تعذر فتح الكاميرا",
        body: error instanceof Error ? error.message : "تحقق من صلاحيات الكاميرا.",
      });
    }
  }

  function stop() {
    controlsRef.current?.stop();
    setActive(false);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-black/10 bg-black dark:border-white/10">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={start} disabled={active}>
          <Camera className="h-4 w-4" />
          فتح الكاميرا
        </Button>
        <Button type="button" variant="secondary" onClick={stop} disabled={!active}>
          <Square className="h-4 w-4" />
          إيقاف
        </Button>
      </div>
    </div>
  );
}
