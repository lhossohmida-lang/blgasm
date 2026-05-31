"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  listenToAuth,
  loginWithEmail,
  logout as firebaseLogout,
  registerWithEmail,
  resetPassword,
} from "@/lib/firebase/auth";
import { enableFirebaseOfflinePersistence } from "@/lib/firebase/firebase";
import { useToast } from "@/components/providers/toast-provider";

export interface AppUser {
  uid: string;
  email: string;
  isDemo: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  reset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  enterDemoMode: () => void;
}

const DEMO_USER: AppUser = {
  uid: "local-demo-store",
  email: "demo@blgasm.local",
  isDemo: true,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email ?? "merchant@blgasm.local",
    isDemo: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    const fallback = window.setTimeout(() => {
      if (!settled) {
        setLoading(false);
      }
    }, 1500);

    enableFirebaseOfflinePersistence();
    const demoEnabled = window.localStorage.getItem("blgasm-demo-mode") === "1";
    if (demoEnabled) {
      settled = true;
      window.clearTimeout(fallback);
      setUser(DEMO_USER);
      setLoading(false);
      return () => undefined;
    }

    const unsubscribe = listenToAuth((firebaseUser) => {
      settled = true;
      window.clearTimeout(fallback);
      setUser(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginWithEmail(email, password);
      window.localStorage.removeItem("blgasm-demo-mode");
      notify({ tone: "success", title: "تم تسجيل الدخول بنجاح" });
    },
    [notify],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await registerWithEmail(email, password);
      window.localStorage.removeItem("blgasm-demo-mode");
      notify({ tone: "success", title: "تم إنشاء الحساب" });
    },
    [notify],
  );

  const reset = useCallback(
    async (email: string) => {
      await resetPassword(email);
      notify({ tone: "info", title: "أرسلنا رابط إعادة التعيين", body: "تحقق من بريدك الإلكتروني." });
    },
    [notify],
  );

  const logout = useCallback(async () => {
    window.localStorage.removeItem("blgasm-demo-mode");
    if (!user?.isDemo) {
      await firebaseLogout();
    }
    setUser(null);
    notify({ tone: "info", title: "تم تسجيل الخروج" });
  }, [notify, user?.isDemo]);

  const enterDemoMode = useCallback(() => {
    window.localStorage.setItem("blgasm-demo-mode", "1");
    setUser(DEMO_USER);
    setLoading(false);
    notify({
      tone: "info",
      title: "تم فتح التجربة المحلية",
      body: "كل البيانات ستبقى داخل هذا الجهاز.",
    });
  }, [notify]);

  const value = useMemo(
    () => ({ user, loading, login, register, reset, logout, enterDemoMode }),
    [enterDemoMode, loading, login, logout, register, reset, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
