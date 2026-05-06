import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Platform, Modal, SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { findConflicts, formatTimeRange } from '../utils/conflicts';
import { sendConflictNotification } from '../utils/notifications';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Shift } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddShift'>;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatTime24(h: number, m: number) { return `${pad(h)}:${pad(m)}`; }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Simple scroll-wheel style picker
function TimePicker({
  label, hour, minute, onChange,
}: { label: string; hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [tempH, setTempH] = useState(hour);
  const [tempM, setTempM] = useState(minute);

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;

  return (
    <>
      <TouchableOpacity style={s.pickerField} onPress={() => { setTempH(hour); setTempM(minute); setVisible(true); }}>
        <Text style={s.pickerLabel}>{label}</Text>
        <Text style={s.pickerValue}>{`${h12}:${pad(minute)} ${ampm}`}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{label}</Text>
            <View style={s.timePickerRow}>
              {/* Hour column */}
              <ScrollView style={s.pickerCol} showsVerticalScrollIndicator={false}>
                {HOURS.map(h => (
                  <TouchableOpacity key={h} style={[s.pickerItem, tempH === h && s.pickerItemSelected]} onPress={() => setTempH(h)}>
                    <Text style={[s.pickerItemText, tempH === h && s.pickerItemTextSelected]}>
                      {`${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* Minute column */}
              <ScrollView style={s.pickerCol} showsVerticalScrollIndicator={false}>
                {MINUTES.map(m => (
                  <TouchableOpacity key={m} style={[s.pickerItem, tempM === m && s.pickerItemSelected]} onPress={() => setTempM(m)}>
                    <Text style={[s.pickerItemText, tempM === m && s.pickerItemTextSelected]}>{`:${pad(m)}`}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setVisible(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={() => { onChange(tempH, tempM); setVisible(false); }}>
                <Text style={s.modalConfirmText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function DatePickerField({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [tempDate, setTempDate] = useState(date);

  // Build next 90 days
  const dates = useMemo(() => {
    const result: string[] = [];
    const d = new Date();
    d.setHours(0,0,0,0);
    for (let i = -30; i <= 90; i++) {
      const dt = new Date(d);
      dt.setDate(d.getDate() + i);
      result.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
    }
    return result;
  }, []);

  return (
    <>
      <TouchableOpacity style={s.pickerField} onPress={() => { setTempDate(date); setVisible(true); }}>
        <Text style={s.pickerLabel}>Date</Text>
        <Text style={s.pickerValue}>{isoToDisplay(date)}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Select Date</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {dates.map(d => (
                <TouchableOpacity key={d} style={[s.pickerItem, tempDate === d && s.pickerItemSelected]} onPress={() => setTempDate(d)}>
                  <Text style={[s.pickerItemText, tempDate === d && s.pickerItemTextSelected]}>{isoToDisplay(d)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setVisible(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={() => { onChange(tempDate); setVisible(false); }}>
                <Text style={s.modalConfirmText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function AddShiftScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { jobs, shifts, saveShift, removeShift } = useApp();

  const editingShift = route.params?.shiftId
    ? shifts.find(s => s.id === route.params!.shiftId)
    : undefined;

  const [jobId, setJobId] = useState(editingShift?.jobId ?? jobs[0]?.id ?? '');
  const [date, setDate] = useState(editingShift?.date ?? route.params?.prefillDate ?? todayISO());
  const [startH, setStartH] = useState(() => {
    const t = editingShift?.startTime ?? '09:00';
    return parseInt(t.split(':')[0]);
  });
  const [startM, setStartM] = useState(() => {
    const t = editingShift?.startTime ?? '09:00';
    return parseInt(t.split(':')[1]);
  });
  const [endH, setEndH] = useState(() => {
    const t = editingShift?.endTime ?? '17:00';
    return parseInt(t.split(':')[0]);
  });
  const [endM, setEndM] = useState(() => {
    const t = editingShift?.endTime ?? '17:00';
    return parseInt(t.split(':')[1]);
  });

  const [conflicts, setConflicts] = useState<ReturnType<typeof findConflicts>>([]);

  const candidateShift: Shift = useMemo(() => ({
    id: editingShift?.id ?? '__preview__',
    jobId,
    date,
    startTime: formatTime24(startH, startM),
    endTime: formatTime24(endH, endM),
    confirmedConflict: false,
  }), [jobId, date, startH, startM, endH, endM, editingShift]);

  useEffect(() => {
    const found = findConflicts(candidateShift, shifts, jobs);
    setConflicts(found);
  }, [candidateShift, shifts, jobs]);

  async function handleSave(confirmConflict = false) {
    if (!jobId) { Alert.alert('Select a commitment first'); return; }
    if (formatTime24(startH, startM) >= formatTime24(endH, endM)) {
      Alert.alert('End time must be after start time'); return;
    }

    if (conflicts.length > 0 && !confirmConflict) {
      const conflictJob = conflicts[0].job;
      const conflictShift = conflicts[0].shift;
      await sendConflictNotification(
        isoToDisplay(date),
        jobs.find(j => j.id === jobId)?.name ?? 'Unknown',
        conflictJob.name,
      ).catch(() => {}); // notifications may be denied

      Alert.alert(
        'Schedule Conflict',
        `Overlaps with ${conflictJob.name} (${formatTimeRange(conflictShift.startTime, conflictShift.endTime)})`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm Anyway', style: 'destructive', onPress: () => handleSave(true) },
        ],
      );
      return;
    }

    const shift: Shift = {
      id: editingShift?.id ?? crypto.randomUUID(),
      jobId,
      date,
      startTime: formatTime24(startH, startM),
      endTime: formatTime24(endH, endM),
      confirmedConflict: confirmConflict,
    };
    await saveShift(shift);
    navigation.goBack();
  }

  async function handleDelete() {
    if (!editingShift) return;
    Alert.alert('Delete Shift', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await removeShift(editingShift.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Commitment selector */}
        <Text style={s.sectionLabel}>COMMITMENT</Text>
        <View style={s.jobList}>
          {jobs.length === 0 ? (
            <Text style={s.noJobs}>No commitments yet. Add one first.</Text>
          ) : (
            jobs.map(job => (
              <TouchableOpacity
                key={job.id}
                style={[s.jobChip, jobId === job.id && s.jobChipSelected, { borderColor: job.color }]}
                onPress={() => setJobId(job.id)}
              >
                <View style={[s.jobDot, { backgroundColor: job.color }]} />
                <Text style={[s.jobChipText, jobId === job.id && { color: job.color }]}>{job.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Date */}
        <Text style={s.sectionLabel}>DATE</Text>
        <DatePickerField date={date} onChange={setDate} />

        {/* Times */}
        <Text style={s.sectionLabel}>TIME</Text>
        <TimePicker label="Start" hour={startH} minute={startM} onChange={(h, m) => { setStartH(h); setStartM(m); }} />
        <TimePicker label="End" hour={endH} minute={endM} onChange={(h, m) => { setEndH(h); setEndM(m); }} />

        {/* Conflict warning */}
        {conflicts.length > 0 && (
          <View style={s.conflictBox}>
            <Text style={s.conflictTitle}>⚠ Schedule Conflict</Text>
            {conflicts.map(c => (
              <Text key={c.shift.id} style={s.conflictText}>
                Overlaps with {c.job.name} ({formatTimeRange(c.shift.startTime, c.shift.endTime)})
              </Text>
            ))}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity style={s.saveBtn} onPress={() => handleSave()} activeOpacity={0.85}>
          <Text style={s.saveBtnText}>Save Shift</Text>
        </TouchableOpacity>

        {editingShift && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
            <Text style={s.deleteBtnText}>Delete Shift</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1.5, marginTop: 24, marginBottom: 8,
  },
  jobList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jobChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceHigh,
  },
  jobChipSelected: { backgroundColor: COLORS.surface },
  jobDot: { width: 8, height: 8, borderRadius: 4 },
  jobChipText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  noJobs: { color: COLORS.textMuted, fontSize: 14 },
  pickerField: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8,
  },
  pickerLabel: { fontSize: 15, color: COLORS.textSecondary },
  pickerValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  conflictBox: {
    marginTop: 16, padding: 16, borderRadius: 12,
    backgroundColor: COLORS.conflictDim, borderWidth: 1, borderColor: COLORS.conflict + '55',
  },
  conflictTitle: { fontSize: 14, fontWeight: '700', color: COLORS.conflict, marginBottom: 6 },
  conflictText: { fontSize: 13, color: COLORS.conflict + 'cc', lineHeight: 20 },
  saveBtn: {
    marginTop: 32, backgroundColor: COLORS.accent,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.background, letterSpacing: 0.5 },
  deleteBtn: {
    marginTop: 12, backgroundColor: COLORS.conflictDim,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.conflict + '44',
  },
  deleteBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.conflict },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  timePickerRow: { flexDirection: 'row', gap: 8 },
  pickerCol: { flex: 1, maxHeight: 220 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  pickerItemSelected: { backgroundColor: COLORS.surfaceHigh },
  pickerItemText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  pickerItemTextSelected: { color: COLORS.textPrimary, fontWeight: '700' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceHigh, alignItems: 'center' },
  modalCancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' },
  modalConfirmText: { fontSize: 15, color: COLORS.background, fontWeight: '700' },
});
