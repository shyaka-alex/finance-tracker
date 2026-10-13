// Dashboard: greeting, stat cards, 7-day bar chart, category breakdown and budget cap.
import { state, subscribe } from './state.js?v=20261013b';
import { computeStats, capStatus } from './stats.js?v=20261013b';
import { formatMoney, categoryTone, greeting } from './format.js?v=20261013b';
import { escapeHTML } from './search.js?v=20261013b';
import { $, announce } from './ui.js?v=20261013b';

let lastCapKey = null;

const money = (amount, options) => formatMoney(amount, state.settings, options);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

function renderGreeting() {
  const now = new Date();
  $('#greeting').textContent = `${greeting(now)},`;
  $('#today-date').textContent = LONG_DATE.format(now);
}

function renderStats(stats) {
  $('#stat-count').textContent = String(stats.count);
  $('#stat-count-sub').textContent = stats.count === 1 ? 'transaction recorded' : 'transactions recorded';
  $('#stat-total').textContent = money(stats.total);

  if (stats.top) {
    $('#stat-top').textContent = stats.top.category;
    $('#stat-top-sub').textContent = `${money(stats.top.total)} · ${plural(stats.top.count, 'transaction')}`;
  } else {
    $('#stat-top').textContent = 'None';
    $('#stat-top-sub').textContent = 'No spending yet';
  }

  $('#stat-week').textContent = money(stats.weekTotal);
  $('#stat-week-sub').textContent = plural(stats.weekCount, 'transaction');
}

function renderChart(stats) {
  const max = Math.max(...stats.days.map((d) => d.total), 0);

  $('#chart').innerHTML = stats.days.map((day, i) => {
    const height = max > 0 ? Math.max((day.total / max) * 100, day.total > 0 ? 4 : 0) : 0;
    return `
      <div class="chart__col${day.isToday ? ' is-today' : ''}" title="${escapeHTML(`${day.longLabel}: ${money(day.total)}`)}">
        <div class="chart__track"><div class="chart__bar" style="--h:${height.toFixed(1)}%; --i:${i}"></div></div>
        <span class="chart__label">${escapeHTML(day.label.charAt(0))}</span>
      </div>`;
  }).join('') + (max === 0 ? '<p class="chart__empty">No spending in the last 7 days</p>' : '');

  // Text alternative for screen readers.
  $('#chart-list').innerHTML = stats.days
    .map((day) => `<li>${escapeHTML(day.longLabel)}: ${escapeHTML(money(day.total))}</li>`)
    .join('');

  $('#chart-total').textContent = money(stats.weekTotal);
}

function renderCategories(stats) {
  const list = $('#cat-breakdown');
  const spending = stats.byCategory.filter((c) => c.total > 0).slice(0, 5);
  if (spending.length === 0) {
    list.innerHTML = '<li class="cat-breakdown__empty">Categories appear here once you spend.</li>';
    return;
  }
  const max = spending[0].total;
  const { categories } = state.settings;
  list.innerHTML = spending.map((c) => `
    <li data-tone="${categoryTone(c.category, categories)}">
      <div class="cat-breakdown__row">
        <span class="cat-breakdown__name">${escapeHTML(c.category)}</span>
        <span class="cat-breakdown__amount">${escapeHTML(money(c.total))}</span>
      </div>
      <div class="cat-breakdown__track" aria-hidden="true">
        <div class="cat-breakdown__fill" style="--w:${((c.total / max) * 100).toFixed(1)}%"></div>
      </div>
    </li>`).join('');
}

function renderBudget(stats, shouldAnnounce) {
  const { cap } = state.settings;
  const spent = stats.monthTotal;
  const status = capStatus(spent, cap);
  const meter = $('#budget-meter');

  $('#budget-card').dataset.state = status.state;
  $('#budget-title').textContent = `${stats.monthLabel} budget`;
  $('#budget-spent').textContent = money(spent);
  $('#budget-cap').textContent = cap ? money(cap) : 'no cap';

  const filled = Math.min(status.percent, 100);
  $('#budget-fill').style.width = `${filled}%`;
  meter.setAttribute('aria-valuenow', String(Math.round(filled)));
  meter.setAttribute('aria-valuetext', cap
    ? `${money(spent)} of ${money(cap)} spent, ${Math.round(status.percent)} percent`
    : 'No budget set');

  let message;
  if (status.state === 'none') message = 'No budget set. Add a monthly cap in Settings.';
  else if (status.state === 'over') message = `You’re ${money(-status.remaining)} over budget.`;
  else message = `You have ${money(status.remaining)} left this month.`;

  const icon = status.state === 'over' ? '⚠' : status.state === 'none' ? '' : '✓';
  $('#budget-message').innerHTML = `${icon ? `<span aria-hidden="true">${icon}</span>` : ''}<span>${escapeHTML(message)}</span>`;

  const pace = $('#budget-pace');
  if (status.state === 'none' || status.state === 'over') {
    pace.textContent = stats.daysLeft === 1 ? '1 day left this month.' : `${stats.daysLeft} days left this month.`;
  } else {
    const perDay = status.remaining / stats.daysLeft;
    pace.textContent = `${stats.daysLeft} days left: about ${money(perDay)} a day keeps you on track.`;
  }

  // Polite when under the cap, assertive when it is exceeded. Keyed on the numbers, not the
  // formatted text, so switching display currency does not repeat the announcement.
  const key = `${status.state}|${Math.round(spent * 100)}|${Math.round(cap * 100)}`;
  if (shouldAnnounce && key !== lastCapKey && status.state !== 'none') {
    announce(
      status.state === 'over' ? `Budget exceeded. ${message}` : message,
      { assertive: status.state === 'over' },
    );
  }
  lastCapKey = key;
}

function render(shouldAnnounce) {
  const stats = computeStats(state.records);
  renderStats(stats);
  renderChart(stats);
  renderCategories(stats);
  renderBudget(stats, shouldAnnounce);
}

export function initDashboard() {
  renderGreeting();
  render(false);
  subscribe((type) => {
    if (type === 'records' || type === 'settings') render(true);
  });
  document.addEventListener('viewchange', (event) => {
    if (event.detail.id === 'dashboard') renderGreeting();
  });
}
