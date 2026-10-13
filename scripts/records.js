// Transactions list: live regex search, sorting, inline edit and delete.
import { state, subscribe, getRecord, updateRecord, deleteRecord } from './state.js?v=20261013c';
import { compileRegex, highlight, matches, sortRecords, escapeHTML } from './search.js?v=20261013c';
import { validateTransaction, findDuplicateWord } from './validators.js?v=20261013c';
import { $, $$, announce, confirmDialog, setFieldMessage } from './ui.js?v=20261013c';
import { formatMoney, categoryTone } from './format.js?v=20261013c';

const view = {
  query: '',
  caseInsensitive: true,
  re: null,
  sort: 'date-desc',
  editingId: null,
};

// Which direction a column header uses first, and what it toggles to.
const HEADER_SORTS = {
  date: ['date-desc', 'date-asc'],
  description: ['description-asc', 'description-desc'],
  amount: ['amount-desc', 'amount-asc'],
};

const EDIT_FIELDS = ['description', 'amount', 'category', 'date'];

const money = (amount) => formatMoney(amount, state.settings);

/** The exact strings shown on screen; search runs against these. */
function displayText(record) {
  return {
    date: record.date,
    description: record.description,
    category: record.category,
    amount: money(record.amount),
  };
}

function recordMatches(record) {
  if (!view.re) return true;
  return Object.values(displayText(record)).some((text) => matches(text, view.re));
}

