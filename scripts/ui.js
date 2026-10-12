// Shared UI helpers: DOM shortcuts, live announcements, navigation, dialogs.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const VIEWS = ['home', 'about', 'contact', 'dashboard', 'settings'];

/** Sections inside a view that can be linked to directly, mapped to their view. */
const SECTIONS = {
  features: 'home',
  transactions: 'dashboard',
  add: 'dashboard',
};

const TITLES = {
  home: 'Spendwise · Student Finance Tracker',
  dashboard: 'Dashboard · Spendwise',
  settings: 'Settings · Spendwise',
  about: 'About · Spendwise',
  contact: 'Contact · Spendwise',
  transactions: 'Transactions · Spendwise',
  add: 'Add transaction · Spendwise',
};

/** Where focus goes when a section is opened from a link. */
const SECTION_FOCUS = {
  add: 'f-description',
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

/** Small toast at the bottom of the screen; the same text goes to the polite live region. */
let toastTimer = 0;
export function toast(message) {
  const el = document.getElementById('toast');
  if (el) {
    document.getElementById('toast-text').textContent = message;
    el.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), 2600);
  }
  announce(message);
}

/* ---------- Navigation (one page, hash-based) ---------- */

let currentView = null;

function setMenuOpen(open) {
  const header = document.getElementById('site-header');
  const button = document.getElementById('menu-btn');
  if (!header || !button) return;
  header.classList.toggle('is-open', open);
  button.setAttribute('aria-expanded', String(open));
}

function showView(id) {
  const changed = currentView !== id;
  currentView = id;
  for (const view of VIEWS) document.getElementById(view).hidden = view !== id;
  if (changed) document.dispatchEvent(new CustomEvent('viewchange', { detail: { id } }));
  return changed;
}

function markCurrentLink(key) {
  for (const link of $$('[data-nav]')) {
    if (link.getAttribute('href') === `#${key}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/**
 * Shows the view for a hash. Sections (like #about or #add) open their parent view,
 * scroll into place and receive focus so keyboard and screen reader users land there.
 */
function route(hash, { focus }) {
  const id = hash || 'home';
  const view = VIEWS.includes(id) ? id : SECTIONS[id];
  if (!view) {
    // Unknown hashes (e.g. the skip link's #main) must not change the view.
    if (!currentView) route('home', { focus: false });
    return;
  }

  const changed = showView(view);
  const navKey = document.querySelector(`[data-nav][href="#${id}"]`) ? id : view;
  markCurrentLink(navKey);
  document.title = TITLES[id] ?? TITLES[view];
  setMenuOpen(false);

  if (!focus) return;
  if (id === view) {
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById(`${view}-title`)?.focus({ preventScroll: !changed });
    return;
  }
  const section = document.getElementById(id);
  const target = document.getElementById(SECTION_FOCUS[id] ?? `${id}-title`) ?? section;
  const smooth = !changed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'instant' });
  target?.focus({ preventScroll: true });
}

export function goTo(id) {
  if (location.hash === `#${id}`) route(id, { focus: true });
  else location.hash = id;
}

export function initNavigation() {
  window.addEventListener('hashchange', () => route(location.hash.slice(1), { focus: true }));

  // Clicking a link to the hash we are already on would not fire hashchange, so route manually.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.getAttribute('href') !== location.hash || location.hash === '#main') return;
    event.preventDefault();
    route(location.hash.slice(1), { focus: true });
  });

  const button = document.getElementById('menu-btn');
  button?.addEventListener('click', () => {
    setMenuOpen(button.getAttribute('aria-expanded') !== 'true');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button?.getAttribute('aria-expanded') === 'true') {
      setMenuOpen(false);
      button.focus();
    }
  });

  route(location.hash.slice(1), { focus: false });
  const initial = location.hash.slice(1);
  if (SECTIONS[initial]) document.getElementById(initial)?.scrollIntoView({ block: 'start', behavior: 'instant' });
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
