/**
 * أدوات حساب وعرض حالة انتهاء صلاحية المنتجات.
 */

/**
 * احسب حالة الصلاحية بناءً على التاريخ.
 *
 * @param {string|null} expiryDate — تاريخ الانتهاء بصيغة YYYY-MM-DD
 * @returns {object|null} — null إذا لم يوجد تاريخ، وإلا كائن يحتوي على:
 *   status: "normal" | "warning" | "critical" | "expired"
 *   label: نص وصفي بالعربية
 *   daysRemaining: عدد الأيام المتبقية (سالب إذا انتهى)
 *   color: Tailwind text class
 *   bgColor: Tailwind bg+border classes
 *   badgeClass: Tailwind full badge classes
 */
export function getExpiryStatus(expiryDate) {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffMs = expiry - today;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return {
      status: "expired",
      label: days === 1 ? "منتهي منذ يوم" : `منتهي منذ ${days} أيام`,
      daysRemaining,
      color: "text-red-800",
      bgColor: "bg-red-100 border-red-400",
      badgeClass: "inline-flex items-center gap-1 rounded-full border bg-red-100 border-red-400 px-2 py-0.5 text-xs font-black text-red-800",
    };
  }

  if (daysRemaining === 0) {
    return {
      status: "critical",
      label: "ينتهي اليوم!",
      daysRemaining: 0,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-300",
      badgeClass: "inline-flex items-center gap-1 rounded-full border bg-red-50 border-red-300 px-2 py-0.5 text-xs font-black text-red-600",
    };
  }

  if (daysRemaining <= 7) {
    return {
      status: "critical",
      label: daysRemaining === 1 ? "ينتهي غداً" : `ينتهي بعد ${daysRemaining} أيام`,
      daysRemaining,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-300",
      badgeClass: "inline-flex items-center gap-1 rounded-full border bg-red-50 border-red-300 px-2 py-0.5 text-xs font-black text-red-600",
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: "warning",
      label: `ينتهي بعد ${daysRemaining} يوماً`,
      daysRemaining,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-300",
      badgeClass: "inline-flex items-center gap-1 rounded-full border bg-orange-50 border-orange-300 px-2 py-0.5 text-xs font-bold text-orange-700",
    };
  }

  return {
    status: "normal",
    label: `ينتهي بعد ${daysRemaining} يوماً`,
    daysRemaining,
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    badgeClass: "inline-flex items-center gap-1 rounded-full border bg-green-50 border-green-200 px-2 py-0.5 text-xs font-bold text-green-700",
  };
}

/** تنسيق التاريخ بالعربية */
export function formatExpiryDate(expiryDate) {
  if (!expiryDate) return null;
  try {
    return new Date(expiryDate).toLocaleDateString("ar-DZ-u-nu-latn", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return expiryDate;
  }
}

/** احصل على عدد الأيام المتبقية كرقم */
export function getDaysRemaining(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

/** فلتر المنتجات حسب حالة الصلاحية */
export function filterByExpiryStatus(products, filter) {
  if (filter === "all" || !filter) return products;

  return products.filter((p) => {
    if (!p.expiryDate && filter !== "no-expiry") return filter === "all";
    const s = getExpiryStatus(p.expiryDate);
    if (!s && filter === "no-expiry") return true;
    if (!s) return false;

    switch (filter) {
      case "normal": return s.status === "normal";
      case "warning": return s.status === "warning";
      case "critical": return s.status === "critical";
      case "expired": return s.status === "expired";
      case "expiring-month": return s.status === "warning" || s.status === "critical";
      case "expiring-week": return s.status === "critical" && s.daysRemaining >= 0;
      default: return true;
    }
  });
}

/** ترتيب المنتجات حسب الأقرب انتهاءً */
export function sortByExpiry(products, direction = "asc") {
  return [...products].sort((a, b) => {
    const da = getDaysRemaining(a.expiryDate);
    const db = getDaysRemaining(b.expiryDate);

    // المنتجات بدون تاريخ: في النهاية دائماً
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;

    return direction === "asc" ? da - db : db - da;
  });
}

/** احصل على إحصائيات الصلاحية من قائمة منتجات */
export function getExpirySummary(products) {
  const withExpiry = products.filter((p) => p.expiryDate);
  const expired = withExpiry.filter((p) => (getDaysRemaining(p.expiryDate) ?? 1) < 0);
  const critical = withExpiry.filter((p) => {
    const d = getDaysRemaining(p.expiryDate);
    return d !== null && d >= 0 && d <= 7;
  });
  const warning = withExpiry.filter((p) => {
    const d = getDaysRemaining(p.expiryDate);
    return d !== null && d > 7 && d <= 30;
  });
  return { expired: expired.length, critical: critical.length, warning: warning.length };
}
