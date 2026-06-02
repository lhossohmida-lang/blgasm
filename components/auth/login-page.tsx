"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";

export function LoginPage() {
  const { login, reset } = useAuth();
  const { notify } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      notify({
        tone: "error",
        title: "تعذر تسجيل الدخول",
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
    <main className="min-h-screen overflow-hidden px-5 pb-8 pt-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] flex-col justify-end lg:max-w-6xl lg:grid lg:grid-cols-[1fr_470px] lg:items-center lg:gap-10">
        <section className="hidden lg:block">
          <img src="/storefront.svg" alt="متجر بلقاسم" className="mx-auto h-64 w-64 rounded-[42px] bg-white p-4 shadow-glass" />
          <h1 className="mt-8 text-center text-6xl font-black text-leaf-700">بلقاسم</h1>
          <p className="mt-4 text-center text-3xl font-black">إدارة متجرك بسهولة</p>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-9 text-market-ink/65">
            حل متكامل لإدارة المبيعات، المخزون، العملاء والكريدي من الهاتف والحاسوب.
          </p>
        </section>

        <section className="relative">
          <div className="pointer-events-none absolute inset-x-8 -top-48 h-72 rounded-full bg-leaf-100/70 blur-3xl lg:hidden" />
          <div className="relative mb-8 text-center lg:hidden">
            <img src="/storefront.svg" alt="متجر بلقاسم" className="mx-auto h-24 w-24 rounded-[28px] bg-white p-1 shadow-soft" />
            <h1 className="mt-7 text-5xl font-black text-leaf-700">بلقاسم</h1>
            <p className="mt-4 text-3xl font-black">إدارة متجرك بسهولة</p>
            <p className="mt-4 text-base leading-8 text-market-ink/65">حل متكامل لإدارة المبيعات، المخزون والعملاء</p>
          </div>

          <div className="ios-card p-5">
            <form className="space-y-4" onSubmit={submit}>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-4 top-[42px] h-5 w-5 text-leaf-700" />
                <Input
                  label="البريد الإلكتروني"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ahmed@example.com"
                  className="pr-12"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="pointer-events-none absolute right-4 top-[42px] h-5 w-5 text-leaf-700" />
                <EyeOff className="pointer-events-none absolute left-4 top-[42px] h-5 w-5 text-leaf-700" />
                <Input
                  label="كلمة المرور"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="كلمة المرور"
                  className="px-12"
                  minLength={6}
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-3 text-sm font-bold">
                <button type="button" className="text-leaf-700" onClick={handleReset}>
                  نسيت كلمة المرور؟
                </button>
                <label className="flex items-center gap-2 text-market-ink/70">
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    className="h-5 w-5 rounded border-black/10 accent-leaf-600"
                  />
                  تذكرني
                </label>
              </div>

              <Button className="h-16 w-full rounded-3xl text-xl" loading={loading}>
                تسجيل الدخول
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs leading-6 text-market-ink/55">
            بالتسجيل، أنت توافق على الشروط والأحكام وسياسة الخصوصية
          </p>
        </section>
      </div>
    </main>
  );
}
