"use client";

import { useEffect } from "react";

const LAST_CLEAN_KEY = "blgasm-last-sync-clean";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calls the /api/admin/clean-sync-queue route at most once per day.
 * Replaces the Firebase scheduled Cloud Function — runs for free inside Next.js.
 */
export function useDailyCleanup() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const last = Number(window.localStorage.getItem(LAST_CLEAN_KEY) ?? "0");
    if (Date.now() - last < ONE_DAY_MS) return; // already ran today

    // Fire-and-forget — never blocks the UI
    fetch("/api/admin/clean-sync-queue", {
      method: "POST",
      headers: {
        "x-blgasm-token": process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "blgasm",
      },
    })
      .then((res) => {
        if (res.ok) {
          window.localStorage.setItem(LAST_CLEAN_KEY, String(Date.now()));
          console.debug("[cleanup] Sync queue cleaned");
        }
      })
      .catch(() => {
        // Silent — non-critical background task
      });
  }, []);
}
