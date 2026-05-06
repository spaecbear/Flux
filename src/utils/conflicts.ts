import { Shift, Job, ConflictInfo } from '../types';

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

export function findConflicts(
  candidate: Shift,
  allShifts: Shift[],
  jobs: Job[],
): ConflictInfo[] {
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  return allShifts
    .filter(s => s.id !== candidate.id && shiftsOverlap(candidate, s))
    .map(s => ({ shift: s, job: jobMap.get(s.jobId)! }))
    .filter(c => c.job != null);
}

export function shiftsForDate(shifts: Shift[], date: string): Shift[] {
  return shifts.filter(s => s.date === date);
}

export function datesWithConflicts(shifts: Shift[]): Set<string> {
  const conflictDates = new Set<string>();
  const byDate = new Map<string, Shift[]>();
  for (const s of shifts) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }
  for (const [date, dayShifts] of byDate) {
    for (let i = 0; i < dayShifts.length; i++) {
      for (let j = i + 1; j < dayShifts.length; j++) {
        if (shiftsOverlap(dayShifts[i], dayShifts[j])) {
          conflictDates.add(date);
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
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(startTime)}–${fmt(endTime)}`;
}

export function shiftDurationHours(shift: Shift): number {
  const start = toMinutes(shift.startTime);
  const end   = toMinutes(shift.endTime);
  return Math.max(0, (end - start) / 60);
}
