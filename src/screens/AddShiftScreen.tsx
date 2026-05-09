import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, Platform, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { findConflicts, formatTimeRange, allShiftsInWindow } from '../utils/conflicts';
import { sendConflictNotification } from '../utils/notifications';
import TimePicker from '../components/TimePicker';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Shift, GigPayment } from '../types';
import { isoDate } from '../utils/payday';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddShift'>;

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatTime24(h: number, m: number) { return `${pad(h)}:${pad(m)}`; }

/** Single-button alert that works on both native and web (RN Web stubs Alert). */
function showAlert(msg: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    (globalThis as any).alert?.(msg);
  } else {
    Alert.alert(msg);
  }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weeksOut(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n * 7);
  return isoDate(d);
}

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isoToShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ITEM_HEIGHT = 44;

function DatePickerField({ date, onChange, rangeStart, rangeEnd }: {
  date: string; onChange: (d: string) => void;
  rangeStart?: number; rangeEnd?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [tempDate, setTempDate] = useState(date);
  const listRef = useRef<FlatList<string>>(null);

  const dates = useMemo(() => {
    const result: string[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const start = rangeStart ?? -365;
    const end = rangeEnd ?? 90;
    for (let i = start; i <= end; i++) {
      const dt = new Date(d);
      dt.setDate(d.getDate() + i);
      result.push(isoDate(dt));
    }
    return result;
  }, [rangeStart, rangeEnd]);

  function open() {
    setTempDate(date);
    setVisible(true);
    // Scroll to selected date after modal is visible
    const idx = dates.indexOf(date);
    if (idx >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.4 });
      }, 80);
    }
  }

  return (
    <>
      <TouchableOpacity style={s.pickerField} onPress={open}>
        <Text style={s.pickerLabel}>Date</Text>
        <Text style={s.pickerValue}>{isoToDisplay(date)}</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Select Date</Text>
            <FlatList
              ref={listRef}
              data={dates}
              keyExtractor={d => d}
              style={{ maxHeight: 280 }}
              getItemLayout={(_, index) => ({
                length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index,
              })}
              onScrollToIndexFailed={({ index }) => {
                // Fallback: scroll to nearest valid index
                listRef.current?.scrollToIndex({
                  index: Math.min(index, dates.length - 1),
                  animated: false,
                });
              }}
              renderItem={({ item: d }) => (
                <TouchableOpacity
                  style={[s.pickerItem, { height: ITEM_HEIGHT }, tempDate === d && s.pickerItemSelected]}
                  onPress={() => setTempDate(d)}
                >
                  <Text style={[s.pickerItemText, tempDate === d && s.pickerItemTextSelected]}>
                    {isoToDisplay(d)}
                  </Text>
                </TouchableOpacity>
              )}
            />
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
  const { jobs, shifts, recurringShifts, gigPayments, saveShift, removeShift, saveGigPayment, removeGigPayment } = useApp();

  const editingShift = route.params?.shiftId
    ? shifts.find(s => s.id === route.params!.shiftId)
    : undefined;

  const [jobId, setJobId] = useState(editingShift?.jobId ?? jobs[0]?.id ?? '');
  const [date, setDate] = useState(editingShift?.date ?? route.params?.prefillDate ?? todayISO());
  const [startH, setStartH] = useState(() => parseInt((editingShift?.startTime ?? '09:00').split(':')[0]));
  const [startM, setStartM] = useState(() => parseInt((editingShift?.startTime ?? '09:00').split(':')[1]));
  const [endH, setEndH]     = useState(() => parseInt((editingShift?.endTime ?? '17:00').split(':')[0]));
  const [endM, setEndM]     = useState(() => parseInt((editingShift?.endTime ?? '17:00').split(':')[1]));

  const [conflicts, setConflicts] = useState<ReturnType<typeof findConflicts>>([]);

  // ── Expected payment (gig jobs only) ─────────────────────────────────────
  const selectedJob = useMemo(() => jobs.find(j => j.id === jobId), [jobs, jobId]);
  const isGig = selectedJob?.type === 'gig';

  // Find existing payment linked to this shift (when editing)
  const existingPayment = useMemo(
    () => editingShift ? gigPayments.find(p => p.shiftId === editingShift.id) : undefined,
    [editingShift, gigPayments],
  );

  const [notes, setNotes] = useState(editingShift?.notes ?? '');
  const [flagged, setFlagged] = useState(editingShift?.flagged ?? false);

  const [paymentEnabled, setPaymentEnabled] = useState(!!existingPayment);
  const [payAmount, setPayAmount] = useState(existingPayment?.amount != null ? String(existingPayment.amount) : '');
  const [payDate, setPayDate] = useState(existingPayment?.expectedDate ?? weeksOut(2));
  const [payDesc, setPayDesc] = useState(existingPayment?.description ?? '');

  // Reset payment fields when switching jobs
  useEffect(() => {
    if (!isGig) {
      setPaymentEnabled(false);
    }
  }, [isGig]);

  const candidateShift: Shift = useMemo(() => ({
    id: editingShift?.id ?? '__preview__',
    jobId,
    date,
    startTime: formatTime24(startH, startM),
    endTime: formatTime24(endH, endM),
    confirmedConflict: false,
  }), [jobId, date, startH, startM, endH, endM, editingShift]);

  const allShiftsOnDate = useMemo(
    () => allShiftsInWindow(shifts, recurringShifts, date, date),
    [shifts, recurringShifts, date],
  );

  useEffect(() => {
    setConflicts(findConflicts(candidateShift, allShiftsOnDate, jobs));
  }, [candidateShift, allShiftsOnDate, jobs]);

  async function handleSave(confirmConflict = false) {
    if (!jobId) { showAlert('Select a commitment first.'); return; }
    if (formatTime24(startH, startM) >= formatTime24(endH, endM)) {
      showAlert('End time must be after start time.'); return;
    }

    if (conflicts.length > 0 && !confirmConflict) {
      const conflictJob   = conflicts[0].job;
      const conflictShift = conflicts[0].shift;
      await sendConflictNotification(
        isoToDisplay(date),
        jobs.find(j => j.id === jobId)?.name ?? 'Unknown',
        conflictJob.name,
      ).catch(() => {});

      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        if ((globalThis as any).confirm?.(
          `Schedule conflict: overlaps with ${conflictJob.name} (${formatTimeRange(conflictShift.startTime, conflictShift.endTime)}). Save anyway?`
        )) handleSave(true);
        return;
      }
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

    const shiftId = editingShift?.id ?? crypto.randomUUID();

    await saveShift({
      id: shiftId,
      jobId, date,
      startTime: formatTime24(startH, startM),
      endTime: formatTime24(endH, endM),
      confirmedConflict: confirmConflict,
      notes: notes.trim() || undefined,
      flagged: flagged || undefined,
    });

    // Handle gig payment
    if (isGig && paymentEnabled) {
      const amt = parseFloat(payAmount);
      if (!isNaN(amt) && amt > 0) {
        await saveGigPayment({
          id: existingPayment?.id ?? crypto.randomUUID(),
          jobId,
          shiftId,
          expectedDate: payDate,
          amount: amt,
          description: payDesc.trim(),
        });
      }
    } else if (existingPayment && (!isGig || !paymentEnabled)) {
      await removeGigPayment(existingPayment.id);
    }

    navigation.goBack();
  }

  async function handleDelete() {
    if (!editingShift) return;
    const doDelete = async () => {
      await removeShift(editingShift.id);
      navigation.goBack();
    };
    if (Platform.OS === 'web') {
      // Alert.alert is a no-op on RN Web — use native browser confirm
      // eslint-disable-next-line no-alert
      if ((globalThis as any).confirm?.('Delete this shift?')) await doDelete();
      return;
    }
    Alert.alert('Delete Shift', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

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
                {job.type === 'gig' && (
                  <Text style={s.gigBadge}>gig</Text>
                )}
                {job.ignoreOverlap && (
                  <Text style={s.ignoreBadge}>no flags</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={s.sectionLabel}>DATE</Text>
        <DatePickerField date={date} onChange={setDate} rangeStart={-365} rangeEnd={90} />

        <Text style={s.sectionLabel}>TIME</Text>
        <TimePicker label="Start" hour={startH} minute={startM}
          onChange={(h, m) => { setStartH(h); setStartM(m); }} />
        <TimePicker label="End" hour={endH} minute={endM}
          onChange={(h, m) => { setEndH(h); setEndM(m); }} />

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

        {/* ── Expected payment (gig jobs only) ─────────────────────────── */}
        {isGig && (
          <>
            <View style={s.paymentHeader}>
              <Text style={[s.sectionLabel, { marginTop: 0 }]}>EXPECTED PAYMENT</Text>
              <TouchableOpacity
                style={[s.paymentToggle, paymentEnabled && s.paymentToggleOn]}
                onPress={() => setPaymentEnabled(v => !v)}
              >
                <Text style={[s.paymentToggleText, paymentEnabled && s.paymentToggleTextOn]}>
                  {paymentEnabled ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>
            </View>

            {paymentEnabled && (
              <View style={s.paymentForm}>
                <View style={s.amountRow}>
                  <Text style={s.amountDollar}>$</Text>
                  <TextInput
                    style={s.amountInput}
                    value={payAmount}
                    onChangeText={setPayAmount}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>

                <View style={s.payDateRow}>
                  <Text style={s.payDateLabel}>Expected by</Text>
                  <View style={s.payDatePresets}>
                    {[
                      { label: '1 wk', n: 1 },
                      { label: '2 wks', n: 2 },
                      { label: '30 days', n: 4 },
                    ].map(({ label, n }) => {
                      const val = weeksOut(n);
                      return (
                        <TouchableOpacity
                          key={label}
                          style={[s.payPreset, payDate === val && s.payPresetSelected]}
                          onPress={() => setPayDate(val)}
                        >
                          <Text style={[s.payPresetText, payDate === val && s.payPresetTextSelected]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  style={s.payDateField}
                  onPress={() => {}}
                >
                  <DatePickerField date={payDate} onChange={setPayDate} rangeStart={0} rangeEnd={180} />
                </TouchableOpacity>

                <TextInput
                  style={[s.descInput, { marginTop: 8 }]}
                  value={payDesc}
                  onChangeText={setPayDesc}
                  placeholder="Description (optional)"
                  placeholderTextColor={COLORS.textMuted}
                  returnKeyType="done"
                />
              </View>
            )}
          </>
        )}

        <View style={s.notesSectionHeader}>
          <Text style={s.sectionLabel}>NOTES</Text>
          <TouchableOpacity
            style={[s.flagBtn, flagged && s.flagBtnOn]}
            onPress={() => setFlagged(v => !v)}
          >
            <Text style={[s.flagBtnIcon, flagged && s.flagBtnIconOn]}>⚑</Text>
            <Text style={[s.flagBtnLabel, flagged && s.flagBtnLabelOn]}>
              {flagged ? 'Flagged' : 'Flag'}
            </Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={s.notesInput}
          value={notes}
          onChangeText={t => setNotes(t.slice(0, 200))}
          placeholder="Address, reminders, anything useful…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="default"
          maxLength={200}
        />
        <Text style={[s.charCount, notes.length >= 180 && s.charCountWarn]}>
          {notes.length}/200
        </Text>

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
  gigBadge: {
    fontSize: 10, color: COLORS.accent,
    backgroundColor: COLORS.accent + '22', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  ignoreBadge: {
    fontSize: 10, color: COLORS.textMuted,
    backgroundColor: COLORS.surface, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  noJobs: { color: COLORS.textMuted, fontSize: 14 },
  pickerField: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
  },
  pickerLabel: { fontSize: 15, color: COLORS.textSecondary },
  pickerValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  conflictBox: {
    marginTop: 16, padding: 16, borderRadius: 12,
    backgroundColor: COLORS.conflictDim, borderWidth: 1, borderColor: COLORS.conflict + '55',
  },
  conflictTitle: { fontSize: 14, fontWeight: '700', color: COLORS.conflict, marginBottom: 6 },
  conflictText: { fontSize: 13, color: COLORS.conflict + 'cc', lineHeight: 20 },

  // Expected payment section
  paymentHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 24, marginBottom: 8,
  },
  paymentToggle: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border,
  },
  paymentToggleOn: { backgroundColor: COLORS.accent + '22', borderColor: COLORS.accent },
  paymentToggleText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  paymentToggleTextOn: { color: COLORS.accent },
  paymentForm: {
    backgroundColor: COLORS.surfaceHigh, borderRadius: 14, padding: 16, gap: 0,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surface, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  amountDollar: { fontSize: 22, color: COLORS.textSecondary },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  payDateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  payDateLabel: { fontSize: 13, color: COLORS.textSecondary },
  payDatePresets: { flexDirection: 'row', gap: 8 },
  payPreset: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  payPresetSelected: { backgroundColor: COLORS.accent + '22', borderWidth: 1, borderColor: COLORS.accent },
  payPresetText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  payPresetTextSelected: { color: COLORS.accent, fontWeight: '700' },
  payDateField: { marginBottom: 0 },
  descInput: {
    backgroundColor: COLORS.surface, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.textPrimary,
  },

  notesSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 24, marginBottom: 8,
  },
  flagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border,
  },
  flagBtnOn: {
    backgroundColor: '#ffd54f22', borderColor: '#ffd54f88',
  },
  flagBtnIcon: { fontSize: 13, color: COLORS.textMuted },
  flagBtnIconOn: { color: '#ffd54f' },
  flagBtnLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  flagBtnLabelOn: { color: '#ffd54f' },
  notesInput: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.textPrimary,
    minHeight: 80, lineHeight: 20,
  },
  charCount: {
    fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 4,
  },
  charCountWarn: { color: '#ffd54f' },
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
  // DatePicker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
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
