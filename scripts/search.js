// Safe regex compiling, accessible <mark> highlighting and sorting.

const MAX_PATTERN_LENGTH = 200;

/**
 * Compiles user input into a RegExp without ever throwing.
 * Returns { re, error }: re is null when the input is empty or invalid.
 */
export function compileRegex(input, { caseInsensitive = true } = {}) {
  if (!input) return { re: null, error: '' };
  if (input.length > MAX_PATTERN_LENGTH) {
    return { re: null, error: `Pattern is too long (max ${MAX_PATTERN_LENGTH} characters).` };
  }
  try {
    return { re: new RegExp(input, caseInsensitive ? 'gi' : 'g'), error: '' };
  } catch (error) {
    const detail = error.message.replace(/^Invalid regular expression: /, '');
    return { re: null, error: `Invalid pattern: ${detail}. Showing all transactions.` };
  }
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** True when the text contains at least one non-empty match. */
export function matches(text, re) {
  if (!re) return true;
  re.lastIndex = 0;
  const found = re.test(String(text));
  re.lastIndex = 0;
  return found;
}

/**
 * Wraps every match in <mark>. The text around matches is HTML-escaped, so
 * user data can never inject markup, and screen readers still read the full sentence.
 */
export function highlight(text, re) {
  const source = String(text);
  if (!re) return escapeHTML(source);

  const pattern = re.global ? re : new RegExp(re.source, `${re.flags}g`);
  pattern.lastIndex = 0;

  let html = '';
  let last = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match[0] === '') {
      // Zero-length match (e.g. "^" or "\b"): step forward to avoid an infinite loop.
      pattern.lastIndex += 1;
      continue;
    }
    html += `${escapeHTML(source.slice(last, match.index))}<mark>${escapeHTML(match[0])}</mark>`;
    last = match.index + match[0].length;
  }
  pattern.lastIndex = 0;
  return html + escapeHTML(source.slice(last));
}

const compareText = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
const byNewest = (a, b) => compareText(b.date, a.date) || compareText(b.createdAt, a.createdAt);

export const SORTS = {
  'date-desc': byNewest,
  'date-asc': (a, b) => -byNewest(a, b),
  'description-asc': (a, b) => compareText(a.description, b.description) || byNewest(a, b),
  'description-desc': (a, b) => compareText(b.description, a.description) || byNewest(a, b),
  'amount-desc': (a, b) => b.amount - a.amount || byNewest(a, b),
  'amount-asc': (a, b) => a.amount - b.amount || byNewest(a, b),
};

export function sortRecords(records, key) {
  return [...records].sort(SORTS[key] ?? SORTS['date-desc']);
}
