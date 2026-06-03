"use client";

import { useState, useCallback } from "react";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";

export const DASHBOARD_PIN = "111234";

export function PinGate({
  title = "هذه الصفحة محمية",
  onUnlock,
}: {
  title?: string;
  onUnlock: () => void;
}) {
  const { notify } = useToast();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setTimeout(() => {
        if (pin === DASHBOARD_PIN) {
          onUnlock();
        } else {
          setShakeKey((k) => k + 1);
          setPin("");
          notify({ tone: "error", title: "رمز الدخول غير صحيح", body: "حاول مرة أخرى." });
        }
        setLoading(false);
      }, 350);
    },
    [notify, onUnlock, pin],
  );

  return (
    <div className="flex min-h-[65vh] items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-[28px] border border-black/5 bg-white p-8 shadow-2xl dark:border-white/10 dark:bg-market-ink">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf-100 text-leaf-600 dark:bg-leaf-900/40 dark:text-leaf-300">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="text-sm text-market-ink/60 dark:text-white/60">أدخل رمز الدخول للمتابعة</p>
        </div>

        <form key={shakeKey} onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="رمز الدخول"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••"
            autoFocus
            required
          />
          <Button
            className="h-12 w-full rounded-2xl bg-leaf-600 text-white hover:bg-leaf-500 border-none font-black"
            loading={loading}
          >
            دخول
          </Button>
        </form>
      </div>
    </div>
  );
}
