import { Shift, Job, ConflictInfo, RecurringShift } from '../types';

function pad(n: number) { return String(n).padStart(2, '0'); }

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftsOverlap(a: Shift, b: Shift): boolean {
  if (a.date !== b.date) return false;
  const startA = toMinutes(a.startTime);
  const endA   = toMinutes(a.endTime);
  const startB = toMinutes(b.startTime);
  const endB   = toMinutes(b.endTime);
  return startA < endB && endA > startB;
}

// Expand a recurring template into virtual Shift objects for a date window.
export function expandRecurringShift(
  r: RecurringShift,
  fromISO: string,
  toISO: string,
): Shift[] {
  const results: Shift[] = [];
  const templateStart = new Date(r.startDate + 'T00:00:00');
  const templateEnd   = r.endDate ? new Date(r.endDate + 'T00:00:00') : null;
  const windowStart   = new Date(fromISO + 'T00:00:00');
  const windowEnd     = new Date(toISO + 'T00:00:00');

  const iterStart = templateStart > windowStart ? templateStart : windowStart;
  const iterEnd   = templateEnd && templateEnd < windowEnd ? templateEnd : windowEnd;

  const cur = new Date(iterStart);
  while (cur <= iterEnd) {
    if (r.daysOfWeek.includes(cur.getDay())) {
      const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      results.push({
        id: `rec_${r.id}_${iso}`,
        jobId: r.jobId,
        date: iso,
        startTime: r.startTime,
        endTime: r.endTime,
        confirmedConflict: false,
        isRecurring: true,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return results;
}

// Expand all recurring templates for a window and merge with manual shifts.
export function allShiftsInWindow(
  manualShifts: Shift[],
  recurringShifts: RecurringShift[],
  fromISO: string,
  toISO: string,
): Shift[] {
  // Only include manual shifts that fall within the requested window
  const windowManual = manualShifts.filter(s => s.date >= fromISO && s.date <= toISO);
  const expanded = recurringShifts.flatMap(r => expandRecurringShift(r, fromISO, toISO));
  // Manual shifts override any recurring slot with the same date+job
  const manualKeys = new Set(windowManual.map(s => `${s.jobId}_${s.date}`));
  const filteredExpanded = expanded.filter(s => !manualKeys.has(`${s.jobId}_${s.date}`));
  return [...windowManual, ...filteredExpanded];
}

export function findConflicts(
  candidate: Shift,
  allShifts: Shift[],
  jobs: Job[],
): ConflictInfo[] {
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const candidateJob = jobMap.get(candidate.jobId);

  // If the candidate's own job ignores overlap, never flag conflicts for it.
  if (candidateJob?.ignoreOverlap) return [];

  return allShifts
    .filter(s => {
      if (s.id === candidate.id) return false;
      if (!shiftsOverlap(candidate, s)) return false;
      // Skip shifts from jobs that have ignoreOverlap set.
      const job = jobMap.get(s.jobId);
      if (job?.ignoreOverlap) return false;
      return true;
    })
    .map(s => ({ shift: s, job: jobMap.get(s.jobId)! }))
    .filter(c => c.job != null);
}

export function shiftsForDate(shifts: Shift[], date: string): Shift[] {
  return shifts.filter(s => s.date === date);
}

export function datesWithConflicts(shifts: Shift[], jobs: Job[]): Set<string> {
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const conflictDates = new Set<string>();
  const byDate = new Map<string, Shift[]>();

  for (const s of shifts) {
    // Shifts from ignoreOverlap jobs never contribute to conflict indicators.
    if (jobMap.get(s.jobId)?.ignoreOverlap) continue;
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }

  for (const [date, dayShifts] of byDate) {
    outer: for (let i = 0; i < dayShifts.length; i++) {
      for (let j = i + 1; j < dayShifts.length; j++) {
        if (shiftsOverlap(dayShifts[i], dayShifts[j])) {
          conflictDates.add(date);
          break outer;
        }
      }
    }
  }
  return conflictDates;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${pad(m)} ${ampm}`;
  };
  return `${fmt(startTime)}–${fmt(endTime)}`;
}

export function shiftDurationHours(shift: Shift): number {
  const start = toMinutes(shift.startTime);
  const end   = toMinutes(shift.endTime);
  return Math.max(0, (end - start) / 60);
}
