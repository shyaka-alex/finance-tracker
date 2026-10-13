// Settings: currencies and rates, budget cap, categories, theme, and data import/export.
import {
  state, subscribe, updateSettings, replaceRecords, clearAll,
} from './state.js?v=20261013b';
import {
  validateCurrencyCode, validateRate, validateAmount, PATTERNS, LIMITS,
} from './validators.js?v=20261013b';
import {
  parseImport, toJSON, toCSV, downloadFile, MAX_IMPORT_BYTES,
} from './storage.js?v=20261013b';
import { escapeHTML } from './search.js?v=20261013b';
import { $, $$, announce, toast, confirmDialog, setFieldMessage, setStatus } from './ui.js?v=20261013b';
import { todayISO, categoryTone } from './format.js?v=20261013b';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ---------- Theme ---------- */

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E1714' : '#DDE5E0');
}

/* ---------- Rendering ---------- */

function renderCurrencyLabels() {
  for (const el of $$('[data-base-currency]')) el.textContent = state.settings.baseCurrency;
}

function renderDisplayOptions() {
  const { baseCurrency, currencies, displayCurrency } = state.settings;
  const select = $('#s-display');
  const options = [
    { code: baseCurrency, label: `${baseCurrency} (base)` },
    ...currencies.map((c) => ({
      code: c.code,
      label: `${c.code} (1 ${c.code} = ${c.rate.toLocaleString('en-US')} ${baseCurrency})`,
    })),
  ];
  select.innerHTML = options
    .map((o) => `<option value="${escapeHTML(o.code)}">${escapeHTML(o.label)}</option>`)
    .join('');
  select.value = displayCurrency;
}

function renderCategories() {
  const counts = new Map();
  for (const r of state.records) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);

  $('#category-list').innerHTML = state.settings.categories.map((name) => {
    const count = counts.get(name) ?? 0;
    const safe = escapeHTML(name);
    return `
      <li class="tag" data-tone="${categoryTone(name, state.settings.categories)}">
        <span>${safe}</span>
        <span class="tag__count" aria-label="${plural(count, 'transaction')}">${count}</span>
        <button type="button" class="tag__remove" data-remove="${safe}" aria-label="Remove category ${safe}">
          <span aria-hidden="true">×</span>
        </button>
      </li>`;
  }).join('');
}

function fillInputs() {
  const { baseCurrency, currencies, cap, theme } = state.settings;
  $('#s-base').value = baseCurrency;
  $('#s-cur1-code').value = currencies[0].code;
  $('#s-cur1-rate').value = String(currencies[0].rate);
  $('#s-cur2-code').value = currencies[1].code;
  $('#s-cur2-rate').value = String(currencies[1].rate);
  $('#s-cap').value = String(cap);
  $('#s-theme').checked = theme === 'dark';
  for (const input of $$('#settings input[aria-invalid]')) setFieldMessage(input, '');
}

function render() {
  renderCurrencyLabels();
  renderDisplayOptions();
  renderCategories();
}

/* ---------- Currency ---------- */

const CURRENCY_FIELDS = {
  's-base': validateCurrencyCode,
  's-cur1-code': validateCurrencyCode,
  's-cur1-rate': validateRate,
  's-cur2-code': validateCurrencyCode,
  's-cur2-rate': validateRate,
};

function validateCurrencyForm() {
  const errors = {};
  for (const [id, rule] of Object.entries(CURRENCY_FIELDS)) {
    const input = document.getElementById(id);
    input.value = id.endsWith('rate') ? input.value.trim() : input.value.trim().toUpperCase();
    errors[id] = rule(input.value);
  }

  const codes = ['s-base', 's-cur1-code', 's-cur2-code'];
  for (const id of codes) {
    const value = document.getElementById(id).value;
    const duplicate = codes.some((other) => other !== id && document.getElementById(other).value === value);
    if (!errors[id] && duplicate) errors[id] = 'Each currency needs a different code.';
  }

  for (const [id, message] of Object.entries(errors)) setFieldMessage(document.getElementById(id), message);
  return Object.values(errors).every((message) => !message);
}

