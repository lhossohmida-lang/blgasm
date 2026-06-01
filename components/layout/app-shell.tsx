"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bot,
  Box,
  Boxes,
  Home,
  LogOut,
  Moon,
  PackagePlus,
  RefreshCcw,
  Settings,
  ShoppingCart,
  Sun,
  UserRound,
  UsersRound,
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

const desktopNav = [
  { href: "/dashboard", label: "لوحة التحكم", icon: Home },
  { href: "/inventory", label: "المخزون", icon: Boxes },
  { href: "/products/new", label: "إدخال منتج جديد", icon: PackagePlus },
  { href: "/pos", label: "المبيعات", icon: ShoppingCart },
  { href: "/credits", label: "الكريديات", icon: UsersRound },
  { href: "/reports", label: "التقارير", icon: BarChart3 },
  { href: "/ai", label: "الذكاء الاصطناعي", icon: Bot },
];

const bottomNav = [
  { href: "/dashboard", label: "الرئيسية", icon: Home },
  { href: "/inventory", label: "المخزون", icon: Box },
  { href: "/pos", label: "البيع", icon: ShoppingCart },
  { href: "/credits", label: "الكريدي", icon: UserRound },
  { href: "/reports", label: "التقارير", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading, logout } = useAuth();
  const { data, loading: storeLoading, isOnline, pendingSyncCount, syncNow } = useStore();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("blgasm-theme");
    const shouldDark = stored ? stored === "dark" : false;
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
      <aside className="desktop-sidebar no-print fixed inset-y-0 right-0 z-30 hidden w-72 p-5 text-white shadow-2xl lg:block">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3">
          <img src="/blgasm-logo.png" alt="متجر بلقاسم" className="h-12 w-12 rounded-2xl border-2 border-white/70 bg-white" />
          <div>
            <p className="text-lg font-black">بلقاسم</p>
            <p className="text-xs text-white/55">مدير المتجر</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {desktopNav.map((item) => {
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

        <div className="absolute inset-x-5 bottom-5 space-y-2">
          <Button variant="secondary" className="w-full border-white/10 bg-white/10 text-white hover:bg-white/15" onClick={toggleTheme}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            تبديل الوضع
          </Button>
          <Button variant="secondary" className="w-full border-white/10 bg-white/10 text-white hover:bg-white/15" onClick={logout}>
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <div className="desktop-shell">
        <header className="no-print sticky top-0 z-20 hidden border-b border-black/5 bg-white/80 px-6 py-3 backdrop-blur-2xl dark:border-white/10 dark:bg-market-ink/80 lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/blgasm-logo.png" alt="" className="h-10 w-10 rounded-2xl border border-black/5 bg-white" />
              <div>
                <p className="font-black">{data.store.name}</p>
                <p className="text-xs text-market-ink/55 dark:text-white/55">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-soft",
                  isOnline
                    ? "bg-leaf-50 text-leaf-700 dark:bg-leaf-500/20 dark:text-leaf-50"
                    : "bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-50",
                )}
              >
                {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {isOnline ? "متزامن الآن" : "بدون إنترنت"}
              </div>
              {pendingSyncCount ? (
                <Button variant="secondary" onClick={syncNow} title="مزامنة الآن">
                  <RefreshCcw className="h-4 w-4" />
                  {pendingSyncCount}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={toggleTheme} title="تبديل الوضع">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="secondary" title="التنبيهات">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="secondary" title="الإعدادات">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <nav className="ios-bottom-nav no-print">
        {bottomNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("ios-bottom-link", active && "ios-bottom-link-active")}>
              <Icon className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
