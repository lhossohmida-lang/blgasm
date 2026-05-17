import { useCallback, useEffect, useRef, useState } from "react";
import { processSyncQueue } from "../lib/syncManager";
import { getPendingCount } from "../lib/syncQueueService";
import { useNetworkStatus } from "./useNetworkStatus";

/**
 * Hook رئيسي للمزامنة الأوفلاين.
 *
 * يعيد:
 *   isOnline      — حالة الاتصال
 *   pendingCount  — عدد العمليات المعلقة
 *   syncStatus    — "idle" | "syncing" | "synced" | "partial" | "error"
 *   lastSynced    — آخر وقت مزامنة ناجح (Date | null)
 *   notification  — رسالة مؤقتة للمستخدم (string | null)
 *   forceSync     — استدعِها يدوياً لتشغيل المزامنة فوراً
 */
export function useOfflineSync() {
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSynced, setLastSynced] = useState(null);
  const [notification, setNotification] = useState(null);
  const notifTimerRef = useRef(null);

  /* ── تحديث عداد العمليات المعلقة بشكل دوري ── */
  useEffect(() => {
    let mounted = true;

    async function refresh() {
      if (!mounted) return;
      const count = await getPendingCount();
      if (mounted) setPendingCount(count);
    }

    refresh();
    const interval = setInterval(refresh, 6000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  /* ── عرض إشعار مؤقت ── */
  const showNotification = useCallback((msg) => {
    setNotification(msg);
    clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 5000);
  }, []);

  /* ── تشغيل المزامنة ── */
  const forceSync = useCallback(async () => {
    if (!isOnline || syncStatus === "syncing") return;

    setSyncStatus("syncing");
    showNotification("جاري مزامنة البيانات...");

    await processSyncQueue((progress) => {
      if (progress.status === "synced") {
        setSyncStatus("synced");
        setLastSynced(new Date());
        setPendingCount(0);
        showNotification(
          progress.synced > 0
            ? `تمت مزامنة ${progress.synced} عملية بنجاح ✓`
            : "تمت مزامنة البيانات بنجاح ✓"
        );
      } else if (progress.status === "partial") {
        setSyncStatus("partial");
        showNotification(
          `تمت مزامنة ${progress.synced} عملية — فشلت ${progress.failed} (ستُعاد المحاولة)`
        );
      } else if (progress.status === "error") {
        setSyncStatus("error");
        showNotification("فشلت المزامنة. تحقق من الاتصال.");
      }
    });

    // تحديث العداد بعد المزامنة
    const remaining = await getPendingCount();
    setPendingCount(remaining);
  }, [isOnline, syncStatus, showNotification]);

  /* ── مزامنة تلقائية عند عودة الإنترنت ── */
  useEffect(() => {
    if (isOnline && wasOffline) {
      clearWasOffline();
      forceSync();
    }
  }, [isOnline, wasOffline, clearWasOffline, forceSync]);

  /* ── مزامنة عند بدء التطبيق (إذا كان هناك عمليات معلقة) ── */
  useEffect(() => {
    async function startupSync() {
      if (!navigator.onLine) return;
      const count = await getPendingCount();
      if (count > 0) {
        forceSync();
      }
    }
    // تأخير بسيط لإعطاء Firestore وقتاً للاتصال
    const timer = setTimeout(startupSync, 2500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isOnline,
    pendingCount,
    syncStatus,
    lastSynced,
    notification,
    forceSync,
  };
}
