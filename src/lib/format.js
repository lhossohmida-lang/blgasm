export const settings = {
  currency: "دج",
  locale: "ar-DZ-u-nu-latn",
};

export function money(value = 0) {
  return `${Number(value || 0).toLocaleString(settings.locale, {
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })} ${settings.currency}`;
}

export function number(value = 0) {
  return Number(value || 0).toLocaleString(settings.locale);
}

export function dateTime(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat(settings.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function shortDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat(settings.locale, { dateStyle: "short" }).format(date);
}
