import { useEffect, useRef, useState } from "react";

/**
 * Hook لمراقبة حالة الاتصال بالإنترنت.
 *
 * يعيد:
 *   isOnline   — هل الجهاز متصل الآن؟
 *   wasOffline — هل كان منقطعاً ثم عاد؟ (تُستخدم لتشغيل المزامنة التلقائية)
 *   clearWasOffline — امسح علامة "عاد من الأوفلاين"
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const wasOnlineRef = useRef(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      // إذا كان قبلها أوفلاين، فهذه عودة حقيقية للإنترنت
      if (!wasOnlineRef.current) {
        setWasOffline(true);
      }
      wasOnlineRef.current = true;
    }

    function handleOffline() {
      setIsOnline(false);
      wasOnlineRef.current = false;
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function clearWasOffline() {
    setWasOffline(false);
  }

  return { isOnline, wasOffline, clearWasOffline };
}
