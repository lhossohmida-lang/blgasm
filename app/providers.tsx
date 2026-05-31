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

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.info("Service worker registration skipped:", error);
      });
    }
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <PwaRegistrar />
          {children}
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
