"use client";

import { useEffect } from "react";
import { AppIntro } from "@/components/layout/app-intro";
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
  useEffect(() => {
    const selector =
      "button, a.btn, a.nav-link, a.ios-chip, a.ios-circle-button, a.ios-bottom-link, a.ios-card, [role='button']";

    const triggerPop = (target: HTMLElement) => {
      target.classList.remove("bubble-pop-press");
      void target.offsetWidth;
      target.classList.add("bubble-pop-press");
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
      if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") {
        return;
      }

      const bounds = target.getBoundingClientRect();
      target.style.setProperty("--bubble-x", `${event.clientX - bounds.left}px`);
      target.style.setProperty("--bubble-y", `${event.clientY - bounds.top}px`);
      triggerPop(target);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
      if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") {
        return;
      }

      target.style.setProperty("--bubble-x", "50%");
      target.style.setProperty("--bubble-y", "50%");
      triggerPop(target);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <PwaRegistrar />
          <ButtonPressFeedback />
          <AppIntro />
          {children}
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
