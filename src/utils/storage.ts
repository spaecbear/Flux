import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, Shift, RecurringShift, GigPayment } from '../types';

const KEYS = {
  JOBS: '@flux/jobs',
  SHIFTS: '@flux/shifts',
  RECURRING: '@flux/recurring',
  GIG_PAYMENTS: '@flux/gig_payments',
};

// ── Jobs ────────────────────────────────────────────────────────────────────

export async function getJobs(): Promise<Job[]> {
  const raw = await AsyncStorage.getItem(KEYS.JOBS);
  if (!raw) return [];
  return (JSON.parse(raw) as Job[]).map(j => ({
    ignoreOverlap: false,
    paySchedule: null,
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
  const payments = (await getGigPayments()).filter(p => p.jobId !== id);
  await saveGigPayments(payments);
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

export async function deleteShift(id: string): Promise<{ shifts: Shift[]; gigPayments: GigPayment[] }> {
  const shifts = (await getShifts()).filter(s => s.id !== id);
  await saveShifts(shifts);
  const gigPayments = (await getGigPayments()).filter(p => p.shiftId !== id);
  await saveGigPayments(gigPayments);
  return { shifts, gigPayments };
}

export async function upsertGigPayment(p: GigPayment): Promise<GigPayment[]> {
  const list = await getGigPayments();
  const idx = list.findIndex(x => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  await saveGigPayments(list);
  return list;
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

// ── Gig payments ─────────────────────────────────────────────────────────────

export async function getGigPayments(): Promise<GigPayment[]> {
  const raw = await AsyncStorage.getItem(KEYS.GIG_PAYMENTS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveGigPayments(list: GigPayment[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.GIG_PAYMENTS, JSON.stringify(list));
}

export async function replaceGigPaymentsForJob(jobId: string, payments: GigPayment[]): Promise<GigPayment[]> {
  const all = (await getGigPayments()).filter(p => p.jobId !== jobId);
  const next = [...all, ...payments];
  await saveGigPayments(next);
  return next;
}

export async function deleteGigPayment(id: string): Promise<GigPayment[]> {
  const list = (await getGigPayments()).filter(p => p.id !== id);
  await saveGigPayments(list);
  return list;
}
