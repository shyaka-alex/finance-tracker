// Pure statistics over the records. No DOM access, so it is easy to test.
import { isoDate } from './format.js';

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const LONG_DAY = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

export function computeStats(records, now = new Date()) {
  const total = records.reduce((sum, r) => sum + r.amount, 0);

  const categories = new Map();
  for (const r of records) {
    const entry = categories.get(r.category) ?? { category: r.category, total: 0, count: 0 };
    entry.total += r.amount;
    entry.count += 1;
    categories.set(r.category, entry);
  }
  const byCategory = [...categories.values()].sort(
    (a, b) => b.total - a.total || b.count - a.count || a.category.localeCompare(b.category),
  );

  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    days.push({
      date: isoDate(day),
      label: WEEKDAY.format(day),
      longLabel: LONG_DAY.format(day),
      isToday: offset === 0,
      total: 0,
      count: 0,
    });
  }
  const dayIndex = new Map(days.map((d) => [d.date, d]));
  for (const r of records) {
    const day = dayIndex.get(r.date);
    if (day) {
      day.total += r.amount;
      day.count += 1;
    }
  }

  const monthKey = isoDate(now).slice(0, 7);
  const monthRecords = records.filter((r) => r.date.startsWith(monthKey));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return {
    count: records.length,
    total,
    byCategory,
    top: byCategory[0] ?? null,
    days,
    weekTotal: days.reduce((sum, d) => sum + d.total, 0),
    weekCount: days.reduce((sum, d) => sum + d.count, 0),
    monthTotal: monthRecords.reduce((sum, r) => sum + r.amount, 0),
    monthLabel: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now),
    daysLeft: daysInMonth - now.getDate() + 1,
  };
}

/** Budget status: 'none' (no cap), 'ok', 'warn' (80%+) or 'over'. */
export function capStatus(spent, cap) {
  if (!cap) return { state: 'none', percent: 0, remaining: 0 };
  const percent = (spent / cap) * 100;
  let status = 'ok';
  if (spent > cap) status = 'over';
  else if (percent >= 80) status = 'warn';
  return { state: status, percent, remaining: cap - spent };
}
