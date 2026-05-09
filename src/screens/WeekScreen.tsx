import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../context/AppContext';
import { allShiftsInWindow, formatTimeRange } from '../utils/conflicts';
import { COLORS } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Shift } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Date helpers ────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return the Sunday that starts the week containing `d`. */
function weekStart(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtMonthDay(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function fmtWeekRange(sun: Date): string {
  const sat = addDays(sun, 6);
  if (sun.getMonth() === sat.getMonth()) {
    return `${MONTH_ABBR[sun.getMonth()]} ${sun.getDate()}–${sat.getDate()}, ${sat.getFullYear()}`;
  }
  return `${fmtMonthDay(sun)} – ${fmtMonthDay(sat)}, ${sat.getFullYear()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WeekScreen() {
  const nav = useNavigation<Nav>();
  const { jobs, shifts, recurringShifts } = useApp();
  const insets = useSafeAreaInsets();

  const todayISO = isoDate(new Date());

  // Offset in weeks from current (0 = this week, -1 = last week, etc.)
  const [weekOffset, setWeekOffset] = useState(0);

  const sunday = useMemo(() => {
    const base = weekStart(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(sunday, i)),
    [sunday],
  );

  const fromISO = isoDate(sunday);
  const toISO = isoDate(days[6]);

  const weekShifts = useMemo(
    () => allShiftsInWindow(shifts, recurringShifts, fromISO, toISO),
    [shifts, recurringShifts, fromISO, toISO],
  );

  const jobMap = useMemo(
    () => new Map(jobs.map(j => [j.id, j])),
    [jobs],
  );

  // Group shifts by date, sorted by start time
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of weekShifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [weekShifts]);

  const isCurrentWeek = weekOffset === 0;

  function handleShiftPress(shift: Shift) {
    if (shift.isRecurring) return; // recurring virtual — no edit screen
    nav.navigate('AddShift', { shiftId: shift.id });
  }

  return (
    <View style={s.container}>
      {/* ── Week navigation header ── */}
      <View style={[s.weekNav, { paddingTop: (insets.top || (Platform.OS === 'ios' ? 44 : 16)) + 12 }]}>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => setWeekOffset(o => o - 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setWeekOffset(0)} activeOpacity={0.7}>
          <Text style={s.weekLabel}>{fmtWeekRange(sunday)}</Text>
          {!isCurrentWeek && (
            <Text style={s.returnHint}>tap to return to this week</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.navBtn}
          onPress={() => setWeekOffset(o => o + 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Day list ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {days.map(day => {
          const iso = isoDate(day);
          const isToday = iso === todayISO;
          const dayShifts = shiftsByDate.get(iso) ?? [];

          return (
            <View key={iso} style={[s.daySection, isToday && s.daySectionToday]}>
              {/* Day header */}
              <View style={s.dayHeader}>
                <View style={[s.dayBadge, isToday && s.dayBadgeToday]}>
                  <Text style={[s.dayAbbr, isToday && s.dayAbbrToday]}>
                    {DAY_ABBR[day.getDay()]}
                  </Text>
                  <Text style={[s.dayNum, isToday && s.dayNumToday]}>
                    {day.getDate()}
                  </Text>
                </View>
                {isToday && <Text style={s.todayPill}>TODAY</Text>}
                {dayShifts.length === 0 && (
                  <Text style={s.emptyHint}>no shifts</Text>
                )}
              </View>

              {/* Shift bars */}
              {dayShifts.map(shift => {
                const job = jobMap.get(shift.jobId);
                const color = job?.color ?? COLORS.textMuted;
                const isVirtual = shift.isRecurring;

                return (
                  <TouchableOpacity
                    key={shift.id}
                    activeOpacity={isVirtual ? 0.8 : 0.65}
                    onPress={() => handleShiftPress(shift)}
                    style={[s.shiftBar, { borderLeftColor: color }]}
                  >
                    <View style={[s.shiftColorDot, { backgroundColor: color }]} />
                    <View style={s.shiftInfo}>
                      <Text style={s.shiftJobName} numberOfLines={1}>
                        {job?.name ?? 'Unknown'}
                      </Text>
                      <Text style={s.shiftTime}>
                        {formatTimeRange(shift.startTime, shift.endTime)}
                      </Text>
                      {!!shift.notes && (
                        <Text style={s.shiftNotes} numberOfLines={1}>
                          {shift.notes}
                        </Text>
                      )}
                    </View>
                    {shift.confirmedConflict && (
                      <View style={s.conflictDot} />
                    )}
                    {isVirtual && (
                      <Text style={s.recurringBadge}>↻</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* Add a shift shortcut at bottom */}
        <TouchableOpacity
          style={s.addShiftBtn}
          onPress={() => nav.navigate('AddShift', {})}
        >
          <Text style={s.addShiftText}>+ Add Shift</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontSize: 28,
    color: COLORS.textPrimary,
    lineHeight: 32,
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  returnHint: {
    fontSize: 11,
    color: COLORS.accent,
    textAlign: 'center',
    marginTop: 2,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 8,
  },

  // Day section
  daySection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  daySectionToday: {
    borderColor: COLORS.accent + '55',
  },

  // Day header
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayBadge: {
    alignItems: 'center',
    minWidth: 36,
  },
  dayBadgeToday: {},
  dayAbbr: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.textMuted,
  },
  dayAbbrToday: {
    color: COLORS.accent,
  },
  dayNum: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  dayNumToday: {
    color: COLORS.textPrimary,
  },
  todayPill: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.accent,
    backgroundColor: COLORS.accent + '22',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: 'hidden',
  },
  emptyHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginLeft: 4,
  },

  // Shift bar
  shiftBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 3,
    gap: 10,
  },
  shiftColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shiftInfo: {
    flex: 1,
    gap: 2,
  },
  shiftJobName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  shiftTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  shiftNotes: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  conflictDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.conflict,
  },
  recurringBadge: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Add shift button
  addShiftBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addShiftText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
});
