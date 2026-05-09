import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  SafeAreaView, StatusBar, Platform, Modal, ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { datesWithConflicts, shiftsForDate, formatTimeRange, allShiftsInWindow } from '../utils/conflicts';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const IS_WEB = Platform.OS === 'web';

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function formatSheetDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

// Web day-detail panel (replaces bottom sheet on web)
function DayPanel({
  visible, selectedDate, selectedShifts, jobMap, onClose, onAddShift, onShiftPress,
}: {
  visible: boolean;
  selectedDate: string | null;
  selectedShifts: ReturnType<typeof shiftsForDate>;
  jobMap: Map<string, any>;
  onClose: () => void;
  onAddShift: () => void;
  onShiftPress: (shiftId: string) => void;
}) {
  if (!visible || !selectedDate) return null;
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.webOverlay} onPress={onClose}>
        <Pressable style={s.webPanel} onPress={e => e.stopPropagation()}>
          <View style={s.webPanelHandle} />
          <View style={s.sheetHeader}>
            <Text style={s.sheetDate}>{formatSheetDate(selectedDate)}</Text>
            <TouchableOpacity style={s.sheetAddBtn} onPress={onAddShift}>
              <Text style={s.sheetAddText}>+ Shift</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {selectedShifts.length === 0 ? (
              <Text style={s.emptyText}>No shifts scheduled</Text>
            ) : (
              selectedShifts.map(shift => {
                const job = jobMap.get(shift.jobId);
                if (!job) return null;
                return (
                  <TouchableOpacity
                    key={shift.id}
                    style={s.shiftCard}
                    onPress={() => onShiftPress(shift.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.shiftColorBar, { backgroundColor: job.color }]} />
                    <View style={s.shiftInfo}>
                      <Text style={s.shiftJobName}>{job.name}</Text>
                      <Text style={s.shiftTime}>{formatTimeRange(shift.startTime, shift.endTime)}</Text>
                      {!!shift.notes && (
                        <Text style={s.shiftNotes} numberOfLines={2}>{shift.notes}</Text>
                      )}
                    </View>
                    {!!shift.flagged && (
                      <Text style={s.flagBadge}>⚑</Text>
                    )}
                    {shift.confirmedConflict && (
                      <View style={s.conflictBadge}><Text style={s.conflictBadgeText}>!</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { jobs, shifts, recurringShifts } = useApp();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['42%', '72%'], []);

  const jobMap = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);
  const rows = useMemo(() => getMonthGrid(year, month), [year, month]);
  const todayISO = toISODate(now.getFullYear(), now.getMonth(), now.getDate());

  // Merge manual + recurring shifts for the visible month window
  const monthFromISO = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthToISO   = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate().toString().padStart(2, '0')}`;
  const allMonthShifts = useMemo(
    () => allShiftsInWindow(shifts, recurringShifts, monthFromISO, monthToISO),
    [shifts, recurringShifts, monthFromISO, monthToISO],
  );

  const conflictDates = useMemo(() => datesWithConflicts(allMonthShifts, jobs), [allMonthShifts, jobs]);

  const selectedShifts = useMemo(() =>
    selectedDate ? shiftsForDate(allMonthShifts, selectedDate) : [],
    [allMonthShifts, selectedDate]);

  const prevMonth = useCallback(() => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }, [month]);

  const onDayPress = useCallback((day: number) => {
    const iso = toISODate(year, month, day);
    setSelectedDate(iso);
    if (IS_WEB) {
      setSheetOpen(true);
    } else {
      sheetRef.current?.expand();
    }
  }, [year, month]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    sheetRef.current?.close();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    [],
  );

  const shiftContent = (
    <>
      <View style={s.sheetHeader}>
        <Text style={s.sheetDate}>{selectedDate ? formatSheetDate(selectedDate) : ''}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddShift', { prefillDate: selectedDate ?? undefined })}
          style={s.sheetAddBtn}
        >
          <Text style={s.sheetAddText}>+ Shift</Text>
        </TouchableOpacity>
      </View>
      {selectedShifts.length === 0 ? (
        <Text style={s.emptyText}>No shifts scheduled</Text>
      ) : (
        selectedShifts.map(shift => {
          const job = jobMap.get(shift.jobId);
          if (!job) return null;
          return (
            <TouchableOpacity
              key={shift.id}
              style={s.shiftCard}
              onPress={() => navigation.navigate('AddShift', { shiftId: shift.id })}
              activeOpacity={0.8}
            >
              <View style={[s.shiftColorBar, { backgroundColor: job.color }]} />
              <View style={s.shiftInfo}>
                <Text style={s.shiftJobName}>{job.name}</Text>
                <Text style={s.shiftTime}>{formatTimeRange(shift.startTime, shift.endTime)}</Text>
              </View>
              {shift.confirmedConflict && (
                <View style={s.conflictBadge}><Text style={s.conflictBadgeText}>!</Text></View>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.appTitle}>FLUX</Text>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn} hitSlop={8}>
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn} hitSlop={8}>
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Day labels */}
        <View style={s.dayLabels}>
          {DAY_LABELS.map(d => (
            <Text key={d} style={s.dayLabel}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid — uses flex so cells fill width naturally */}
        <View style={s.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((day, ci) => {
                if (!day) return <View key={ci} style={s.cell} />;
                const iso = toISODate(year, month, day);
                const isToday = iso === todayISO;
                const isSelected = iso === selectedDate;
                const hasConflict = conflictDates.has(iso);
                const dayShifts = shiftsForDate(allMonthShifts, iso);
                const dotColors = [...new Set(dayShifts.map(sv => jobMap.get(sv.jobId)?.color).filter(Boolean))];

                return (
                  <Pressable
                    key={ci}
                    style={[s.cell, isSelected && s.cellSelected, isToday && !isSelected && s.cellToday]}
                    onPress={() => onDayPress(day)}
                  >
                    <Text style={[s.dayNum, isToday && s.dayNumToday, isSelected && s.dayNumSelected]}>
                      {day}
                    </Text>
                    {dotColors.length > 0 && (
                      <View style={s.dots}>
                        {dotColors.slice(0, 4).map((color, i) => (
                          <View key={i} style={[s.dot, { backgroundColor: color as string }]} />
                        ))}
                      </View>
                    )}
                    {hasConflict && <View style={s.conflictDot} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* FAB */}
        <TouchableOpacity
          style={s.fab}
          onPress={() => navigation.navigate('AddShift', {})}
          activeOpacity={0.85}
        >
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Web: Modal panel */}
      {IS_WEB && (
        <DayPanel
          visible={sheetOpen}
          selectedDate={selectedDate}
          selectedShifts={selectedShifts}
          jobMap={jobMap}
          onClose={closeSheet}
          onAddShift={() => {
            closeSheet();
            navigation.navigate('AddShift', { prefillDate: selectedDate ?? undefined });
          }}
          onShiftPress={id => {
            closeSheet();
            navigation.navigate('AddShift', { shiftId: id });
          }}
        />
      )}

      {/* Native: Bottom sheet */}
      {!IS_WEB && (
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={s.sheetBg}
          handleIndicatorStyle={s.sheetHandle}
        >
          <BottomSheetView style={s.sheetContent}>
            {shiftContent}
          </BottomSheetView>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 4,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: { padding: 4 },
  navArrow: { fontSize: 24, color: COLORS.textPrimary, lineHeight: 28 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, minWidth: 140, textAlign: 'center' },
  dayLabels: { flexDirection: 'row', marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  // Grid fills all remaining vertical space; rows split that space equally;
  // cells fill each row — no fixed sizes, so the calendar grows with the device.
  grid: { flex: 1, flexDirection: 'column' },
  row: { flex: 1, flexDirection: 'row' },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cellSelected: { backgroundColor: COLORS.surfaceHigh },
  cellToday: { borderWidth: 1, borderColor: COLORS.accent + '55' },
  dayNum: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  dayNumToday: { color: COLORS.accent, fontWeight: '700' },
  dayNumSelected: { color: COLORS.textPrimary },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 3, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  conflictDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: COLORS.conflict,
    position: 'absolute', top: 4, right: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 4,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: COLORS.background, fontWeight: '300', lineHeight: 34 },
  // Native bottom sheet
  sheetBg: { backgroundColor: COLORS.surface },
  sheetHandle: { backgroundColor: COLORS.border },
  sheetContent: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  // Web modal panel
  webOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  webPanel: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 48,
    maxHeight: '70%',
  },
  webPanelHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  // Shared sheet content
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetDate: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  sheetAddBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.surfaceHigh },
  sheetAddText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: 32 },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  shiftColorBar: { width: 4, alignSelf: 'stretch' },
  shiftInfo: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  shiftJobName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  shiftTime: { fontSize: 13, color: COLORS.textSecondary },
  shiftNotes: { fontSize: 12, color: COLORS.textMuted, marginTop: 3, fontStyle: 'italic', lineHeight: 17 },
  flagBadge: { fontSize: 16, color: '#ffd54f', marginLeft: 4 },
  conflictBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.conflict,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  conflictBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
