// Shared UI helpers: DOM shortcuts, live announcements, navigation, dialogs.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const VIEWS = ['dashboard', 'transactions', 'add', 'settings', 'about'];

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  add: 'Add transaction',
  settings: 'Settings',
  about: 'About',
};

/**
 * Speak a message to screen reader users.
 * Messages are appended (not replaced) so two quick announcements are both read.
 */
export function announce(message, { assertive = false } = {}) {
  const region = document.getElementById(assertive ? 'live-assertive' : 'live-polite');
  if (!region || !message) return;
  const node = document.createElement('p');
  node.textContent = message;
  region.append(node);
  window.setTimeout(() => node.remove(), 6000);
}

/** Show an inline error/warning under an input and keep ARIA state in sync. */
export function setFieldMessage(input, message, kind = 'error') {
  const target = document.getElementById(`${input.id}-${kind}`);
  if (target) target.textContent = message;
  if (kind !== 'error') return;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

/** Visible status line inside a form (success or error). */
export function setStatus(element, message, kind = 'success') {
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
}

/* ---------- Navigation (one page, hash-based) ---------- */

let currentView = null;

export function showView(id, { focus = true } = {}) {
  if (!VIEWS.includes(id)) return;
  const changed = currentView !== id;
  currentView = id;

  for (const view of VIEWS) {
    document.getElementById(view).hidden = view !== id;
  }

  for (const link of $$('[data-nav]')) {
    if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  document.title = `${VIEW_TITLES[id]} · Spendwise`;

  if (focus && changed) {
    document.getElementById(`${id}-title`)?.focus();
  }

  document.dispatchEvent(new CustomEvent('viewchange', { detail: { id } }));
}

export function goTo(id) {
  if (location.hash === `#${id}`) showView(id);
  else location.hash = id;
}

export function initNavigation() {
  const route = (focus) => {
    const id = location.hash.slice(1);
    if (VIEWS.includes(id)) showView(id, { focus });
    else if (!currentView) showView('dashboard', { focus: false });
  };
  window.addEventListener('hashchange', () => route(true));
  route(false);
}

/* ---------- Confirm dialog ---------- */

/**
 * Accessible confirm dialog using the native <dialog> element.
 * Resolves true when the user confirms. Escape or Cancel resolves false.
 */
export function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }) {
  const dialog = document.getElementById('confirm-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(message));
  }

  $('#confirm-title', dialog).textContent = title;
  $('#confirm-message', dialog).textContent = message;
  const ok = $('#confirm-ok', dialog);
  ok.textContent = confirmLabel;
  ok.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;

  const opener = document.activeElement;
  dialog.returnValue = '';
  dialog.showModal();
  $('[value="cancel"]', dialog).focus();

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
      resolve(dialog.returnValue === 'confirm');
    }, { once: true });
  });
}
