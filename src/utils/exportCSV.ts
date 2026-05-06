import { Platform } from 'react-native';
import type { Job, Shift } from '../types';
import { shiftDurationHours } from './conflicts';

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDate(iso: string) {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function csvRow(cells: (string | number)[]) {
  return cells.map(c => {
    const s = String(c);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

export function buildCSV(
  shifts: Shift[],
  jobs: Job[],
  monthLabel: string,
): string {
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const header = csvRow(['Date', 'Job', 'Start', 'End', 'Hours', 'Rate ($/hr)', 'Est. Earnings ($)']);

  let totalHours = 0;
  let totalEarnings = 0;

  const rows = sorted.map(s => {
    const job = jobMap.get(s.jobId);
    const hours = shiftDurationHours(s);
    const rate = job?.hourlyRate ?? 0;
    const earnings = hours * rate;
    totalHours += hours;
    totalEarnings += earnings;
    return csvRow([
      fmtDate(s.date),
      job?.name ?? 'Unknown',
      fmtTime(s.startTime),
      fmtTime(s.endTime),
      hours.toFixed(2),
      rate > 0 ? rate.toFixed(2) : '-',
      rate > 0 ? earnings.toFixed(2) : '-',
    ]);
  });

  const totals = csvRow([
    `Total — ${monthLabel}`, '', '', '',
    totalHours.toFixed(2), '',
    totalEarnings.toFixed(2),
  ]);

  const disclaimer = csvRow(['* Pre-tax estimate based on scheduled hours']);

  return [header, ...rows, totals, disclaimer].join('\n');
}

export async function exportCSV(csv: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Native: write to cache dir then share
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');

  const file = new File(Paths.cache, filename);
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Earnings' });
  }
}