function rowHTML(record) {
  const text = displayText(record);
  const { re } = view;
  const name = escapeHTML(record.description);
  return `
    <tr role="row" data-id="${escapeHTML(record.id)}">
      <td role="cell" class="cell-date"><time datetime="${escapeHTML(record.date)}">${highlight(text.date, re)}</time></td>
      <td role="cell" class="cell-desc">${highlight(text.description, re)}</td>
      <td role="cell" class="cell-cat"><span class="chip" data-tone="${categoryTone(record.category, state.settings.categories)}">${highlight(text.category, re)}</span></td>
      <td role="cell" class="cell-amount num">${highlight(text.amount, re)}</td>
      <td role="cell" class="cell-actions">
        <div class="row-actions">
          <button type="button" class="icon-btn" data-action="edit" aria-label="Edit ${name}" title="Edit">
            <svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg>
          </button>
          <button type="button" class="icon-btn icon-btn--danger" data-action="delete" aria-label="Delete ${name}" title="Delete">
            <svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function editField(name, label, value, extra = '') {
  const describedBy = name === 'description'
    ? `edit-${name}-error edit-${name}-warning`
    : `edit-${name}-error`;
  return `
    <label class="edit-label" for="edit-${name}">${label}</label>
    <input id="edit-${name}" name="${name}" type="text" class="input input--inline" autocomplete="off"
           value="${escapeHTML(value)}" aria-describedby="${describedBy}" ${extra}>
    <span id="edit-${name}-error" class="field__error"></span>`;
}

function editRowHTML(record) {
  const base = escapeHTML(state.settings.baseCurrency);
  return `
    <tr role="row" data-id="${escapeHTML(record.id)}" class="is-editing">
      <td role="cell" class="cell-date">${editField('date', 'Date (YYYY-MM-DD)', record.date, 'inputmode="numeric"')}</td>
      <td role="cell" class="cell-desc">
        ${editField('description', 'Description', record.description, 'maxlength="160"')}
        <span id="edit-description-warning" class="field__warning"></span>
      </td>
      <td role="cell" class="cell-cat">${editField('category', 'Category', record.category, 'list="category-options"')}</td>
      <td role="cell" class="cell-amount num">${editField('amount', `Amount (${base})`, record.amount.toFixed(2), 'inputmode="decimal"')}</td>
      <td role="cell" class="cell-actions">
        <div class="row-actions">
          <button type="button" class="btn btn--primary btn--small" data-action="save">Save</button>
          <button type="button" class="btn btn--text btn--small" data-action="cancel">Cancel</button>
        </div>
      </td>
    </tr>`;
}

function renderEmpty(container, totalRecords) {
  if (totalRecords === 0) {
    container.innerHTML = `
      <img class="empty__owl" src="assets/logo-mark.svg" alt="" width="64" height="64">
      <p class="empty__title">No transactions yet. Add your first one!</p>
      <p class="muted">Or load the sample data to explore.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#add">Add transaction</a>
        <button type="button" class="btn btn--outline" data-action="load-sample">Load sample data</button>
      </div>`;
  } else {
    container.innerHTML = `
      <p class="empty__title">No transactions match <code>${escapeHTML(view.query)}</code>.</p>
      <p class="muted">Check the pattern or try a shorter search.</p>
      <div class="btn-row">
        <button type="button" class="btn btn--outline" data-action="clear-search">Clear search</button>
      </div>`;
  }
}

function updateSortHeaders() {
  for (const th of $$('#records-table th[data-col]')) {
    const [first, second] = HEADER_SORTS[th.dataset.col];
    let sort = 'none';
    if (view.sort === first || view.sort === second) {
      sort = view.sort.endsWith('asc') ? 'ascending' : 'descending';
    }
    th.setAttribute('aria-sort', sort);
  }
  $('#sort').value = view.sort;
}

function render() {
  const body = $('#records-body');
  const table = $('#records-table');
  const empty = $('#records-empty');
  const { records } = state;

  const rows = sortRecords(records, view.sort).filter(recordMatches);
  if (view.editingId && !rows.some((r) => r.id === view.editingId)) view.editingId = null;

  body.innerHTML = rows.map((r) => (r.id === view.editingId ? editRowHTML(r) : rowHTML(r))).join('');
  table.hidden = rows.length === 0;
  empty.hidden = rows.length > 0;
  if (rows.length === 0) renderEmpty(empty, records.length);

  const count = $('#result-count');
  const noun = records.length === 1 ? 'transaction' : 'transactions';
  const text = view.re
    ? `${rows.length} of ${records.length} ${noun} match /${view.query}/${view.caseInsensitive ? 'i' : ''}`
    : `${records.length} ${noun}`;
  if (count.textContent !== text) count.textContent = text;

  updateSortHeaders();
}

function applySearch() {
  const { re, error } = compileRegex(view.query, { caseInsensitive: view.caseInsensitive });
  view.re = re;
  const input = $('#search');
  setFieldMessage(input, error);
  view.editingId = null;
  render();
}

function focusRowButton(id, action) {
  const row = $(`#records-body tr[data-id="${CSS.escape(id)}"]`);
  const button = row?.querySelector(`[data-action="${action}"]`);
  if (button) button.focus();
  else $('#search').focus();
}

function startEdit(id) {
  view.editingId = id;
  render();
  const input = $('#edit-description');
  if (!input) return;
  const word = findDuplicateWord(input.value);
  setFieldMessage(input, word ? `Duplicate word: “${word}”.` : '', 'warning');
  input.focus();
  input.select();
}

function cancelEdit(id) {
  view.editingId = null;
  render();
  focusRowButton(id, 'edit');
  announce('Edit cancelled.');
}

function readEditValues(row) {
  return Object.fromEntries(EDIT_FIELDS.map((name) => [name, row.querySelector(`[name="${name}"]`).value]));
}

function showEditErrors(row, errors) {
  for (const name of EDIT_FIELDS) {
    setFieldMessage(row.querySelector(`[name="${name}"]`), errors[name] ?? '');
  }
}

function saveEdit(row) {
  const values = readEditValues(row);
  const errors = validateTransaction(values, state.settings.categories);
  showEditErrors(row, errors);

  const failed = EDIT_FIELDS.filter((name) => errors[name]);
  if (failed.length) {
    row.querySelector(`[name="${failed[0]}"]`).focus();
    announce(`Cannot save yet. ${errors[failed[0]]}`, { assertive: true });
    return;
  }

  const { id } = row.dataset;
  view.editingId = null;
  const updated = updateRecord(id, {
    description: values.description,
    amount: Number(values.amount),
    category: values.category,
    date: values.date,
  });
  focusRowButton(id, 'edit');
  announce(`Saved changes to ${updated.description}.`);
}

