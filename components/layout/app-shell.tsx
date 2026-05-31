"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Boxes,
  ChartNoAxesCombined,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Moon,
  PackagePlus,
  ReceiptText,
  RefreshCcw,
  Sun,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LoginPage } from "@/components/auth/login-page";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/utils/cn";

const nav = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/inventory", label: "المخزون", icon: Boxes },
  { href: "/products/new", label: "إدخال منتج", icon: PackagePlus },
  { href: "/pos", label: "البيع", icon: ReceiptText },
  { href: "/credits", label: "الكريديات", icon: CircleDollarSign },
  { href: "/reports", label: "التقارير", icon: ChartNoAxesCombined },
  { href: "/ai", label: "الذكاء الاصطناعي", icon: Bot },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading, logout } = useAuth();
  const { data, loading: storeLoading, isOnline, pendingSyncCount, syncNow } = useStore();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("blgasm-theme");
    const shouldDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(shouldDark);
    document.documentElement.classList.toggle("dark", shouldDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    window.localStorage.setItem("blgasm-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  if (authLoading) {
    return <LoadingState label="جاري تجهيز التطبيق..." />;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (storeLoading || !data) {
    return <LoadingState label="جاري تحميل بيانات المتجر..." />;
  }

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 right-0 z-30 hidden w-72 border-l border-black/5 bg-white/70 p-4 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-market-ink/72 lg:block">
        <Link href="/dashboard" className="mb-6 flex items-center gap-3 rounded-lg px-2 py-3">
          <div className="rounded-lg bg-leaf-600 p-2 text-white">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-black">بلقاسم POS</p>
            <p className="text-xs text-market-ink/55 dark:text-white/55">{data.store.name}</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("nav-link", active && "nav-link-active")}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pr-72">
        <header className="no-print sticky top-0 z-20 border-b border-black/5 bg-white/62 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-market-ink/64">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold",
                  isOnline
                    ? "bg-leaf-100 text-leaf-700 dark:bg-leaf-500/20 dark:text-leaf-50"
                    : "bg-citrus-100 text-amber-900 dark:bg-citrus-500/20 dark:text-citrus-100",
                )}
              >
                {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {isOnline ? "متصل" : "أنت تعمل بدون إنترنت"}
              </div>
              {pendingSyncCount ? (
                <Button variant="secondary" onClick={syncNow} title="مزامنة الآن">
                  <RefreshCcw className="h-4 w-4" />
                  {pendingSyncCount}
                </Button>
              ) : null}
            </div>

            <nav className="flex gap-1 overflow-x-auto lg:hidden">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "rounded-lg p-2 text-market-ink/65 transition hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10",
                      active && "bg-leaf-600 text-white dark:bg-leaf-500 dark:text-market-ink",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={toggleTheme} title="تبديل الوضع">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="secondary" onClick={logout} title="تسجيل الخروج">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">خروج</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