function saveCurrencies() {
  if (!validateCurrencyForm()) {
    announce('Currency settings not saved. Please fix the highlighted fields.', { assertive: true });
    return;
  }
  const baseCurrency = $('#s-base').value;
  const currencies = [
    { code: $('#s-cur1-code').value, rate: Number($('#s-cur1-rate').value) },
    { code: $('#s-cur2-code').value, rate: Number($('#s-cur2-rate').value) },
  ];
  const codes = [baseCurrency, ...currencies.map((c) => c.code)];
  const displayCurrency = codes.includes(state.settings.displayCurrency) ? state.settings.displayCurrency : baseCurrency;

  const unchanged = JSON.stringify({ baseCurrency, currencies })
    === JSON.stringify({ baseCurrency: state.settings.baseCurrency, currencies: state.settings.currencies });
  if (unchanged) return;

  updateSettings({ baseCurrency, currencies, displayCurrency });
  toast('Currency settings saved');
}

/* ---------- Budget ---------- */

function saveCap(event) {
  const input = $('#s-cap');
  input.value = input.value.trim();
  const error = validateAmount(input.value, 'Spending cap');
  setFieldMessage(input, error);
  if (error) {
    announce(`Budget not saved. ${error}`, { assertive: true });
    return;
  }
  const cap = Number(input.value);
  if (cap === state.settings.cap) {
    if (event?.type === 'submit') toast('Budget saved');
    return;
  }
  updateSettings({ cap });
  toast(cap === 0 ? 'Budget turned off' : 'Budget saved');
}

/* ---------- Categories ---------- */

function addCategory(event) {
  event.preventDefault();
  const input = $('#s-new-category');
  const name = input.value.trim();
  let error = '';
  if (!name) error = 'Type a category name.';
  else if (!PATTERNS.category.test(name)) error = 'Use letters only, with single spaces or hyphens between words.';
  else if (name.length > LIMITS.categoryLength) error = `Keep it to ${LIMITS.categoryLength} characters or fewer.`;
  else if (state.settings.categories.some((c) => c.toLowerCase() === name.toLowerCase())) error = `“${name}” already exists.`;

  setFieldMessage(input, error);
  if (error) {
    input.focus();
    return;
  }
  updateSettings({ categories: [...state.settings.categories, name] });
  input.value = '';
  toast(`Category “${name}” added`);
}

function removeCategory(name) {
  const used = state.records.filter((r) => r.category === name).length;
  if (used > 0) {
    announce(`Cannot remove “${name}”: ${plural(used, 'transaction')} still use it. Edit or delete them first.`, { assertive: true });
    return;
  }
  if (state.settings.categories.length === 1) {
    announce('Keep at least one category.', { assertive: true });
    return;
  }
  const buttons = $$('#category-list [data-remove]');
  const index = buttons.findIndex((b) => b.dataset.remove === name);

  updateSettings({ categories: state.settings.categories.filter((c) => c !== name) });
  toast(`Category “${name}” removed`);

  const remaining = $$('#category-list [data-remove]');
  (remaining[index] ?? remaining[index - 1] ?? $('#s-new-category')).focus();
}

/* ---------- Data ---------- */

async function importRecords(records, source) {
  const status = $('#data-status');
  if (state.records.length > 0) {
    const confirmed = await confirmDialog({
      title: 'Replace your transactions?',
      message: `This replaces your ${plural(state.records.length, 'transaction')} with ${plural(records.length, 'transaction')} from ${source}.`,
      confirmLabel: 'Replace',
      danger: false,
    });
    if (!confirmed) {
      setStatus(status, 'Import cancelled. Nothing was changed.', 'error');
      return;
    }
  }
  const added = replaceRecords(records);
  const extra = added.length ? ` New categories added: ${added.join(', ')}.` : '';
  const message = `Imported ${plural(records.length, 'transaction')} from ${source}.${extra}`;
  setStatus(status, message, 'success');
  announce(message);
}

