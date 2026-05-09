export type JobType = 'regular' | 'gig';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface PaySchedule {
  frequency: PayFrequency;
  anchorDate: string; // YYYY-MM-DD — a confirmed recent payday
}

export interface Job {
  id: string;
  name: string;
  color: string;
  type: JobType;
  hourlyRate: number | null;
  ignoreOverlap: boolean;
  paySchedule: PaySchedule | null;
}

export interface GigPayment {
  id: string;
  jobId: string;
  shiftId?: string;      // linked shift — payment is deleted when shift is deleted
  expectedDate: string;  // YYYY-MM-DD
  amount: number;
  description: string;
}

export interface Shift {
  id: string;
  jobId: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // "HH:MM" 24hr
  endTime: string;      // "HH:MM" 24hr
  confirmedConflict: boolean;
  isRecurring?: boolean;
  notes?: string;       // optional free-text notes / address / reminders
  flagged?: boolean;    // user-set attention flag
}

// A recurring schedule template — expanded into virtual Shifts on the fly
export interface RecurringShift {
  id: string;
  jobId: string;
  daysOfWeek: number[];  // 0=Sun … 6=Sat
  startTime: string;
  endTime: string;
  startDate: string;     // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD, or null = ongoing
}

export interface ConflictInfo {
  shift: Shift;
  job: Job;
}
