import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sheet } from './Sheet';
import { C, PROFILES } from './theme';

// Goal 3 — use-case profile modes. Switching retunes the risk engine + daily goal.
export function ProfilePicker({ visible, onClose, profile, onSelect }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Use-case profile" subtitle="Tailors risk rules to your goal" accent={C.purple} maxHeight="70%">
      {Object.values(PROFILES).map((p) => {
        const active = p.key === profile;
        return (
          <TouchableOpacity
            key={p.key}
            style={[s.row, active && { borderColor: p.accent, backgroundColor: p.accent + '14' }]}
            onPress={() => { onSelect(p.key); onClose(); }}
          >
            <Text style={s.icon}>{p.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, active && { color: p.accent }]}>{p.label}</Text>
              <Text style={s.tagline}>{p.tagline}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.goal}>{p.goal}</Text>
              <Text style={s.goalUnit}>kcal/day</Text>
            </View>
            {active && <Text style={[s.check, { color: p.accent }]}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  icon:    { fontSize: 24, marginRight: 14 },
  label:   { color: C.text, fontSize: 16, fontWeight: '800' },
  tagline: { color: C.textDim, fontSize: 12, marginTop: 2 },
  goal:    { color: C.text, fontSize: 16, fontWeight: '800' },
  goalUnit:{ color: C.textFaint, fontSize: 10 },
  check:   { fontSize: 18, fontWeight: '900', marginLeft: 10 },
});
