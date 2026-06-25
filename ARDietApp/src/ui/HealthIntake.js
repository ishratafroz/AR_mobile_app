import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Sheet } from './Sheet';
import { C, PROFILES, SEX_OPTIONS, CONDITIONS, ALLERGENS, BLOOD_GROUPS } from './theme';
import { REGIONS } from '../data/Cuisines';

// Full health intake (recommendation engine). Captures who the user is so the
// good/risky verdict and recommendations can be personalized. Saved on-device.
export const EMPTY_USER = {
  name: '',
  age: '', sex: null, heightCm: '', weightKg: '',
  focus: 'general', conditions: [], allergies: [], dailyGoal: 2000,
  // Vitals & labs (used by the clinical-aware recommendation layer)
  bloodGroup: null,
  glucose: '',        // last fasting blood sugar, mg/dL
  bpSystolic: '',     // last measured BP, mmHg
  bpDiastolic: '',
  pulse: '',          // resting pulse, bpm
  notes: '',          // anything else relevant
};

export function bmiOf(user) {
  const h = parseFloat(user?.heightCm), w = parseFloat(user?.weightKg);
  if (!h || !w) return null;
  const b = w / Math.pow(h / 100, 2);
  return Math.round(b * 10) / 10;
}

export function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return { label: 'Underweight', color: C.amber };
  if (bmi < 25)   return { label: 'Healthy',     color: C.green };
  if (bmi < 30)   return { label: 'Overweight',  color: C.amber };
  return { label: 'Obese', color: C.red };
}

const num = (v) => (v === '' || v == null ? null : Number(v));

