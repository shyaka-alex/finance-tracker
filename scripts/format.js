// Currency conversion and date helpers.

/**
 * Converts an amount stored in the base currency into the display currency.
 * Rates are "1 foreign unit = rate base units" (e.g. 1 USD = 1450 RWF), so we divide.
 */
export function convert(amount, settings, code = settings.displayCurrency) {
  if (code === settings.baseCurrency) return amount;
  const currency = settings.currencies.find((c) => c.code === code);
  return currency ? amount / currency.rate : amount;
}

const formatters = new Map();

function formatterFor(code, compact) {
  const key = `${code}|${compact}`;
  if (!formatters.has(key)) {
    let formatter;
    try {
      formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
      });
    } catch {
      formatter = { format: (value) => `${value.toFixed(2)} ${code}` };
    }
    formatters.set(key, formatter);
  }
  return formatters.get(key);
}

/** Formats a base-currency amount in the chosen display currency, e.g. "RWF 2,500". */
export function formatMoney(amount, settings, { compact = false, code = settings.displayCurrency } = {}) {
  return formatterFor(code, compact).format(convert(amount, settings, code));
}

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = () => isoDate(new Date());

const TONES = 6;

/** A stable colour slot (0–5) for a category pill, based on its position in Settings. */
export function categoryTone(name, categories) {
  const index = categories.indexOf(name);
  if (index >= 0) return index % TONES;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash % TONES;
}

/** "Good morning" / "Good afternoon" / "Good evening" for the given time. */
export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
