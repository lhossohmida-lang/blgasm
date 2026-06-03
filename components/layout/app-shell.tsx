"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Zap,
  Tag,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { LoginPage } from "@/components/auth/login-page";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/providers/toast-provider";

const desktopNav = [
  { href: "/dashboard", label: "لوحة التحكم", icon: Home },
  { href: "/inventory", label: "المخزون", icon: Boxes },
  { href: "/products/new", label: "شراء", icon: PackagePlus },
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
  { href: "/ai", label: "الذكاء", icon: Bot },
];


export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { data, loading: storeLoading, isOnline, pendingSyncCount, syncNow } = useStore();
  const [shortcutProductIds, setShortcutProductIds] = useState<string[]>([]);

  useEffect(() => {
    function readShortcutProductIds() {
      if (typeof window === "undefined") return [] as string[];
      try {
        const stored = window.localStorage.getItem("blgasm-inventory-shortcuts");
        if (!stored) return [] as string[];
        const parsed = JSON.parse(stored) as string[];
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [] as string[];
      }
    }

    function refreshShortcuts() {
      setShortcutProductIds(readShortcutProductIds());
    }

    refreshShortcuts();
    window.addEventListener("blgasm-shortcuts-updated", refreshShortcuts);
    window.addEventListener("storage", refreshShortcuts);
    return () => {
      window.removeEventListener("blgasm-shortcuts-updated", refreshShortcuts);
      window.removeEventListener("storage", refreshShortcuts);
    };
  }, []);

  const shortcutProducts = useMemo(
    () => shortcutProductIds.map((id) => data?.products.find((p) => p.id === id)).filter(Boolean),
    [shortcutProductIds, data?.products],
  );

  const slots = useMemo(() => {
    return Array.from({ length: 9 }).map((_, index) => {
      return shortcutProducts[index] || null;
    });
  }, [shortcutProducts]);
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

  // Lock screen removed — dashboard-level auth only now


  if (storeLoading || !data) {
    return <LoadingState label="جاري تحميل بيانات المتجر..." />;
  }


  return (
    <div className="min-h-screen">
      <aside className="desktop-sidebar no-print fixed inset-y-0 right-0 z-30 hidden w-72 p-5 text-white shadow-2xl lg:flex lg:flex-col justify-between">
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4">
          <Link href="/dashboard" className="flex items-center gap-3">
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

          {/* 9-Slot Shortcuts Grid */}
          <div className="space-y-2 pt-4 border-t border-white/10">
            <p className="text-xs font-black text-white/50 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-orange-400" />
              الاختصارات السريعة (3×3)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((product, index) => {
                if (product) {
                  return (
                    <button
                      key={product.id || index}
                      type="button"
                      onClick={() => {
                        if (pathname === "/pos") {
                          window.dispatchEvent(new CustomEvent("blgasm-add-to-cart", { detail: { code: product.qrCode } }));
                        } else {
                          window.localStorage.setItem("blgasm-pending-add", product.qrCode);
                          router.push("/pos");
                        }
                      }}
                      className="aspect-square flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/10 hover:bg-white/20 transition p-1 text-center"
                      title={product.name}
                    >
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-6 w-6 object-contain rounded-lg" />
                      ) : (
                        <div className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/15 text-white/80">
                          <Tag className="h-3.5 w-3.5 text-white/70" />
                        </div>
                      )}
                      <p className="mt-1 line-clamp-1 text-[9px] font-black text-white/90 w-full px-0.5 leading-none">{product.name}</p>
                    </button>
                  );
                }
                return (
                  <div
                    key={`empty-${index}`}
                    className="aspect-square rounded-2xl border border-dashed border-white/15 bg-white/[0.03] flex items-center justify-center text-white/30 text-[9px] font-bold"
                  >
                    فارغ
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 space-y-2 border-t border-white/10">
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