export function HealthIntake({ visible, onClose, user, onSave, username, onLogout, region = 'global', onRegionChange }) {
  const [form, setForm] = useState(EMPTY_USER);

  // Re-sync the form when the sheet opens AND whenever `user` changes (e.g. a
  // Health Connect sync updates height/weight/BP/glucose while the profile is open).
  useEffect(() => {
    if (visible) setForm({ ...EMPTY_USER, ...(user || {}) });
  }, [visible, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (k, v) => setForm(f => {
    const arr = f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v];
    return { ...f, [k]: arr };
  });

  const bmi = bmiOf(form);
  const bmiCat = bmiCategory(bmi);

  function pickFocus(key) {
    // adopt that focus' default daily goal unless the user typed a custom one
    setForm(f => ({ ...f, focus: key, dailyGoal: PROFILES[key]?.goal ?? f.dailyGoal }));
  }

  function save() {
    onSave({
      ...form,
      age: num(form.age),
      heightCm: num(form.heightCm),
      weightKg: num(form.weightKg),
      glucose: num(form.glucose),
      bpSystolic: num(form.bpSystolic),
      bpDiastolic: num(form.bpDiastolic),
      pulse: num(form.pulse),
      dailyGoal: Number(form.dailyGoal) || (PROFILES[form.focus]?.goal ?? 2000),
    });
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Your health profile" subtitle="Personalizes every recommendation" accent={C.teal}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {/* age + sex */}
        <Text style={s.section}>About you</Text>
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={s.lbl}>Age</Text>
            <TextInput style={s.input} value={String(form.age)} onChangeText={(t) => set('age', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" placeholder="e.g. 45" placeholderTextColor={C.textFaint} />
          </View>
          <View style={{ flex: 1.6 }}>
            <Text style={s.lbl}>Sex</Text>
            <View style={s.chips}>
              {SEX_OPTIONS.map(opt => (
                <Chip key={opt} label={opt} active={form.sex === opt} onPress={() => set('sex', opt)} cap />
              ))}
            </View>
          </View>
        </View>

        {/* height + weight + BMI */}
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={s.lbl}>Height (cm)</Text>
            <TextInput style={s.input} value={String(form.heightCm)} onChangeText={(t) => set('heightCm', t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric" placeholder="170" placeholderTextColor={C.textFaint} />
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={s.lbl}>Weight (kg)</Text>
            <TextInput style={s.input} value={String(form.weightKg)} onChangeText={(t) => set('weightKg', t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric" placeholder="70" placeholderTextColor={C.textFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.lbl}>BMI</Text>
            <View style={[s.input, s.bmiBox, bmiCat && { borderColor: bmiCat.color }]}>
              <Text style={[s.bmiVal, bmiCat && { color: bmiCat.color }]}>{bmi ?? '—'}</Text>
              {bmiCat && <Text style={[s.bmiCat, { color: bmiCat.color }]}>{bmiCat.label}</Text>}
            </View>
          </View>
        </View>

        {/* focus */}
        <Text style={s.section}>Health focus</Text>
        <Text style={s.hint}>Sets which risks the engine weighs most.</Text>
        <View style={s.chips}>
          {Object.values(PROFILES).map(p => (
            <Chip key={p.key} label={`${p.icon} ${p.label}`} active={form.focus === p.key}
              accent={p.accent} onPress={() => pickFocus(p.key)} />
          ))}
        </View>

        {/* preferred cuisine — biases on-device food recognition + quick-picks */}
        <Text style={s.section}>Preferred cuisine</Text>
        <Text style={s.hint}>Helps the scanner recognise the foods you eat most, and tailors quick-picks.</Text>
        <View style={s.chips}>
          {REGIONS.map(r => (
            <Chip key={r.key} label={`${r.icon} ${r.label}`} active={region === r.key}
              accent={C.teal} onPress={() => onRegionChange && onRegionChange(r.key)} />
          ))}
        </View>

        {/* conditions */}
        <Text style={s.section}>Medical conditions</Text>
        <Text style={s.hint}>Tap any that apply — sharpens the verdict.</Text>
        <View style={s.chips}>
          {CONDITIONS.map(c => (
            <Chip key={c.key} label={`${c.icon} ${c.label}`} active={form.conditions.includes(c.key)}
              accent={C.red} onPress={() => toggle('conditions', c.key)} />
          ))}
        </View>

        {/* allergies */}
        <Text style={s.section}>Allergies</Text>
        <Text style={s.hint}>Foods matching these are flagged AVOID.</Text>
        <View style={s.chips}>
          {ALLERGENS.map(a => (
            <Chip key={a.key} label={`${a.icon} ${a.label}`} active={form.allergies.includes(a.key)}
              accent={C.amber} onPress={() => toggle('allergies', a.key)} />
          ))}
        </View>

        {/* vitals & labs */}
        <Text style={s.section}>Vitals & labs</Text>
        <Text style={s.hint}>Your latest readings sharpen the food verdict. Leave blank if unknown.</Text>

        <Text style={s.lbl}>Blood group</Text>
        <View style={s.chips}>
          {BLOOD_GROUPS.map(bg => (
            <Chip key={bg} label={bg} active={form.bloodGroup === bg} onPress={() => set('bloodGroup', bg)} />
          ))}
        </View>

        <View style={[s.row, { marginTop: 12 }]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={s.lbl}>Blood sugar (fasting)</Text>
            <TextInput style={s.input} value={String(form.glucose)} onChangeText={(t) => set('glucose', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" placeholder="mg/dL e.g. 95" placeholderTextColor={C.textFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.lbl}>Resting pulse</Text>
            <TextInput style={s.input} value={String(form.pulse)} onChangeText={(t) => set('pulse', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" placeholder="bpm e.g. 72" placeholderTextColor={C.textFaint} />
          </View>
        </View>

        <Text style={[s.lbl, { marginTop: 12 }]}>Last measured blood pressure (mmHg)</Text>
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput style={s.input} value={String(form.bpSystolic)} onChangeText={(t) => set('bpSystolic', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" placeholder="Systolic e.g. 120" placeholderTextColor={C.textFaint} />
          </View>
          <Text style={s.bpSlash}>/</Text>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TextInput style={s.input} value={String(form.bpDiastolic)} onChangeText={(t) => set('bpDiastolic', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" placeholder="Diastolic e.g. 80" placeholderTextColor={C.textFaint} />
          </View>
        </View>

        <Text style={[s.lbl, { marginTop: 12 }]}>Other relevant info</Text>
        <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} value={String(form.notes)} onChangeText={(t) => set('notes', t)}
          multiline placeholder="medications, allergies not listed, family history…" placeholderTextColor={C.textFaint} />

        {/* daily goal */}
        <Text style={s.section}>Daily calorie goal</Text>
        <TextInput style={s.input} value={String(form.dailyGoal)} onChangeText={(t) => set('dailyGoal', t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad" placeholder="2000" placeholderTextColor={C.textFaint} />

        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.85}>
          <Text style={s.saveText}>Save profile</Text>
        </TouchableOpacity>

        {onLogout && (
          <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
            <Text style={s.logoutText}>Log out{username ? ` (${username})` : ''}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Sheet>
  );
}

function Chip({ label, active, onPress, accent = C.blue, cap }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: accent + '22', borderColor: accent }]}
      activeOpacity={0.8}
    >
      <Text style={[s.chipText, cap && { textTransform: 'capitalize' }, active && { color: accent, fontWeight: '800' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  section: { color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.4, marginTop: 18, marginBottom: 6 },
  hint:    { color: C.textFaint, fontSize: 12, marginBottom: 8 },
  row:     { flexDirection: 'row', alignItems: 'flex-start' },
  lbl:     { color: C.textDim, fontSize: 12, marginBottom: 5, fontWeight: '600' },
  input:   { backgroundColor: C.surface2, color: C.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, borderWidth: 1, borderColor: C.line },
  bmiBox:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  bmiVal:  { color: C.text, fontSize: 16, fontWeight: '800' },
  bmiCat:  { fontSize: 9, fontWeight: '700', marginTop: 1 },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  chipText:{ color: C.textDim, fontSize: 13, fontWeight: '600' },
  bpSlash: { color: C.textDim, fontSize: 22, fontWeight: '800', alignSelf: 'center' },
  saveBtn: { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveText:{ color: '#06281f', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  logoutBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  logoutText:{ color: C.textDim, fontSize: 14, fontWeight: '700' },
});
