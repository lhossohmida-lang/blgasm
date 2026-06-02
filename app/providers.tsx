"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/components/providers/auth-provider";
import { StoreProvider } from "@/components/providers/store-provider";
import { ToastProvider } from "@/components/providers/toast-provider";

function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (!cancelled && process.env.NODE_ENV === "development") {
          registration.update().catch(() => undefined);
        }
      } catch (error) {
        console.info("Service worker registration skipped:", error);
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}

function ButtonPressFeedback() {
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <PwaRegistrar />
          <ButtonPressFeedback />
          {children}
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
