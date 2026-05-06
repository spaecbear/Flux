import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Job, Shift } from '../types';
import { getJobs, getShifts, upsertJob, deleteJob as storageDeleteJob, upsertShift, deleteShift as storageDeleteShift } from '../utils/storage';

interface AppContextValue {
  jobs: Job[];
  shifts: Shift[];
  refreshJobs: () => Promise<void>;
  refreshShifts: () => Promise<void>;
  saveJob: (job: Job) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  saveShift: (shift: Shift) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const refreshJobs = useCallback(async () => {
    setJobs(await getJobs());
  }, []);

  const refreshShifts = useCallback(async () => {
    setShifts(await getShifts());
  }, []);

  useEffect(() => {
    refreshJobs();
    refreshShifts();
  }, []);

  const saveJob = useCallback(async (job: Job) => {
    const updated = await upsertJob(job);
    setJobs(updated);
  }, []);

  const removeJob = useCallback(async (id: string) => {
    const updated = await storageDeleteJob(id);
    setJobs(updated);
    setShifts(prev => prev.filter(s => s.jobId !== id));
  }, []);

  const saveShift = useCallback(async (shift: Shift) => {
    const updated = await upsertShift(shift);
    setShifts(updated);
  }, []);

  const removeShift = useCallback(async (id: string) => {
    const updated = await storageDeleteShift(id);
    setShifts(updated);
  }, []);

  return (
    <AppContext.Provider value={{ jobs, shifts, refreshJobs, refreshShifts, saveJob, removeJob, saveShift, removeShift }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
