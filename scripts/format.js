// Currency conversion and date helpers.

/** Converts an amount stored in the base currency into the display currency. */
export function convert(amount, settings, code = settings.displayCurrency) {
  if (code === settings.baseCurrency) return amount;
  const currency = settings.currencies.find((c) => c.code === code);
  return currency ? amount * currency.rate : amount;
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

/** Formats a base-currency amount in the chosen display currency, e.g. "$12.50". */
export function formatMoney(amount, settings, { compact = false, code = settings.displayCurrency } = {}) {
  return formatterFor(code, compact).format(convert(amount, settings, code));
}

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = () => isoDate(new Date());
