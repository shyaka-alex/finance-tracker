// In-memory app state. Every change is saved to localStorage and broadcast to subscribers.
import { loadRecords, loadSettings, saveRecords, saveSettings, defaultSettings } from './storage.js?v=20261013c';
import { canonicalCategory } from './validators.js?v=20261013c';

export const state = {
  records: [],
  settings: defaultSettings(),
};

const listeners = new Set();

/** fn(type) is called with 'records', 'settings' or 'storage-error'. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(type) {
  for (const fn of listeners) fn(type);
}

function persistRecords() {
  if (!saveRecords(state.records)) emit('storage-error');
  emit('records');
}

function persistSettings() {
  if (!saveSettings(state.settings)) emit('storage-error');
  emit('settings');
}

/** Adds any categories used by records that are missing from settings. Returns the added names. */
function mergeCategories(records) {
  const added = [];
  for (const { category } of records) {
    const known = [...state.settings.categories, ...added];
    if (!known.some((c) => c.toLowerCase() === category.toLowerCase())) added.push(category);
  }
  if (added.length) state.settings.categories = [...state.settings.categories, ...added];
  return added;
}

export function initState() {
  const loadedRecords = loadRecords();
  const loadedSettings = loadSettings();
  state.records = loadedRecords.records;
  state.settings = loadedSettings.settings;
  if (mergeCategories(state.records).length) saveSettings(state.settings);
  return {
    skipped: loadedRecords.skipped,
    recordsCorrupt: loadedRecords.corrupt,
    settingsReset: loadedSettings.reset,
  };
}

function nextId() {
  const highest = state.records.reduce((max, record) => {
    const match = /(\d+)$/.exec(record.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  let n = highest + 1;
  let id;
  do {
    id = `txn_${String(n).padStart(4, '0')}`;
    n += 1;
  } while (state.records.some((record) => record.id === id));
  return id;
}

export const getRecord = (id) => state.records.find((record) => record.id === id);

export function addRecord({ description, amount, category, date }) {
  const now = new Date().toISOString();
  const record = {
    id: nextId(),
    description,
    amount,
    category: canonicalCategory(category, state.settings.categories),
    date,
    createdAt: now,
    updatedAt: now,
  };
  state.records = [...state.records, record];
  persistRecords();
  return record;
}

export function updateRecord(id, fields) {
  const existing = getRecord(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...fields,
    category: canonicalCategory(fields.category ?? existing.category, state.settings.categories),
    updatedAt: new Date().toISOString(),
  };
  state.records = state.records.map((record) => (record.id === id ? updated : record));
  persistRecords();
  return updated;
}

export function deleteRecord(id) {
  const existing = getRecord(id);
  if (!existing) return null;
  state.records = state.records.filter((record) => record.id !== id);
  persistRecords();
  return existing;
}

/** Replaces every record (used by import and sample data). Returns categories that were added. */
export function replaceRecords(records) {
  state.records = [...records];
  const added = mergeCategories(records);
  if (added.length) persistSettings();
  persistRecords();
  return added;
}

export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  persistSettings();
}

/** Deletes all records and resets settings, keeping the chosen theme. */
export function clearAll() {
  const { theme } = state.settings;
  state.records = [];
  state.settings = { ...defaultSettings(), theme };
  persistSettings();
  persistRecords();
}
