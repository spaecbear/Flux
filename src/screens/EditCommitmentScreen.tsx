import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, PALETTE } from '../constants/colors';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { JobType } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditCommitment'>;

export default function EditCommitmentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { jobs, saveJob } = useApp();

  const editingJob = route.params?.jobId
    ? jobs.find(j => j.id === route.params!.jobId)
    : undefined;

  const [name, setName] = useState(editingJob?.name ?? '');
  const [color, setColor] = useState(editingJob?.color ?? PALETTE[0].hex);
  const [type, setType] = useState<JobType>(editingJob?.type ?? 'regular');
  const [hourlyRate, setHourlyRate] = useState(
    editingJob?.hourlyRate != null ? String(editingJob.hourlyRate) : '',
  );
  const [nameError, setNameError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setNameError('Name is required'); return; }
    setNameError('');

    const rate = hourlyRate.trim() ? parseFloat(hourlyRate) : null;
    await saveJob({
      id: editingJob?.id ?? crypto.randomUUID(),
      name: name.trim(),
      color,
      type,
      hourlyRate: rate && !isNaN(rate) ? rate : null,
    });
    navigation.goBack();
  }

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

          {/* Color picker */}
          <Text style={s.label}>COLOR</Text>
          <View style={s.colorGrid}>
            {PALETTE.map(p => (
              <TouchableOpacity
                key={p.hex}
                style={[s.colorBtn, { backgroundColor: p.hex }, color === p.hex && s.colorBtnSelected]}
                onPress={() => setColor(p.hex)}
              >
                {color === p.hex && <Text style={s.colorCheckmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.paletteName}>{PALETTE.find(p => p.hex === color)?.label}</Text>

          {/* Type toggle */}
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
  content: { padding: 20, paddingBottom: 48 },
  label: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1.5, marginTop: 24, marginBottom: 8,
  },
  optional: { color: COLORS.textMuted, fontWeight: '400', fontSize: 11 },
  input: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.textPrimary,
    borderWidth: 1, borderColor: 'transparent',
  },
  inputError: { borderColor: COLORS.conflict },
  errorText: { fontSize: 12, color: COLORS.conflict, marginTop: 4 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorBtn: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  colorBtnSelected: {
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  colorCheckmark: { fontSize: 20, color: '#000', fontWeight: '900' },
  paletteName: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },
  toggle: {
    flexDirection: 'row', backgroundColor: COLORS.surfaceHigh,
    borderRadius: 12, padding: 4,
  },
  toggleOption: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleOptionSelected: { backgroundColor: COLORS.surface },
  toggleText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  toggleTextSelected: { color: COLORS.textPrimary },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateDollar: { fontSize: 20, color: COLORS.textSecondary, paddingLeft: 4 },
  rateInput: { flex: 1 },
  rateHr: { fontSize: 15, color: COLORS.textSecondary },
  saveBtn: {
    marginTop: 36, backgroundColor: COLORS.accent,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.background, letterSpacing: 0.5 },
});
