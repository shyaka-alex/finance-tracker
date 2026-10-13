// Add-transaction form: real-time regex validation, duplicate-word warning, save.
import { state, addRecord, subscribe } from './state.js?v=20261013b';
import {
  validateDescription, validateAmount, validateCategory, validateDate, findDuplicateWord,
} from './validators.js?v=20261013b';
import { $, announce, setFieldMessage, setStatus } from './ui.js?v=20261013b';
import { formatMoney, todayISO } from './format.js?v=20261013b';

const RULES = {
  description: (value) => validateDescription(value),
  amount: (value) => validateAmount(value),
  date: (value) => validateDate(value),
  category: (value) => validateCategory(value, state.settings.categories),
};

const FIELD_ORDER = ['description', 'amount', 'category', 'date'];

export function renderCategoryOptions() {
  const { categories } = state.settings;
  const datalist = document.getElementById('category-options');
  datalist.replaceChildren(...categories.map((name) => {
    const option = document.createElement('option');
    option.value = name;
    return option;
  }));
  const hint = document.getElementById('category-hint-list');
  if (hint) hint.textContent = categories.join(', ');
}

export function initForm() {
  const form = $('#txn-form');
  const status = $('#form-status');
  const inputs = Object.fromEntries(FIELD_ORDER.map((name) => [name, form.elements[name]]));
  const touched = new Set();

  function updateDuplicateWarning() {
    const word = findDuplicateWord(inputs.description.value);
    setFieldMessage(
      inputs.description,
      word ? `Duplicate word detected: “${word}”. Is that a typo?` : '',
      'warning',
    );
  }

  function check(name) {
    const message = RULES[name](inputs[name].value);
    setFieldMessage(inputs[name], message);
    if (name === 'description') updateDuplicateWarning();
    return message;
  }

  function clearForm() {
    for (const name of FIELD_ORDER) {
      inputs[name].value = '';
      setFieldMessage(inputs[name], '');
    }
    setFieldMessage(inputs.description, '', 'warning');
    inputs.date.value = todayISO();
    touched.clear();
  }

  form.addEventListener('input', (event) => {
    const { name } = event.target;
    if (!(name in RULES)) return;
    setStatus(status, '');
    if (touched.has(name)) check(name);
    else if (name === 'description') updateDuplicateWarning();
  });

  form.addEventListener('focusout', (event) => {
    const { name, value } = event.target;
    if (!(name in RULES)) return;
    // Do not shout "required" at someone who just tabbed past an empty field.
    if (value === '' && !touched.has(name)) return;
    touched.add(name);
    check(name);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const failed = FIELD_ORDER.filter((name) => {
      touched.add(name);
      return check(name);
    });

    if (failed.length) {
      const message = `Please fix ${failed.length} ${failed.length === 1 ? 'field' : 'fields'} before saving.`;
      setStatus(status, message, 'error');
      announce(message, { assertive: true });
      inputs[failed[0]].focus();
      return;
    }

    const record = addRecord({
      description: inputs.description.value,
      amount: Number(inputs.amount.value),
      category: inputs.category.value,
      date: inputs.date.value,
    });

    clearForm();
    const money = formatMoney(record.amount, state.settings);
    setStatus(status, `Saved “${record.description}” (${money}).`);
    announce(`Transaction added: ${record.description}, ${money}.`);
    inputs.description.focus();
  });

  form.addEventListener('reset', (event) => {
    event.preventDefault();
    clearForm();
    setStatus(status, '');
    inputs.description.focus();
  });

  inputs.date.value = todayISO();
  renderCategoryOptions();
  subscribe((type) => {
    if (type === 'settings') renderCategoryOptions();
  });
}