function reportImportError(reason) {
  const message = `Import failed: ${reason} Your existing data was not changed.`;
  setStatus($('#data-status'), message, 'error');
  announce(message, { assertive: true });
}

async function handleFile(event) {
  const input = event.target;
  const [file] = input.files;
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) {
      reportImportError('the file is larger than 2 MB.');
      return;
    }
    const result = parseImport(await file.text());
    if (!result.ok) {
      reportImportError(result.error);
      return;
    }
    await importRecords(result.records, `“${file.name}”`);
  } catch {
    reportImportError('the file could not be read.');
  } finally {
    input.value = '';
  }
}

export async function loadSampleData() {
  try {
    const response = await fetch('seed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const result = parseImport(await response.text());
    if (!result.ok) {
      reportImportError(result.error);
      return;
    }
    await importRecords(result.records, 'the sample data');
  } catch {
    reportImportError('the sample file could not be loaded. Open the app through a web server or GitHub Pages.');
  }
}

function exportData(kind) {
  const status = $('#data-status');
  if (state.records.length === 0) {
    setStatus(status, 'There are no transactions to export yet.', 'error');
    announce('There are no transactions to export yet.');
    return;
  }
  const stamp = todayISO();
  if (kind === 'json') downloadFile(`spendwise-${stamp}.json`, toJSON(state.records), 'application/json');
  else downloadFile(`spendwise-${stamp}.csv`, toCSV(state.records), 'text/csv');
  const message = `Exported ${plural(state.records.length, 'transaction')} as ${kind.toUpperCase()}.`;
  setStatus(status, message, 'success');
  announce(message);
}

async function clearData() {
  const confirmed = await confirmDialog({
    title: 'Clear all data?',
    message: `This deletes all ${plural(state.records.length, 'transaction')} and resets your settings. Export first if you want a backup.`,
    confirmLabel: 'Clear everything',
  });
  if (!confirmed) return;
  clearAll();
  fillInputs();
  setStatus($('#data-status'), 'All data cleared.', 'success');
  announce('All data cleared.');
}

/* ---------- Init ---------- */

export function initSettings() {
  applyTheme(state.settings.theme);
  fillInputs();
  render();

  const currencyForm = $('#currency-form');
  currencyForm.addEventListener('change', (event) => {
    if (event.target.id === 's-display') {
      updateSettings({ displayCurrency: event.target.value });
      toast(`Amounts now shown in ${event.target.value}`);
    } else {
      saveCurrencies();
    }
  });
  currencyForm.addEventListener('input', (event) => {
    const rule = CURRENCY_FIELDS[event.target.id];
    if (rule && event.target.hasAttribute('aria-invalid')) setFieldMessage(event.target, rule(event.target.value.trim()));
  });
  currencyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveCurrencies();
  });

  const budgetForm = $('#budget-form');
  budgetForm.addEventListener('change', saveCap);
  budgetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveCap(event);
  });

  $('#category-form').addEventListener('submit', addCategory);
  $('#category-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove]');
    if (button) removeCategory(button.dataset.remove);
  });

  $('#s-theme').addEventListener('change', (event) => {
    const theme = event.target.checked ? 'dark' : 'light';
    updateSettings({ theme });
    applyTheme(theme);
    toast(`${theme === 'dark' ? 'Dark' : 'Light'} theme on`);
  });

  $('#export-json').addEventListener('click', () => exportData('json'));
  $('#export-csv').addEventListener('click', () => exportData('csv'));
  $('#import-file').addEventListener('change', handleFile);
  $('#load-sample').addEventListener('click', loadSampleData);
  $('#clear-data').addEventListener('click', clearData);
  document.addEventListener('request-sample-data', loadSampleData);

  subscribe((type) => {
    if (type === 'settings' || type === 'records') render();
  });
}
