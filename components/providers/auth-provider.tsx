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
import { useToast } from "@/components/providers/toast-provider";

export interface AppUser {
  uid: string;
  email: string;
  isDemo: boolean;
  isVerified: boolean; // true only when Firebase Auth has confirmed the session
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
  isVerified: false,
};
const REMEMBERED_USER_KEY = "blgasm-remembered-user";
const SAVED_EMAIL_KEY = "blgasm-saved-email";

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email ?? "merchant@blgasm.local",
    isDemo: false,
    isVerified: true, // confirmed by Firebase Auth
  };
}

function readRememberedUser() {
  try {
    const value = window.localStorage.getItem(REMEMBERED_USER_KEY);
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as Partial<AppUser>;
    if (!parsed.uid || !parsed.email) {
      return null;
    }

    return {
      uid: parsed.uid,
      email: parsed.email,
      isDemo: false,
      isVerified: false, // NOT verified — just from localStorage cache
    } satisfies AppUser;
  } catch {
    return null;
  }
}

function rememberUser(user: AppUser) {
  window.localStorage.setItem(REMEMBERED_USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(SAVED_EMAIL_KEY, user.email);
}

function forgetRememberedUser() {
  window.localStorage.removeItem(REMEMBERED_USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    const rememberedUser = readRememberedUser();

    if (rememberedUser) {
      setUser(rememberedUser);
      setLoading(false);
    }

    const fallback = window.setTimeout(() => {
      if (!settled) {
        if (rememberedUser) {
          setUser(rememberedUser);
        }
        setLoading(false);
      }
    }, 1500);

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
      if (firebaseUser) {
        const appUser = mapFirebaseUser(firebaseUser);
        rememberUser(appUser);
        setUser(appUser);
      } else if (rememberedUser) {
        setUser(rememberedUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const credential = await loginWithEmail(email, password);
      const appUser = mapFirebaseUser(credential.user);
      rememberUser(appUser);
      window.localStorage.removeItem("blgasm-demo-mode");
      setUser(appUser);
      notify({ tone: "success", title: "تم تسجيل الدخول بنجاح" });
    },
    [notify],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const credential = await registerWithEmail(email, password);
      const appUser = mapFirebaseUser(credential.user);
      rememberUser(appUser);
      window.localStorage.removeItem("blgasm-demo-mode");
      setUser(appUser);
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
    forgetRememberedUser();
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
