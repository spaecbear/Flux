import React, { useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, SafeAreaView, TouchableOpacity, Modal,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { shiftDurationHours, allShiftsInWindow } from '../utils/conflicts';
import { getCurrentPeriod, formatPeriod, isoDate } from '../utils/payday';
import { buildCSV, exportCSV } from '../utils/exportCSV';

function pad(n: number) { return String(n).padStart(2, '0'); }

function monthLabel(year: number, month: number) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[month]} ${year}`;
}

function monthStart(y: number, m: number) {
  return `${y}-${pad(m + 1)}-01`;
}
function monthEnd(y: number, m: number) {
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${pad(m + 1)}-${pad(lastDay)}`;
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const MONTH_ITEM_HEIGHT = 48;

function MonthPickerModal({
  visible, year, month, onSelect, onClose,
}: {
  visible: boolean; year: number; month: number;
  onSelect: (y: number, m: number) => void; onClose: () => void;
}) {
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = -12; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const selectedIndex = months.findIndex(mo => mo.year === year && mo.month === month);
  // Show one item of context above the selected month
  const initialIndex = Math.max(0, selectedIndex - 1);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Select Month</Text>
          <FlatList
            data={months}
            style={{ maxHeight: 300 }}
            keyExtractor={item => `${item.year}-${item.month}`}
            getItemLayout={(_, index) => ({
              length: MONTH_ITEM_HEIGHT,
              offset: MONTH_ITEM_HEIGHT * index,
              index,
            })}
            initialScrollIndex={initialIndex}
            renderItem={({ item: { year: y, month: m } }) => {
              const selected = y === year && m === month;
              return (
                <TouchableOpacity
                  style={[s.monthOption, selected && s.monthOptionSelected]}
                  onPress={() => { onSelect(y, m); onClose(); }}
                >
                  <Text style={[s.monthOptionText, selected && s.monthOptionTextSelected]}>
                    {monthLabel(y, m)}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function EarningsScreen() {
  const { jobs, shifts, recurringShifts, gigPayments } = useApp();
  const now = new Date();
  const todayISO = isoDate(now);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [pickerVisible, setPickerVisible] = useState(false);

  const startISO = monthStart(year, month);
  const endISO = monthEnd(year, month);

  const allMonthShifts = useMemo(
    () => allShiftsInWindow(shifts, recurringShifts, startISO, endISO),
    [shifts, recurringShifts, startISO, endISO],
  );

  // All jobs that have at least one shift in the selected month (rated or not)
  const jobsWithShifts = useMemo(() => {
    const jobsInMonth = new Set(allMonthShifts.map(s => s.jobId));
    return jobs.filter(j => jobsInMonth.has(j.id));
  }, [jobs, allMonthShifts]);

  // Subset with hourly rates (used for the earnings total only)
  const jobsWithRate = useMemo(() => jobs.filter(j => j.hourlyRate != null), [jobs]);

  // ── Monthly earnings per job ──────────────────────────────────────────────
  const monthlyEarnings = useMemo(() => {
    return jobsWithShifts.map(job => {
      const jobShifts = allMonthShifts.filter(s => s.jobId === job.id);
      const totalHours = jobShifts.reduce((sum, s) => sum + shiftDurationHours(s), 0);
      const rate = job.hourlyRate;
      const gross = rate != null ? totalHours * rate : null;
      return { job, totalHours, gross, shiftCount: jobShifts.length };
    });
  }, [jobsWithShifts, allMonthShifts]);

  // Totals only count jobs with rates
  const totalHours = monthlyEarnings.reduce((s, e) => s + e.totalHours, 0);
  const totalHourlyGross = monthlyEarnings.filter(e => e.gross != null).reduce((s, e) => s + (e.gross ?? 0), 0);

  // ── Current pay period per regular job (only shown on current month) ──────
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const payPeriodJobs = useMemo(() => {
    if (!isCurrentMonth) return [];
    return jobs.filter(j => j.type === 'regular' && j.paySchedule && j.hourlyRate != null);
  }, [jobs, isCurrentMonth]);

  const payPeriodData = useMemo(() => {
    return payPeriodJobs.map(job => {
      const period = getCurrentPeriod(job.paySchedule!, todayISO);
      const periodShifts = allShiftsInWindow(shifts, recurringShifts, period.start, period.end);
      const jobShifts = periodShifts.filter(s => s.jobId === job.id);
      const totalHours = jobShifts.reduce((sum, s) => sum + shiftDurationHours(s), 0);
      const gross = totalHours * (job.hourlyRate ?? 0);
      return { job, period, totalHours, gross, shiftCount: jobShifts.length };
    });
  }, [payPeriodJobs, shifts, recurringShifts, todayISO]);

  // ── Gig payments: recent = within selected month & past; upcoming = any future payment ──
  const gigJobsWithPayments = useMemo(() => {
    return jobs
      .filter(j => j.type === 'gig')
      .map(job => {
        const allJobPayments = gigPayments
          .filter(p => p.jobId === job.id)
          .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
        const recent = allJobPayments.filter(
          p => p.expectedDate >= startISO && p.expectedDate < todayISO,
        );
        const upcoming = allJobPayments.filter(p => p.expectedDate >= todayISO);
        return { job, recent, upcoming };
      })
      .filter(({ recent, upcoming }) => recent.length > 0 || upcoming.length > 0);
  }, [jobs, gigPayments, startISO, todayISO]);

  const hasPayPeriodData = payPeriodData.length > 0;
  const hasGigPayments = gigJobsWithPayments.length > 0;

  // Sum only gig payments within the selected month for the monthly total
  const totalGigAmount = useMemo(() => {
    return jobs
      .filter(j => j.type === 'gig')
      .reduce((sum, job) => {
        return sum + gigPayments
          .filter(p => p.jobId === job.id && p.expectedDate >= startISO && p.expectedDate <= endISO)
          .reduce((s, p) => s + p.amount, 0);
      }, 0);
  }, [jobs, gigPayments, startISO, endISO]);

  const totalGross = totalHourlyGross + totalGigAmount;

  function handleExport() {
    const label = monthLabel(year, month);
    const csv = buildCSV(allMonthShifts, jobs, label);
    const filename = `flux-earnings-${year}-${pad(month + 1)}.csv`;
    exportCSV(csv, filename).catch(() => {});
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Earnings</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.exportBtn} onPress={handleExport}>
            <Text style={s.exportBtnText}>↑ CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.monthBtn} onPress={() => setPickerVisible(true)}>
            <Text style={s.monthBtnText}>{monthLabel(year, month)}</Text>
            <Text style={s.monthBtnChevron}>▾</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MonthPickerModal
        visible={pickerVisible}
        year={year}
        month={month}
        onSelect={(y, m) => { setYear(y); setMonth(m); }}
        onClose={() => setPickerVisible(false)}
      />

      <ScrollView style={s.scrollView} contentContainerStyle={s.content}>

        {/* ── Current pay periods ─────────────────────────────────────────── */}
        {hasPayPeriodData && (
          <>
            <Text style={s.sectionHeader}>CURRENT PAY PERIOD</Text>
            {payPeriodData.map(({ job, period, totalHours, gross, shiftCount }) => (
              <View key={job.id} style={[s.card, s.periodCard]}>
                <View style={s.cardHeader}>
                  <View style={[s.colorDot, { backgroundColor: job.color }]} />
                  <Text style={s.cardJobName}>{job.name}</Text>
                  <Text style={s.periodRange}>{formatPeriod(period.start, period.end)}</Text>
                </View>
                <View style={s.cardStats}>
                  <View style={s.stat}>
                    <Text style={s.statValue}>{totalHours.toFixed(1)}</Text>
                    <Text style={s.statLabel}>hours</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.stat}>
                    <Text style={s.statValue}>{shiftCount}</Text>
                    <Text style={s.statLabel}>shifts</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.stat}>
                    <Text style={[s.statValue, s.earnValue]}>${gross.toFixed(2)}</Text>
                    <Text style={s.statLabel}>est. gross</Text>
                  </View>
                </View>
                <Text style={s.paydayLabel}>
                  Payday: <Text style={s.paydayDate}>{shortDate(period.end)}</Text>
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ── Gig payments ────────────────────────────────────────────────── */}
        {hasGigPayments && (
          <>
            <Text style={s.sectionHeader}>GIG PAYMENTS</Text>
            {gigJobsWithPayments.map(({ job, recent, upcoming }) => (
              <View key={job.id} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.colorDot, { backgroundColor: job.color }]} />
                  <Text style={s.cardJobName}>{job.name}</Text>
                </View>

                {upcoming.length > 0 && (
                  <>
                    <Text style={s.gigGroupLabel}>UPCOMING</Text>
                    {upcoming.map(p => (
                      <View key={p.id} style={s.gigPaymentRow}>
                        <View>
                          <Text style={s.gigPaymentDate}>{shortDate(p.expectedDate)}</Text>
                          {!!p.description && <Text style={s.gigPaymentDesc}>{p.description}</Text>}
                        </View>
                        <Text style={[s.gigPaymentAmount, s.earnValue]}>${p.amount.toFixed(2)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {recent.length > 0 && (
                  <>
                    <Text style={[s.gigGroupLabel, { marginTop: upcoming.length > 0 ? 12 : 0 }]}>RECENT</Text>
                    {recent.map(p => (
                      <View key={p.id} style={s.gigPaymentRow}>
                        <View>
                          <Text style={[s.gigPaymentDate, s.recentDate]}>{shortDate(p.expectedDate)}</Text>
                          {!!p.description && <Text style={s.gigPaymentDesc}>{p.description}</Text>}
                        </View>
                        <Text style={s.gigPaymentAmount}>${p.amount.toFixed(2)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            ))}
          </>
        )}

        {/* ── Monthly breakdown ────────────────────────────────────────────── */}
        {(hasPayPeriodData || hasGigPayments) && monthlyEarnings.length > 0 && (
          <Text style={s.sectionHeader}>MONTHLY — {monthLabel(year, month).toUpperCase()}</Text>
        )}

        {monthlyEarnings.length === 0 && !hasGigPayments ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No shifts this month</Text>
            <Text style={s.emptySubtitle}>
              Add shifts on the Home or Week tab to see them here.
            </Text>
          </View>
        ) : (
          <>
            {monthlyEarnings.map(({ job, totalHours, gross, shiftCount }) => (
              <View key={job.id} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.colorDot, { backgroundColor: job.color }]} />
                  <Text style={s.cardJobName}>{job.name}</Text>
                  <Text style={s.cardRate}>
                    {job.hourlyRate != null ? `$${job.hourlyRate}/hr` : 'No rate set'}
                  </Text>
                </View>
                <View style={s.cardStats}>
                  <View style={s.stat}>
                    <Text style={s.statValue}>{totalHours.toFixed(1)}</Text>
                    <Text style={s.statLabel}>hours</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.stat}>
                    <Text style={s.statValue}>{shiftCount}</Text>
                    <Text style={s.statLabel}>shifts</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.stat}>
                    {gross != null ? (
                      <Text style={[s.statValue, s.earnValue]}>${gross.toFixed(2)}</Text>
                    ) : (
                      <Text style={[s.statValue, { color: COLORS.textMuted }]}>—</Text>
                    )}
                    <Text style={s.statLabel}>estimated</Text>
                  </View>
                </View>
              </View>
            ))}

            <View style={[s.card, s.totalCard]}>
              <Text style={s.totalLabel}>Total for {monthLabel(year, month)}</Text>
              <View style={s.cardStats}>
                <View style={s.stat}>
                  <Text style={s.statValue}>{totalHours.toFixed(1)}</Text>
                  <Text style={s.statLabel}>hours</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={[s.statValue, s.totalEarnValue]}>${totalGross.toFixed(2)}</Text>
                  <Text style={s.statLabel}>gross est.</Text>
                </View>
              </View>
              <Text style={s.disclaimer}>
                * Pre-tax estimate based on scheduled hours{hasGigPayments ? ' + expected gig payments' : ''}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border },
  exportBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.surfaceHigh },
  monthBtnText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  monthBtnChevron: { fontSize: 12, color: COLORS.textSecondary },
  content: { padding: 20, paddingBottom: 48, gap: 12 },

  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1.5, marginBottom: 4, marginTop: 4,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 20,
  },
  periodCard: {
    borderWidth: 1, borderColor: COLORS.accent + '33',
  },
  totalCard: {
    backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: COLORS.border,
    marginTop: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  cardJobName: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  cardRate: { fontSize: 13, color: COLORS.textSecondary },
  periodRange: { fontSize: 12, color: COLORS.textSecondary },
  cardStats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  earnValue: { color: COLORS.accent },
  totalEarnValue: { color: '#69f0ae', fontSize: 26 },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  disclaimer: { fontSize: 11, color: COLORS.textMuted, marginTop: 16, textAlign: 'center' },

  paydayLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 14, textAlign: 'center' },
  paydayDate: { color: COLORS.accent, fontWeight: '700' },

  // Gig payments
  gigGroupLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8 },
  gigPaymentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  gigPaymentDate: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  recentDate: { color: COLORS.textSecondary },
  gigPaymentDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  gigPaymentAmount: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  monthOption: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, minHeight: 48, justifyContent: 'center' },
  monthOptionSelected: { backgroundColor: COLORS.accent + '22', borderWidth: 1, borderColor: COLORS.accent + '66' },
  monthOptionText: { fontSize: 16, color: COLORS.textSecondary },
  monthOptionTextSelected: { color: COLORS.accent, fontWeight: '800' },
  modalClose: { marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceHigh, alignItems: 'center' },
  modalCloseText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
});
