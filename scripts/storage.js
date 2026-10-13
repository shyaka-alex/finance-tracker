// localStorage persistence. Every read is defensive: bad data never crashes the app.
import { describeRecordProblem, PATTERNS, validateCurrencyCode } from './validators.js?v=20261013b';

export const KEYS = {
  records: 'spendwise:records',
  settings: 'spendwise:settings',
};

export const DEFAULT_CATEGORIES = ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other'];

export const SETTINGS_VERSION = 2;

export function defaultSettings() {
  return {
    version: SETTINGS_VERSION,
    baseCurrency: 'RWF',
    // rate = how many base-currency units (francs) one unit of this currency is worth.
    currencies: [
      { code: 'USD', rate: 1450 },
      { code: 'EUR', rate: 1580 },
    ],
    displayCurrency: 'RWF',
    cap: 150000,
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

  // Version 1 used USD as the base with "1 base = rate foreign" rates. Keep only theme and categories.
  if (stored.version !== SETTINGS_VERSION) {
    return sanitizeSettings({
      version: SETTINGS_VERSION,
      theme: stored.theme,
      categories: stored.categories,
    });
  }

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

/* ---------- Import / export ---------- */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/**
 * Validates JSON text before anything is loaded.
 * Returns { ok: true, records } or { ok: false, error } with a human-readable reason.
 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'the file is not valid JSON.' };
  }
  if (!Array.isArray(data)) return { ok: false, error: 'expected a list (JSON array) of transactions.' };
  if (data.length === 0) return { ok: false, error: 'the file contains no transactions.' };

  const ids = new Set();
  for (let i = 0; i < data.length; i += 1) {
    const problem = describeRecordProblem(data[i]);
    if (problem) return { ok: false, error: `record ${i + 1} ${problem}.` };
    if (ids.has(data[i].id)) return { ok: false, error: `record ${i + 1} repeats the id '${data[i].id}'.` };
    ids.add(data[i].id);
  }
  return { ok: true, records: data.map(pickRecord) };
}

export const toJSON = (records) => `${JSON.stringify(records, null, 2)}\n`;

const CSV_COLUMNS = ['id', 'date', 'description', 'category', 'amount', 'createdAt', 'updatedAt'];

/** RFC 4180 style CSV: quotes doubled, fields with commas/quotes/newlines wrapped in quotes. */
export function toCSV(records) {
  const cell = (value) => {
    let text = String(value);
    // Stop spreadsheet apps from treating text as a formula.
    if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = records.map((record) => CSV_COLUMNS.map((column) => cell(record[column])).join(','));
  return [CSV_COLUMNS.join(','), ...lines].join('\r\n');
}

export function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
