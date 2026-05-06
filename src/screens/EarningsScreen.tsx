import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Modal,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { shiftDurationHours } from '../utils/conflicts';

function pad(n: number) { return String(n).padStart(2, '0'); }

function monthLabel(year: number, month: number) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[month]} ${year}`;
}

function isoDateInRange(iso: string, startISO: string, endISO: string) {
  return iso >= startISO && iso <= endISO;
}

function monthStart(y: number, m: number) {
  return `${y}-${pad(m + 1)}-01`;
}
function monthEnd(y: number, m: number) {
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${pad(m + 1)}-${pad(lastDay)}`;
}

function MonthPickerModal({
  visible, year, month, onSelect, onClose,
}: {
  visible: boolean; year: number; month: number;
  onSelect: (y: number, m: number) => void; onClose: () => void;
}) {
  const now = new Date();
  const months = [];
  for (let i = -12; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Select Month</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {months.map(({ year: y, month: m }) => {
              const selected = y === year && m === month;
              return (
                <TouchableOpacity
                  key={`${y}-${m}`}
                  style={[s.monthOption, selected && s.monthOptionSelected]}
                  onPress={() => { onSelect(y, m); onClose(); }}
                >
                  <Text style={[s.monthOptionText, selected && s.monthOptionTextSelected]}>
                    {monthLabel(y, m)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function EarningsScreen() {
  const { jobs, shifts } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [pickerVisible, setPickerVisible] = useState(false);

  const startISO = monthStart(year, month);
  const endISO = monthEnd(year, month);

  const jobsWithRate = useMemo(() => jobs.filter(j => j.hourlyRate != null), [jobs]);

  const earnings = useMemo(() => {
    return jobsWithRate.map(job => {
      const jobShifts = shifts.filter(
        s => s.jobId === job.id && isoDateInRange(s.date, startISO, endISO),
      );
      const totalHours = jobShifts.reduce((sum, s) => sum + shiftDurationHours(s), 0);
      const gross = totalHours * (job.hourlyRate ?? 0);
      return { job, totalHours, gross, shiftCount: jobShifts.length };
    }).filter(e => e.shiftCount > 0 || true); // show all rated jobs even if no shifts
  }, [jobsWithRate, shifts, startISO, endISO]);

  const totalHours = earnings.reduce((s, e) => s + e.totalHours, 0);
  const totalGross = earnings.reduce((s, e) => s + e.gross, 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Earnings</Text>
        <TouchableOpacity style={s.monthBtn} onPress={() => setPickerVisible(true)}>
          <Text style={s.monthBtnText}>{monthLabel(year, month)}</Text>
          <Text style={s.monthBtnChevron}>▾</Text>
        </TouchableOpacity>
      </View>

      <MonthPickerModal
        visible={pickerVisible}
        year={year}
        month={month}
        onSelect={(y, m) => { setYear(y); setMonth(m); }}
        onClose={() => setPickerVisible(false)}
      />

      <ScrollView contentContainerStyle={s.content}>
        {jobsWithRate.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No hourly rates set</Text>
            <Text style={s.emptySubtitle}>
              Add an hourly rate to a commitment to see earnings estimates here.
            </Text>
          </View>
        ) : (
          <>
            {earnings.map(({ job, totalHours, gross, shiftCount }) => (
              <View key={job.id} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={[s.colorDot, { backgroundColor: job.color }]} />
                  <Text style={s.cardJobName}>{job.name}</Text>
                  <Text style={s.cardRate}>${job.hourlyRate}/hr</Text>
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
                    <Text style={s.statLabel}>estimated</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Total card */}
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
              <Text style={s.disclaimer}>* Pre-tax estimate based on scheduled hours</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 0.3 },
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.surfaceHigh },
  monthBtnText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  monthBtnChevron: { fontSize: 12, color: COLORS.textSecondary },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 20,
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
  cardStats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  earnValue: { color: COLORS.accent },
  totalEarnValue: { color: '#69f0ae', fontSize: 26 },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  disclaimer: { fontSize: 11, color: COLORS.textMuted, marginTop: 16, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  monthOption: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  monthOptionSelected: { backgroundColor: COLORS.surfaceHigh },
  monthOptionText: { fontSize: 16, color: COLORS.textSecondary },
  monthOptionTextSelected: { color: COLORS.textPrimary, fontWeight: '700' },
  modalClose: { marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceHigh, alignItems: 'center' },
  modalCloseText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
});
