// localStorage persistence. Every read is defensive: bad data never crashes the app.
import { describeRecordProblem, PATTERNS, validateCurrencyCode } from './validators.js';

export const KEYS = {
  records: 'spendwise:records',
  settings: 'spendwise:settings',
};

export const DEFAULT_CATEGORIES = ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other'];

export function defaultSettings() {
  return {
    baseCurrency: 'USD',
    currencies: [
      { code: 'EUR', rate: 0.92 },
      { code: 'RWF', rate: 1300 },
    ],
    displayCurrency: 'USD',
    cap: 500,
    categories: [...DEFAULT_CATEGORIES],
    theme: 'light',
  };
}

function readJSON(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };
  try {
    return { status: 'ok', value: JSON.parse(raw) };
  } catch {
    return { status: 'corrupt' };
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Keeps only the known fields, in a stable order. */
export function pickRecord({ id, description, amount, category, date, createdAt, updatedAt }) {
  return { id, description, amount, category, date, createdAt, updatedAt };
}

/** Loads records, skipping (and counting) any that are malformed or duplicated. */
export function loadRecords() {
  const result = readJSON(KEYS.records);
  if (result.status === 'corrupt') return { records: [], skipped: 0, corrupt: true };
  if (result.status !== 'ok') return { records: [], skipped: 0, corrupt: false };
  if (!Array.isArray(result.value)) return { records: [], skipped: 0, corrupt: true };

  const seen = new Set();
  const records = [];
  let skipped = 0;
  for (const item of result.value) {
    if (describeRecordProblem(item) || seen.has(item.id)) {
      skipped += 1;
      continue;
    }
    seen.add(item.id);
    records.push(pickRecord(item));
  }
  return { records, skipped, corrupt: false };
}

export const saveRecords = (records) => writeJSON(KEYS.records, records);

/** Merges stored settings over the defaults, ignoring any field that is the wrong shape. */
export function sanitizeSettings(stored) {
  const settings = defaultSettings();
  if (!stored || typeof stored !== 'object') return settings;

  if (typeof stored.baseCurrency === 'string' && !validateCurrencyCode(stored.baseCurrency)) {
    settings.baseCurrency = stored.baseCurrency;
  }

  const validCurrencies = Array.isArray(stored.currencies)
    && stored.currencies.length === 2
    && stored.currencies.every((c) => c && typeof c.code === 'string' && !validateCurrencyCode(c.code)
      && Number.isFinite(c.rate) && c.rate > 0);
  if (validCurrencies) {
    settings.currencies = stored.currencies.map(({ code, rate }) => ({ code, rate }));
  }

  const codes = [settings.baseCurrency, ...settings.currencies.map((c) => c.code)];
  settings.displayCurrency = codes.includes(stored.displayCurrency) ? stored.displayCurrency : settings.baseCurrency;

  if (Number.isFinite(stored.cap) && stored.cap >= 0) settings.cap = stored.cap;

  const validCategories = Array.isArray(stored.categories)
    && stored.categories.length > 0
    && stored.categories.every((c) => typeof c === 'string' && PATTERNS.category.test(c));
  if (validCategories) settings.categories = [...new Set(stored.categories)];

  if (stored.theme === 'light' || stored.theme === 'dark') settings.theme = stored.theme;

  return settings;
}

export function loadSettings() {
  const result = readJSON(KEYS.settings);
  if (result.status !== 'ok') return { settings: defaultSettings(), reset: result.status === 'corrupt' };
  return { settings: sanitizeSettings(result.value), reset: false };
}

export const saveSettings = (settings) => writeJSON(KEYS.settings, settings);
