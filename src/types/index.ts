export type JobType = 'regular' | 'gig';

export interface Job {
  id: string;
  name: string;
  color: string;
  type: JobType;
  hourlyRate: number | null;
  ignoreOverlap: boolean;
}

export interface Shift {
  id: string;
  jobId: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // "HH:MM" 24hr
  endTime: string;      // "HH:MM" 24hr
  confirmedConflict: boolean;
  isRecurring?: boolean;
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
