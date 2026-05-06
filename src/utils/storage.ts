import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, Shift } from '../types';

const KEYS = {
  JOBS: '@flux/jobs',
  SHIFTS: '@flux/shifts',
};

// Jobs

export async function getJobs(): Promise<Job[]> {
  const raw = await AsyncStorage.getItem(KEYS.JOBS);
  return raw ? JSON.parse(raw) : [];
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
  // cascade delete shifts for this job
  const shifts = (await getShifts()).filter(s => s.jobId !== id);
  await saveShifts(shifts);
  return jobs;
}

// Shifts

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
