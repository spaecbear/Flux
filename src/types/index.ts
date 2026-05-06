export type JobType = 'regular' | 'gig';

export interface Job {
  id: string;
  name: string;
  color: string;
  type: JobType;
  hourlyRate: number | null;
}

export interface Shift {
  id: string;
  jobId: string;
  date: string;      // ISO date string YYYY-MM-DD
  startTime: string; // "HH:MM" 24hr
  endTime: string;   // "HH:MM" 24hr
  confirmedConflict: boolean;
}

export interface ConflictInfo {
  shift: Shift;
  job: Job;
}
