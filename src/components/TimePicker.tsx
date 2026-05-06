import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { COLORS } from '../constants/colors';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function pad(n: number) { return String(n).padStart(2, '0'); }

interface Props {
  label: string;
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
}

export default function TimePicker({ label, hour, minute, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [tempH, setTempH] = useState(hour);
  const [tempM, setTempM] = useState(minute);

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;

  return (
    <>
      <TouchableOpacity
        style={s.field}
        onPress={() => { setTempH(hour); setTempM(minute); setVisible(true); }}
      >
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{`${h12}:${pad(minute)} ${ampm}`}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.card}>
            <Text style={s.modalTitle}>{label}</Text>
            <View style={s.row}>
              <ScrollView style={s.col} showsVerticalScrollIndicator={false}>
                {HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[s.item, tempH === h && s.itemSelected]}
                    onPress={() => setTempH(h)}
                  >
                    <Text style={[s.itemText, tempH === h && s.itemTextSelected]}>
                      {`${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={s.col} showsVerticalScrollIndicator={false}>
                {MINUTES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.item, tempM === m && s.itemSelected]}
                    onPress={() => setTempM(m)}
                  >
                    <Text style={[s.itemText, tempM === m && s.itemTextSelected]}>
                      {`:${pad(m)}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.buttons}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setVisible(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmBtn}
                onPress={() => { onChange(tempH, tempM); setVisible(false); }}
              >
                <Text style={s.confirmText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  field: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
  },
  label: { fontSize: 15, color: COLORS.textSecondary },
  value: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1, maxHeight: 220 },
  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  itemSelected: { backgroundColor: COLORS.surfaceHigh },
  itemText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  itemTextSelected: { color: COLORS.textPrimary, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceHigh, alignItems: 'center' },
  cancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' },
  confirmText: { fontSize: 15, color: COLORS.background, fontWeight: '700' },
});
