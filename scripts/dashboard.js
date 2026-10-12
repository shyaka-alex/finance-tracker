// Dashboard: stat cards, 7-day bar chart, category breakdown and budget cap.
import { state, subscribe } from './state.js';
import { computeStats, capStatus } from './stats.js';
import { formatMoney } from './format.js';
import { escapeHTML } from './search.js';
import { $, announce } from './ui.js';

let lastCapKey = null;

const money = (amount, options) => formatMoney(amount, state.settings, options);

function renderStats(stats) {
  $('#stat-count').textContent = String(stats.count);
  $('#stat-count-sub').textContent = stats.count === 1 ? 'transaction recorded' : 'transactions recorded';
  $('#stat-total').textContent = money(stats.total);

  if (stats.top) {
    $('#stat-top').textContent = stats.top.category;
    $('#stat-top-sub').textContent = `${money(stats.top.total)} · ${stats.top.count} ${stats.top.count === 1 ? 'transaction' : 'transactions'}`;
  } else {
    $('#stat-top').textContent = 'None';
    $('#stat-top-sub').textContent = 'No spending yet';
  }

  $('#stat-week').textContent = money(stats.weekTotal);
  $('#stat-week-sub').textContent = `${stats.weekCount} ${stats.weekCount === 1 ? 'transaction' : 'transactions'}`;
}

function renderChart(stats) {
  const max = Math.max(...stats.days.map((d) => d.total), 0);
  const chart = $('#chart');

  chart.innerHTML = stats.days.map((day, i) => {
    const height = max > 0 ? Math.max((day.total / max) * 100, day.total > 0 ? 3 : 0) : 0;
    return `
      <div class="chart__col${day.isToday ? ' is-today' : ''}">
        <span class="chart__value">${day.total > 0 ? escapeHTML(money(day.total, { compact: day.total >= 1000 })) : ''}</span>
        <div class="chart__track"><div class="chart__bar" style="--h:${height.toFixed(1)}%; --i:${i}"></div></div>
        <span class="chart__label">${day.isToday ? 'Today' : day.label}</span>
      </div>`;
  }).join('') + (max === 0 ? '<p class="chart__empty">No spending in the last 7 days</p>' : '');

  // Text alternative for screen readers.
  $('#chart-list').innerHTML = stats.days
    .map((day) => `<li>${escapeHTML(day.longLabel)}: ${escapeHTML(money(day.total))}</li>`)
    .join('');

  $('#chart-total').textContent = `${money(stats.weekTotal)} in total`;
}

function renderCategories(stats) {
  const list = $('#cat-breakdown');
  const spending = stats.byCategory.filter((c) => c.total > 0).slice(0, 6);
  if (spending.length === 0) {
    list.innerHTML = '<li class="cat-breakdown__empty">Categories appear here once you spend.</li>';
    return;
  }
  const max = spending[0].total;
  list.innerHTML = spending.map((c) => `
    <li>
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
  const card = $('#budget-card');
  const meter = $('#budget-meter');

  card.dataset.state = status.state;
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
  else if (status.state === 'over') message = `You are ${money(-status.remaining)} over budget!`;
  else message = `You have ${money(status.remaining)} remaining this month.`;

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
  render(false);
  subscribe((type) => {
    if (type === 'records' || type === 'settings') render(true);
  });
}
