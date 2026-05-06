import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Job } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function JobRow({ job, onPress, onDelete }: { job: Job; onPress: () => void; onDelete: () => void }) {
  return (
    <View style={s.row}>
      {/* Tapping the swatch + info area opens the edit screen */}
      <TouchableOpacity style={s.rowEditArea} onPress={onPress} activeOpacity={0.7}>
        <View style={[s.colorSwatch, { backgroundColor: job.color }]} />
        <View style={s.rowInfo}>
          <Text style={s.jobName} numberOfLines={1}>{job.name}</Text>
          <Text style={s.jobMeta} numberOfLines={1}>
            {job.type === 'gig' ? 'Gig' : 'Regular'}
            {job.hourlyRate != null ? ` · $${job.hourlyRate}/hr` : ''}
          </Text>
        </View>
      </TouchableOpacity>
      {/* Delete sits outside the edit touchable so both work independently */}
      <TouchableOpacity style={s.deleteBtn} onPress={onDelete} hitSlop={12}>
        <Text style={s.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CommitmentsScreen() {
  const navigation = useNavigation<Nav>();
  const { jobs, removeJob } = useApp();

  function confirmDelete(job: Job) {
    Alert.alert(
      `Delete "${job.name}"?`,
      'All shifts for this commitment will also be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeJob(job.id) },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Commitments</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => navigation.navigate('EditCommitment', {})}
          activeOpacity={0.85}
        >
          <Text style={s.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {jobs.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No commitments yet</Text>
          <Text style={s.emptySubtitle}>Add your jobs, classes, or gigs to get started.</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => navigation.navigate('EditCommitment', {})}
          >
            <Text style={s.emptyBtnText}>Add first commitment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={j => j.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <JobRow
              job={item}
              onPress={() => navigation.navigate('EditCommitment', { jobId: item.id })}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
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
  addBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, backgroundColor: COLORS.surfaceHigh,
  },
  addBtnText: { fontSize: 14, color: COLORS.accent, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rowEditArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  colorSwatch: { width: 40, height: 40, borderRadius: 10 },
  rowInfo: { flex: 1 },
  jobName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  jobMeta: { fontSize: 13, color: COLORS.textSecondary },
  deleteBtn: { paddingHorizontal: 16, paddingVertical: 20 },
  deleteBtnText: { fontSize: 16, color: COLORS.textMuted },
  separator: { height: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyBtn: {
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 12, backgroundColor: COLORS.accent,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.background },
});
