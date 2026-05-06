import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Switch, Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, PALETTE } from '../constants/colors';
import { useApp } from '../context/AppContext';
import TimePicker from '../components/TimePicker';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { JobType, RecurringShift, PayFrequency } from '../types';
import { getNextPayday, formatPeriod, getCurrentPeriod, FREQ_LABELS, isoDate } from '../utils/payday';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditCommitment'>;

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthsLater(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DatePickerModal({
  visible, value, onSelect, onClose, rangeStart, rangeEnd,
}: {
  visible: boolean; value: string;
  onSelect: (d: string) => void; onClose: () => void;
  rangeStart?: number; rangeEnd?: number;
}) {
  const dates: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = (rangeStart ?? -90); i <= (rangeEnd ?? 30); i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(isoDate(d));
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Select Date</Text>
          <ScrollView style={{ maxHeight: 280 }}>
            {dates.map(d => (
              <TouchableOpacity
                key={d}
                style={[s.pickerItem, value === d && s.pickerItemSelected]}
                onPress={() => { onSelect(d); onClose(); }}
              >
                <Text style={[s.pickerItemText, value === d && s.pickerItemTextSelected]}>
                  {isoToShort(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function EditCommitmentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { jobs, recurringShifts, saveJob, saveRecurringShift, removeRecurringShift } = useApp();

  const editingJob = route.params?.jobId
    ? jobs.find(j => j.id === route.params!.jobId)
    : undefined;

  const existingRule = editingJob
    ? recurringShifts.find(r => r.jobId === editingJob.id)
    : undefined;

  // ── Commitment fields ──────────────────────────────────────────────────────
  const [name, setName] = useState(editingJob?.name ?? '');
  const [color, setColor] = useState(editingJob?.color ?? PALETTE[0].hex);
  const [type, setType] = useState<JobType>(editingJob?.type ?? 'regular');
  const [hourlyRate, setHourlyRate] = useState(
    editingJob?.hourlyRate != null ? String(editingJob.hourlyRate) : '',
  );
  const [ignoreOverlap, setIgnoreOverlap] = useState(editingJob?.ignoreOverlap ?? false);
  const [nameError, setNameError] = useState('');

  // ── Pay schedule (regular jobs only) ──────────────────────────────────────
  const [payScheduleEnabled, setPayScheduleEnabled] = useState(!!editingJob?.paySchedule);
  const [payFreq, setPayFreq] = useState<PayFrequency>(editingJob?.paySchedule?.frequency ?? 'biweekly');
  const [payAnchor, setPayAnchor] = useState(editingJob?.paySchedule?.anchorDate ?? todayISO());
  const [anchorPickerVisible, setAnchorPickerVisible] = useState(false);

  // ── Recurring schedule fields ──────────────────────────────────────────────
  const [recurringEnabled, setRecurringEnabled] = useState(!!existingRule);
  const [selectedDays, setSelectedDays] = useState<number[]>(existingRule?.daysOfWeek ?? WEEKDAYS);
  const [recStartH, setRecStartH] = useState(() => parseInt((existingRule?.startTime ?? '09:00').split(':')[0]));
  const [recStartM, setRecStartM] = useState(() => parseInt((existingRule?.startTime ?? '09:00').split(':')[1]));
  const [recEndH, setRecEndH] = useState(() => parseInt((existingRule?.endTime ?? '17:00').split(':')[0]));
  const [recEndM, setRecEndM] = useState(() => parseInt((existingRule?.endTime ?? '17:00').split(':')[1]));
  const [recStartDate, setRecStartDate] = useState(existingRule?.startDate ?? todayISO());
  const [recEndDate, setRecEndDate] = useState<string | null>(existingRule?.endDate ?? null);

  function toggleDay(d: number) {
    setSelectedDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort(),
    );
  }

  async function handleSave() {
    if (!name.trim()) { setNameError('Name is required'); return; }
    setNameError('');

    const rate = hourlyRate.trim() ? parseFloat(hourlyRate) : null;
    const jobId = editingJob?.id ?? crypto.randomUUID();

    await saveJob({
      id: jobId,
      name: name.trim(),
      color,
      type,
      hourlyRate: rate && !isNaN(rate) ? rate : null,
      ignoreOverlap,
      paySchedule: type === 'regular' && payScheduleEnabled
        ? { frequency: payFreq, anchorDate: payAnchor }
        : null,
    });

    if (recurringEnabled && selectedDays.length > 0) {
      const rule: RecurringShift = {
        id: existingRule?.id ?? crypto.randomUUID(),
        jobId,
        daysOfWeek: selectedDays,
        startTime: `${pad(recStartH)}:${pad(recStartM)}`,
        endTime: `${pad(recEndH)}:${pad(recEndM)}`,
        startDate: recStartDate,
        endDate: recEndDate,
      };
      await saveRecurringShift(rule);
    } else if (!recurringEnabled && existingRule) {
      await removeRecurringShift(existingRule.id);
    }

    navigation.goBack();
  }

  const nextPayday = payScheduleEnabled
    ? getNextPayday({ frequency: payFreq, anchorDate: payAnchor }, todayISO())
    : null;
  const currentPeriod = payScheduleEnabled
    ? getCurrentPeriod({ frequency: payFreq, anchorDate: payAnchor }, todayISO())
    : null;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Name */}
          <Text style={s.label}>NAME</Text>
          <TextInput
            style={[s.input, nameError ? s.inputError : null]}
            value={name}
            onChangeText={t => { setName(t); setNameError(''); }}
            placeholder="e.g. Barista, CS 101, DoorDash..."
            placeholderTextColor={COLORS.textMuted}
            autoFocus={!editingJob}
            returnKeyType="done"
          />
          {!!nameError && <Text style={s.errorText}>{nameError}</Text>}

          {/* Color */}
          <Text style={s.label}>COLOR</Text>
          <View style={s.colorGrid}>
            {PALETTE.map(p => (
              <TouchableOpacity
                key={p.hex}
                style={[s.colorBtn, { backgroundColor: p.hex }, color === p.hex && s.colorBtnSelected]}
                onPress={() => setColor(p.hex)}
              >
                {color === p.hex && <Text style={s.colorCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.paletteName}>{PALETTE.find(p => p.hex === color)?.label}</Text>

          {/* Type */}
          <Text style={s.label}>TYPE</Text>
          <View style={s.toggle}>
            <TouchableOpacity
              style={[s.toggleOption, type === 'regular' && s.toggleOptionSelected]}
              onPress={() => setType('regular')}
            >
              <Text style={[s.toggleText, type === 'regular' && s.toggleTextSelected]}>Regular</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleOption, type === 'gig' && s.toggleOptionSelected]}
              onPress={() => setType('gig')}
            >
              <Text style={[s.toggleText, type === 'gig' && s.toggleTextSelected]}>Gig</Text>
            </TouchableOpacity>
          </View>

          {/* Hourly rate */}
          <Text style={s.label}>HOURLY RATE <Text style={s.optional}>(optional)</Text></Text>
          <View style={s.rateRow}>
            <Text style={s.rateDollar}>$</Text>
            <TextInput
              style={[s.input, s.rateInput]}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text style={s.rateHr}>/hr</Text>
          </View>

          {/* ── Conflict settings ─────────────────────────────────────────── */}
          <View style={s.sectionDivider} />
          <Text style={s.sectionTitle}>CONFLICT SETTINGS</Text>

          <View style={s.switchRow}>
            <View style={s.switchInfo}>
              <Text style={s.switchLabel}>Ignore overlap warnings</Text>
              <Text style={s.switchSubLabel}>
                This commitment's shifts won't trigger conflict alerts
              </Text>
            </View>
            <Switch
              value={ignoreOverlap}
              onValueChange={setIgnoreOverlap}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
              thumbColor={ignoreOverlap ? COLORS.accent : COLORS.textMuted}
            />
          </View>

          {/* ── Pay schedule (regular jobs only) ─────────────────────────── */}
          {type === 'regular' && (
            <>
              <View style={s.sectionDivider} />
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>PAY SCHEDULE</Text>
                <Switch
                  value={payScheduleEnabled}
                  onValueChange={setPayScheduleEnabled}
                  trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
                  thumbColor={payScheduleEnabled ? COLORS.accent : COLORS.textMuted}
                />
              </View>
              <Text style={s.sectionSubLabel}>
                Earnings tab will show hours &amp; estimated pay for your current pay period.
              </Text>

              {payScheduleEnabled && (
                <>
                  <Text style={s.label}>FREQUENCY</Text>
                  <View style={s.freqGrid}>
                    {FREQUENCIES.map(f => (
                      <TouchableOpacity
                        key={f}
                        style={[s.freqBtn, payFreq === f && s.freqBtnSelected]}
                        onPress={() => setPayFreq(f)}
                      >
                        <Text style={[s.freqBtnText, payFreq === f && s.freqBtnTextSelected]}>
                          {FREQ_LABELS[f]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>LAST PAYDAY (anchor)</Text>
                  <TouchableOpacity style={s.dateFieldBtn} onPress={() => setAnchorPickerVisible(true)}>
                    <Text style={s.dateFieldLabel}>A confirmed recent payday</Text>
                    <Text style={s.dateFieldValue}>{isoToShort(payAnchor)}</Text>
                  </TouchableOpacity>

                  {currentPeriod && (
                    <View style={s.payPreview}>
                      <View style={s.payPreviewRow}>
                        <Text style={s.payPreviewKey}>Current period</Text>
                        <Text style={s.payPreviewVal}>{formatPeriod(currentPeriod.start, currentPeriod.end)}</Text>
                      </View>
                      <View style={s.payPreviewRow}>
                        <Text style={s.payPreviewKey}>Next payday</Text>
                        <Text style={[s.payPreviewVal, { color: COLORS.accent }]}>{isoToShort(nextPayday!)}</Text>
                      </View>
                    </View>
                  )}

                  <DatePickerModal
                    visible={anchorPickerVisible}
                    value={payAnchor}
                    onSelect={setPayAnchor}
                    onClose={() => setAnchorPickerVisible(false)}
                    rangeStart={-60}
                    rangeEnd={0}
                  />
                </>
              )}
            </>
          )}

          {/* ── Recurring schedule ────────────────────────────────────────── */}
          <View style={s.sectionDivider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>RECURRING SCHEDULE</Text>
            <Switch
              value={recurringEnabled}
              onValueChange={setRecurringEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
              thumbColor={recurringEnabled ? COLORS.accent : COLORS.textMuted}
            />
          </View>

          {recurringEnabled && (
            <>
              <Text style={s.label}>DAYS</Text>
              <View style={s.dayRow}>
                {DAY_LABELS.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayPill, selectedDays.includes(i) && s.dayPillSelected]}
                    onPress={() => toggleDay(i)}
                  >
                    <Text style={[s.dayPillText, selectedDays.includes(i) && s.dayPillTextSelected]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.presetRow}>
                {[
                  { label: 'Weekdays', days: [1,2,3,4,5] },
                  { label: 'Weekend', days: [0,6] },
                  { label: 'MWF', days: [1,3,5] },
                  { label: 'TR', days: [2,4] },
                ].map(({ label: pl, days }) => (
                  <TouchableOpacity
                    key={pl}
                    style={s.preset}
                    onPress={() => setSelectedDays(days)}
                  >
                    <Text style={s.presetText}>{pl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>SHIFT HOURS</Text>
              <TimePicker label="Start" hour={recStartH} minute={recStartM}
                onChange={(h, m) => { setRecStartH(h); setRecStartM(m); }} />
              <TimePicker label="End" hour={recEndH} minute={recEndM}
                onChange={(h, m) => { setRecEndH(h); setRecEndM(m); }} />

              <Text style={s.label}>DATE RANGE</Text>
              <View style={s.dateRangeRow}>
                <View style={s.dateField}>
                  <Text style={s.dateFieldLabel}>From</Text>
                  <Text style={s.dateFieldValue}>{recStartDate}</Text>
                </View>
                <Text style={s.dateArrow}>→</Text>
                <View style={s.dateField}>
                  <Text style={s.dateFieldLabel}>Until</Text>
                  <Text style={s.dateFieldValue}>{recEndDate ?? 'Ongoing'}</Text>
                </View>
              </View>
              <View style={s.endDatePresets}>
                {[
                  { label: 'Ongoing', value: null },
                  { label: '1 month', value: monthsLater(1) },
                  { label: '3 months', value: monthsLater(3) },
                  { label: '6 months', value: monthsLater(6) },
                  { label: '1 year', value: monthsLater(12) },
                ].map(({ label: pl, value }) => (
                  <TouchableOpacity
                    key={pl}
                    style={[s.preset, recEndDate === value && s.presetSelected]}
                    onPress={() => setRecEndDate(value)}
                  >
                    <Text style={[s.presetText, recEndDate === value && s.presetTextSelected]}>
                      {pl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>
              {editingJob ? 'Save Changes' : 'Add Commitment'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },

  label: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1.5, marginTop: 24, marginBottom: 8,
  },
  optional: { color: COLORS.textMuted, fontWeight: '400', fontSize: 11 },

  input: {
    backgroundColor: COLORS.surfaceHigh, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.textPrimary,
    borderWidth: 1, borderColor: 'transparent',
  },
  inputError: { borderColor: COLORS.conflict },
  errorText: { fontSize: 12, color: COLORS.conflict, marginTop: 4 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  colorBtnSelected: { shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 },
  colorCheck: { fontSize: 20, color: '#000', fontWeight: '900' },
  paletteName: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },

  toggle: { flexDirection: 'row', backgroundColor: COLORS.surfaceHigh, borderRadius: 12, padding: 4 },
  toggleOption: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleOptionSelected: { backgroundColor: COLORS.surface },
  toggleText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  toggleTextSelected: { color: COLORS.textPrimary },

  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateDollar: { fontSize: 20, color: COLORS.textSecondary, paddingLeft: 4 },
  rateInput: { flex: 1 },
  rateHr: { fontSize: 15, color: COLORS.textSecondary },

  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginTop: 28, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1.5, marginTop: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionSubLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 17 },

  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  switchInfo: { flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  switchSubLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },

  // Frequency grid
  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, backgroundColor: COLORS.surfaceHigh,
    borderWidth: 1, borderColor: 'transparent',
  },
  freqBtnSelected: { backgroundColor: COLORS.accent + '22', borderColor: COLORS.accent },
  freqBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  freqBtnTextSelected: { color: COLORS.accent },

  // Date field
  dateFieldBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dateFieldLabel: { fontSize: 13, color: COLORS.textSecondary },
  dateFieldValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },

  // Pay preview
  payPreview: {
    marginTop: 12, padding: 14, borderRadius: 12,
    backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  payPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payPreviewKey: { fontSize: 12, color: COLORS.textMuted },
  payPreviewVal: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700' },

  dayRow: { flexDirection: 'row', gap: 6 },
  dayPill: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.surfaceHigh, alignItems: 'center',
  },
  dayPillSelected: { backgroundColor: COLORS.accent + '22', borderWidth: 1, borderColor: COLORS.accent },
  dayPillText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  dayPillTextSelected: { color: COLORS.accent },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  endDatePresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  preset: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: COLORS.surfaceHigh,
  },
  presetSelected: { backgroundColor: COLORS.accent + '22', borderWidth: 1, borderColor: COLORS.accent },
  presetText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  presetTextSelected: { color: COLORS.accent, fontWeight: '700' },

  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  dateField: {
    flex: 1, backgroundColor: COLORS.surfaceHigh,
    borderRadius: 10, padding: 12,
  },
  dateArrow: { fontSize: 18, color: COLORS.textMuted },

  saveBtn: {
    marginTop: 36, backgroundColor: COLORS.accent,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.background, letterSpacing: 0.5 },

  // Date picker modal
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
  modalClose: { marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceHigh, alignItems: 'center' },
  modalCloseText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
});
