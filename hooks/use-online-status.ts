"use client";

import { useEffect, useState } from "react";

const INTERNET_CHECK_URL = "https://www.gstatic.com/generate_204";
const CHECK_INTERVAL_MS = 15000;
const CHECK_TIMEOUT_MS = 3000;

async function canReachInternet() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    await fetch(`${INTERNET_CHECK_URL}?t=${Date.now()}`, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let active = true;

    const updateStatus = async () => {
      const next = await canReachInternet();
      if (active) {
        setIsOnline(next);
      }
    };

    const handleOnline = () => {
      updateStatus();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        updateStatus();
      }
    };

    updateStatus();
    const interval = window.setInterval(updateStatus, CHECK_INTERVAL_MS);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return isOnline;
}
