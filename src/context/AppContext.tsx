import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Job, Shift, RecurringShift } from '../types';
import {
  getJobs, getShifts, getRecurringShifts,
  upsertJob, deleteJob as storageDeleteJob,
  upsertShift, deleteShift as storageDeleteShift,
  upsertRecurringShift, deleteRecurringShift as storageDeleteRecurringShift,
} from '../utils/storage';

interface AppContextValue {
  jobs: Job[];
  shifts: Shift[];
  recurringShifts: RecurringShift[];
  saveJob: (job: Job) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  saveShift: (shift: Shift) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
  saveRecurringShift: (r: RecurringShift) => Promise<void>;
  removeRecurringShift: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [recurringShifts, setRecurringShifts] = useState<RecurringShift[]>([]);

  useEffect(() => {
    getJobs().then(setJobs);
    getShifts().then(setShifts);
    getRecurringShifts().then(setRecurringShifts);
  }, []);

  const saveJob = useCallback(async (job: Job) => {
    setJobs(await upsertJob(job));
  }, []);

  const removeJob = useCallback(async (id: string) => {
    const updated = await storageDeleteJob(id);
    setJobs(updated);
    setShifts(prev => prev.filter(s => s.jobId !== id));
    setRecurringShifts(prev => prev.filter(r => r.jobId !== id));
  }, []);

  const saveShift = useCallback(async (shift: Shift) => {
    setShifts(await upsertShift(shift));
  }, []);

  const removeShift = useCallback(async (id: string) => {
    setShifts(await storageDeleteShift(id));
  }, []);

  const saveRecurringShift = useCallback(async (r: RecurringShift) => {
    setRecurringShifts(await upsertRecurringShift(r));
  }, []);

  const removeRecurringShift = useCallback(async (id: string) => {
    setRecurringShifts(await storageDeleteRecurringShift(id));
  }, []);

  return (
    <AppContext.Provider value={{
      jobs, shifts, recurringShifts,
      saveJob, removeJob,
      saveShift, removeShift,
      saveRecurringShift, removeRecurringShift,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
