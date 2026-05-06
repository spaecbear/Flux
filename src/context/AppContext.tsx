import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Job, Shift, RecurringShift, GigPayment } from '../types';
import {
  getJobs, getShifts, getRecurringShifts, getGigPayments,
  upsertJob, deleteJob as storageDeleteJob,
  upsertShift, deleteShift as storageDeleteShift,
  upsertRecurringShift, deleteRecurringShift as storageDeleteRecurringShift,
  upsertGigPayment, replaceGigPaymentsForJob, deleteGigPayment as storageDeleteGigPayment,
} from '../utils/storage';

interface AppContextValue {
  jobs: Job[];
  shifts: Shift[];
  recurringShifts: RecurringShift[];
  gigPayments: GigPayment[];
  saveJob: (job: Job) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  saveShift: (shift: Shift) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
  saveRecurringShift: (r: RecurringShift) => Promise<void>;
  removeRecurringShift: (id: string) => Promise<void>;
  saveGigPayment: (p: GigPayment) => Promise<void>;
  replaceJobGigPayments: (jobId: string, payments: GigPayment[]) => Promise<void>;
  removeGigPayment: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [recurringShifts, setRecurringShifts] = useState<RecurringShift[]>([]);
  const [gigPayments, setGigPayments] = useState<GigPayment[]>([]);

  useEffect(() => {
    getJobs().then(setJobs);
    getShifts().then(setShifts);
    getRecurringShifts().then(setRecurringShifts);
    getGigPayments().then(setGigPayments);
  }, []);

  const saveJob = useCallback(async (job: Job) => {
    setJobs(await upsertJob(job));
  }, []);

  const removeJob = useCallback(async (id: string) => {
    const updated = await storageDeleteJob(id);
    setJobs(updated);
    setShifts(prev => prev.filter(s => s.jobId !== id));
    setRecurringShifts(prev => prev.filter(r => r.jobId !== id));
    setGigPayments(prev => prev.filter(p => p.jobId !== id));
  }, []);

  const saveShift = useCallback(async (shift: Shift) => {
    setShifts(await upsertShift(shift));
  }, []);

  const removeShift = useCallback(async (id: string) => {
    const { shifts: updatedShifts, gigPayments: updatedPayments } = await storageDeleteShift(id);
    setShifts(updatedShifts);
    setGigPayments(updatedPayments);
  }, []);

  const saveRecurringShift = useCallback(async (r: RecurringShift) => {
    setRecurringShifts(await upsertRecurringShift(r));
  }, []);

  const removeRecurringShift = useCallback(async (id: string) => {
    setRecurringShifts(await storageDeleteRecurringShift(id));
  }, []);

  const saveGigPayment = useCallback(async (p: GigPayment) => {
    setGigPayments(await upsertGigPayment(p));
  }, []);

  const replaceJobGigPayments = useCallback(async (jobId: string, payments: GigPayment[]) => {
    setGigPayments(await replaceGigPaymentsForJob(jobId, payments));
  }, []);

  const removeGigPayment = useCallback(async (id: string) => {
    setGigPayments(await storageDeleteGigPayment(id));
  }, []);

  return (
    <AppContext.Provider value={{
      jobs, shifts, recurringShifts, gigPayments,
      saveJob, removeJob,
      saveShift, removeShift,
      saveRecurringShift, removeRecurringShift,
      saveGigPayment, replaceJobGigPayments, removeGigPayment,
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
