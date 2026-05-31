"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LogIn, Mail, RefreshCcw, ShoppingBasket, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";

type Mode = "login" | "register";

export function LoginPage() {
  const { login, register, reset, enterDemoMode } = useAuth();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (error) {
      notify({
        tone: "error",
        title: mode === "login" ? "تعذر تسجيل الدخول" : "تعذر إنشاء الحساب",
        body: error instanceof Error ? error.message : "راجع البريد وكلمة المرور.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email) {
      notify({ tone: "warning", title: "أدخل البريد الإلكتروني أولاً" });
      return;
    }

    setLoading(true);
    try {
      await reset(email);
    } catch (error) {
      notify({
        tone: "error",
        title: "تعذر إرسال رابط الاسترجاع",
        body: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-lg border border-leaf-500/20 bg-white/65 px-3 py-2 text-sm font-bold text-leaf-700 shadow-soft dark:bg-white/10 dark:text-leaf-100">
            <ShoppingBasket className="h-4 w-4" />
            بلقاسم POS
          </div>
          <div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-market-ink dark:text-white sm:text-5xl">
              إدارة محل المواد الغذائية من الهاتف أو الحاسوب، حتى بدون إنترنت.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-market-ink/68 dark:text-white/68">
              مخزون، QR، بيع سالك، كريدي، تقارير أرباح، وتنبيهات ذكية في واجهة عربية سريعة.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Offline First", "QR Scanner", "Firebase Sync"].map((item) => (
              <div key={item} className="soft-panel rounded-lg px-4 py-3 text-sm font-bold">
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-leaf-600 p-3 text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}</h2>
              <p className="text-sm text-market-ink/58 dark:text-white/58">كل تاجر يرى بيانات متجره فقط.</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="merchant@example.com"
              required
            />
            <Input
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />

            <Button className="w-full" loading={loading}>
              {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {mode === "login" ? "دخول" : "إنشاء الحساب"}
            </Button>
          </form>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
            >
              {mode === "login" ? <UserPlus className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
              {mode === "login" ? "حساب جديد" : "لدي حساب"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset}>
              <Mail className="h-4 w-4" />
              نسيت كلمة المرور
            </Button>
          </div>

          <Button type="button" variant="ghost" className="mt-3 w-full" onClick={enterDemoMode}>
            <RefreshCcw className="h-4 w-4" />
            تجربة محلية بدون حساب
          </Button>
        </Card>
      </div>
    </main>
  );
}
