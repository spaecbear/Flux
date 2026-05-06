import { PaySchedule, PayFrequency } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

// Next payday on or after fromISO
export function getNextPayday(schedule: PaySchedule, fromISO: string): string {
  const from   = new Date(fromISO + 'T00:00:00');
  const anchor = new Date(schedule.anchorDate + 'T00:00:00');

  if (schedule.frequency === 'weekly' || schedule.frequency === 'biweekly') {
    const interval = schedule.frequency === 'weekly' ? 7 : 14;
    const diffDays = Math.round((from.getTime() - anchor.getTime()) / 86400000);
    const n = Math.ceil(diffDays / interval);
    return isoDate(new Date(anchor.getTime() + Math.max(0, n) * interval * 86400000));
  }

  if (schedule.frequency === 'monthly') {
    const payDay = anchor.getDate();
    let year = from.getFullYear(), month = from.getMonth();
    const cap = Math.min(payDay, daysInMonth(year, month));
    if (new Date(year, month, cap) >= from) return isoDate(new Date(year, month, cap));
    if (++month > 11) { month = 0; year++; }
    return isoDate(new Date(year, month, Math.min(payDay, daysInMonth(year, month))));
  }

  // semimonthly: pay on anchorDay and anchorDay±15
  const d1 = anchor.getDate();
  const d2 = d1 <= 15 ? d1 + 15 : d1 - 15;
  const sorted = [d1, d2].sort((a, b) => a - b);
  let year = from.getFullYear(), month = from.getMonth();
  for (let i = 0; i < 4; i++) {
    for (const day of sorted) {
      const capped = Math.min(day, daysInMonth(year, month));
      const candidate = new Date(year, month, capped);
      if (candidate >= from) return isoDate(candidate);
    }
    if (++month > 11) { month = 0; year++; }
  }
  return fromISO;
}

// Payday that started the current period (the one just before fromISO)
function getPrevPayday(schedule: PaySchedule, fromISO: string): string {
  const next = getNextPayday(schedule, fromISO);

  if (schedule.frequency === 'weekly')   return addDays(next, -7);
  if (schedule.frequency === 'biweekly') return addDays(next, -14);

  if (schedule.frequency === 'monthly') {
    const anchor = new Date(schedule.anchorDate + 'T00:00:00');
    const payDay = anchor.getDate();
    const nextD  = new Date(next + 'T00:00:00');
    let month = nextD.getMonth() - 1, year = nextD.getFullYear();
    if (month < 0) { month = 11; year--; }
    return isoDate(new Date(year, month, Math.min(payDay, daysInMonth(year, month))));
  }

  // semimonthly
  const anchor = new Date(schedule.anchorDate + 'T00:00:00');
  const d1 = anchor.getDate();
  const d2 = d1 <= 15 ? d1 + 15 : d1 - 15;
  const sorted = [d1, d2].sort((a, b) => a - b);
  const nextD  = new Date(next + 'T00:00:00');
  const year   = nextD.getFullYear();
  const month  = nextD.getMonth();
  const nextDay = nextD.getDate();

  for (const day of [...sorted].reverse()) {
    const capped = Math.min(day, daysInMonth(year, month));
    if (capped < nextDay) return isoDate(new Date(year, month, capped));
  }
  let prevMonth = month - 1, prevYear = year;
  if (prevMonth < 0) { prevMonth = 11; prevYear--; }
  return isoDate(new Date(prevYear, prevMonth, Math.min(sorted[sorted.length - 1], daysInMonth(prevYear, prevMonth))));
}

// The full current pay period: [previous payday, next payday]
export function getCurrentPeriod(schedule: PaySchedule, fromISO: string): { start: string; end: string } {
  return {
    start: getPrevPayday(schedule, fromISO),
    end:   getNextPayday(schedule, fromISO),
  };
}

export function formatPeriod(start: string, end: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export const FREQ_LABELS: Record<PayFrequency, string> = {
  weekly:      'Weekly',
  biweekly:    'Bi-weekly',
  semimonthly: 'Semi-monthly',
  monthly:     'Monthly',
};
