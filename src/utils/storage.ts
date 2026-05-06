import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, Shift, RecurringShift } from '../types';

const KEYS = {
  JOBS: '@flux/jobs',
  SHIFTS: '@flux/shifts',
  RECURRING: '@flux/recurring',
};

// ── Jobs ────────────────────────────────────────────────────────────────────

export async function getJobs(): Promise<Job[]> {
  const raw = await AsyncStorage.getItem(KEYS.JOBS);
  if (!raw) return [];
  // backfill ignoreOverlap for records saved before this field existed
  return (JSON.parse(raw) as Job[]).map(j => ({
    ignoreOverlap: false,
    ...j,
  }));
}

export async function saveJobs(jobs: Job[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
}

export async function upsertJob(job: Job): Promise<Job[]> {
  const jobs = await getJobs();
  const idx = jobs.findIndex(j => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.push(job);
  await saveJobs(jobs);
  return jobs;
}

export async function deleteJob(id: string): Promise<Job[]> {
  const jobs = (await getJobs()).filter(j => j.id !== id);
  await saveJobs(jobs);
  const shifts = (await getShifts()).filter(s => s.jobId !== id);
  await saveShifts(shifts);
  const recurring = (await getRecurringShifts()).filter(r => r.jobId !== id);
  await saveRecurringShifts(recurring);
  return jobs;
}

// ── Shifts ───────────────────────────────────────────────────────────────────

export async function getShifts(): Promise<Shift[]> {
  const raw = await AsyncStorage.getItem(KEYS.SHIFTS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveShifts(shifts: Shift[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.SHIFTS, JSON.stringify(shifts));
}

export async function upsertShift(shift: Shift): Promise<Shift[]> {
  const shifts = await getShifts();
  const idx = shifts.findIndex(s => s.id === shift.id);
  if (idx >= 0) shifts[idx] = shift;
  else shifts.push(shift);
  await saveShifts(shifts);
  return shifts;
}

export async function deleteShift(id: string): Promise<Shift[]> {
  const shifts = (await getShifts()).filter(s => s.id !== id);
  await saveShifts(shifts);
  return shifts;
}

// ── Recurring shifts ─────────────────────────────────────────────────────────

export async function getRecurringShifts(): Promise<RecurringShift[]> {
  const raw = await AsyncStorage.getItem(KEYS.RECURRING);
  return raw ? JSON.parse(raw) : [];
}

export async function saveRecurringShifts(list: RecurringShift[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(list));
}

export async function upsertRecurringShift(r: RecurringShift): Promise<RecurringShift[]> {
  const list = await getRecurringShifts();
  const idx = list.findIndex(x => x.id === r.id);
  if (idx >= 0) list[idx] = r;
  else list.push(r);
  await saveRecurringShifts(list);
  return list;
}

export async function deleteRecurringShift(id: string): Promise<RecurringShift[]> {
  const list = (await getRecurringShifts()).filter(r => r.id !== id);
  await saveRecurringShifts(list);
  return list;
}
