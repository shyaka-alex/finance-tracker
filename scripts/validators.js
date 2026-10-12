// All regex validation rules live here so the form, inline edit, import and tests share them.

export const PATTERNS = {
  // No leading or trailing whitespace.
  description: /^\S(?:.*\S)?$/,
  // Two or more spaces in a row.
  doubleSpace: / {2,}/,
  // 0 or a positive number without leading zeros, at most 2 decimals.
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  // YYYY-MM-DD with a valid month (01-12) and day (01-31).
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  // Letters, with single spaces or hyphens between words.
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  // Advanced (back-reference): the same word twice in a row, e.g. "the the".
  duplicateWord: /\b(\w+)\s+\1\b/i,
  // ISO 4217 style currency code.
  currencyCode: /^[A-Z]{3}$/,
  // Advanced (lookahead): a positive rate; the lookahead rejects 0, 0.0, 0.000000.
  rate: /^(?=.*[1-9])(0|[1-9]\d*)(\.\d{1,6})?$/,
  // Record ids such as txn_0001 or rec_42.
  recordId: /^[A-Za-z]+_[A-Za-z0-9]+$/,
};

export const LIMITS = {
  descriptionLength: 160,
  maxAmount: 100_000_000,
  categoryLength: 30,
};

export function validateDescription(value) {
  if (value.trim() === '') return 'Description is required.';
  if (!PATTERNS.description.test(value)) return 'Remove the spaces at the start or end.';
  if (PATTERNS.doubleSpace.test(value)) return 'Use a single space between words.';
  if (value.length > LIMITS.descriptionLength) {
    return `Keep it to ${LIMITS.descriptionLength} characters or fewer.`;
  }
  return '';
}

/** Returns the repeated word (e.g. "coffee") or null. Used as a warning, not an error. */
export function findDuplicateWord(value) {
  const match = PATTERNS.duplicateWord.exec(value);
  return match ? match[1] : null;
}

export function validateAmount(value, label = 'Amount') {
  if (value === '') return `${label} is required.`;
  if (!PATTERNS.amount.test(value)) {
    return `${label} must be a number like 2500 or 2500.50 (up to 2 decimals, no minus sign, commas or leading zeros).`;
  }
  if (Number(value) > LIMITS.maxAmount) {
    return `${label} must be ${LIMITS.maxAmount.toLocaleString('en-US')} or less.`;
  }
  return '';
}

/** Rejects dates that match the pattern but do not exist, like 2025-02-29. */
export function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateDate(value) {
  if (value === '') return 'Date is required.';
  if (!PATTERNS.date.test(value)) return 'Use the format YYYY-MM-DD, for example 2026-10-12.';
  if (!isRealDate(value)) return 'That date does not exist on the calendar.';
  return '';
}

/** Finds the stored spelling of a category, ignoring case. */
export function canonicalCategory(value, categories = []) {
  const lower = value.toLowerCase();
  return categories.find((c) => c.toLowerCase() === lower) ?? value;
}

export function validateCategory(value, categories) {
  if (value.trim() === '') return 'Category is required.';
  if (!PATTERNS.category.test(value)) return 'Use letters only, with single spaces or hyphens between words.';
  if (value.length > LIMITS.categoryLength) return `Keep it to ${LIMITS.categoryLength} characters or fewer.`;
  if (categories && !categories.some((c) => c.toLowerCase() === value.toLowerCase())) {
    return 'Pick one of your categories, or add this one in Settings first.';
  }
  return '';
}

export function validateCurrencyCode(value) {
  if (value === '') return 'Currency code is required.';
  if (!PATTERNS.currencyCode.test(value)) return 'Use a 3-letter code in capitals, like USD.';
  return '';
}

export function validateRate(value) {
  if (value === '') return 'Rate is required.';
  if (!PATTERNS.rate.test(value)) return 'Rate must be above 0 with up to 6 decimals, like 1450.';
  return '';
}

/** Validates the four editable fields of a transaction. Returns { field: message } for failures only. */
export function validateTransaction(values, categories) {
  const errors = {
    description: validateDescription(values.description),
    amount: validateAmount(values.amount),
    category: validateCategory(values.category, categories),
    date: validateDate(values.date),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

const RECORD_SHAPE = {
  id: 'string',
  description: 'string',
  amount: 'number',
  category: 'string',
  date: 'string',
  createdAt: 'string',
  updatedAt: 'string',
};

/**
 * Checks a stored or imported record. Returns '' when valid, otherwise
 * a short phrase such as "is missing 'amount'" for use in error messages.
 */
export function describeRecordProblem(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'is not an object';

  for (const [key, type] of Object.entries(RECORD_SHAPE)) {
    if (!(key in record)) return `is missing '${key}'`;
    if (typeof record[key] !== type) return `has '${key}' as a ${typeof record[key]}, expected a ${type}`;
  }

  if (!PATTERNS.recordId.test(record.id)) return `has an invalid 'id' (${record.id})`;
  if (validateDescription(record.description)) return `has an invalid 'description'`;
  if (!Number.isFinite(record.amount) || validateAmount(String(record.amount))) {
    return `has an invalid 'amount' (${record.amount})`;
  }
  if (validateCategory(record.category)) return `has an invalid 'category' (${record.category})`;
  if (validateDate(record.date)) return `has an invalid 'date' (${record.date})`;
  if (Number.isNaN(Date.parse(record.createdAt))) return `has an invalid 'createdAt'`;
  if (Number.isNaN(Date.parse(record.updatedAt))) return `has an invalid 'updatedAt'`;
  return '';
}