async function removeRecord(id) {
  const record = getRecord(id);
  if (!record) return;

  const confirmed = await confirmDialog({
    title: 'Delete transaction?',
    message: `Delete “${record.description}” (${money(record.amount)}, ${record.date})? This cannot be undone.`,
    confirmLabel: 'Delete',
  });
  if (!confirmed) return;

  const visibleIds = $$('#records-body tr[data-id]').map((tr) => tr.dataset.id);
  const index = visibleIds.indexOf(id);
  const neighbour = visibleIds[index + 1] ?? visibleIds[index - 1];

  if (view.editingId === id) view.editingId = null;
  deleteRecord(id);
  announce(`Transaction deleted: ${record.description}.`);
  if (neighbour) focusRowButton(neighbour, 'delete');
  else $('#search').focus();
}

/**
 * On mobile the table is restyled as cards (display: grid/block), which makes some browsers
 * drop its table semantics. Explicit roles keep it announced as a table. They are added here
 * rather than in the HTML because the validator flags redundant roles in static markup.
 */
function restoreTableRoles(table) {
  table.setAttribute('role', 'table');
  for (const group of $$('thead, tbody', table)) group.setAttribute('role', 'rowgroup');
  for (const row of $$('thead tr', table)) row.setAttribute('role', 'row');
  for (const cell of $$('thead th', table)) cell.setAttribute('role', 'columnheader');
}

export function initRecords() {
  const search = $('#search');
  const caseToggle = $('#case-insensitive');
  const body = $('#records-body');
  restoreTableRoles($('#records-table'));

  search.addEventListener('input', () => {
    view.query = search.value;
    applySearch();
  });

  caseToggle.addEventListener('change', () => {
    view.caseInsensitive = caseToggle.checked;
    applySearch();
  });

  $('#sort').addEventListener('change', (event) => {
    view.sort = event.target.value;
    render();
  });

  $('#records-table thead').addEventListener('click', (event) => {
    const button = event.target.closest('[data-sort-col]');
    if (!button) return;
    const [first, second] = HEADER_SORTS[button.dataset.sortCol];
    view.sort = view.sort === first ? second : first;
    render();
    const label = $('#sort').selectedOptions[0].textContent;
    announce(`Sorted by ${label}.`);
  });

  body.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = button.closest('tr');
    const { id } = row.dataset;
    const { action } = button.dataset;
    if (action === 'edit') startEdit(id);
    else if (action === 'delete') removeRecord(id);
    else if (action === 'save') saveEdit(row);
    else if (action === 'cancel') cancelEdit(id);
  });

  body.addEventListener('keydown', (event) => {
    const row = event.target.closest('tr.is-editing');
    if (!row) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit(row.dataset.id);
    } else if (event.key === 'Enter' && event.target.matches('input')) {
      event.preventDefault();
      saveEdit(row);
    }
  });

  body.addEventListener('input', (event) => {
    const row = event.target.closest('tr.is-editing');
    if (!row || !event.target.matches('input')) return;
    const errors = validateTransaction(readEditValues(row), state.settings.categories);
    const { name } = event.target;
    setFieldMessage(event.target, errors[name] ?? '');
    if (name === 'description') {
      const word = findDuplicateWord(event.target.value);
      setFieldMessage(event.target, word ? `Duplicate word: “${word}”.` : '', 'warning');
    }
  });

  $('#records-empty').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'clear-search') {
      search.value = '';
      view.query = '';
      applySearch();
      search.focus();
    } else if (button.dataset.action === 'load-sample') {
      document.dispatchEvent(new CustomEvent('request-sample-data'));
    }
  });

  subscribe((type) => {
    if (type === 'records' || type === 'settings') render();
  });

  render();
}
