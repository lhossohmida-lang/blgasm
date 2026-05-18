/**
 * weightUtils.js
 * أدوات مساعدة للمنتجات الوزنية (تُخزَّن بالكيلوغرام، تُباع بالغرام)
 */

/** تحويل كيلوغرام إلى غرام */
export function kgToGrams(kg) {
  return Math.round(Number(kg || 0) * 1000);
}

/** تحويل غرام إلى كيلوغرام */
export function gramsToKg(grams) {
  return Number(grams || 0) / 1000;
}

/** عرض الوزن: كغ إذا >= 1000 غ، وإلا غرام */
export function formatWeight(grams) {
  const g = Number(grams || 0);
  if (g === 0) return "0 غ";
  if (g >= 1000) {
    const kg = g / 1000;
    return `${kg % 1 === 0 ? kg : kg.toFixed(2)} كغ`;
  }
  return `${g} غ`;
}

/** حساب سعر وزن محدد (غرام) بناءً على سعر الكيلوغرام */
export function calcWeightPrice(pricePerKg, grams) {
  return (Number(pricePerKg || 0) * Number(grams || 0)) / 1000;
}

/** هل المخزون يكفي للكمية المطلوبة بالغرام؟ */
export function isStockSufficient(product, requestedGrams) {
  if (!product.isWeightBased) return Number(product.quantity || 0) > 0;
  return Number(product.stockInGrams || 0) >= Number(requestedGrams || 0);
}

/** عرض كمية المخزون المناسبة للمنتج */
export function formatStockDisplay(product) {
  if (!product.isWeightBased) {
    return `${product.quantity ?? 0} ${product.unit || "قطعة"}`;
  }
  return formatWeight(product.stockInGrams || 0);
}
