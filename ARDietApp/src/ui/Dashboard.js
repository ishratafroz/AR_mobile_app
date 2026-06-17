import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Sheet } from './Sheet';
import { Ring, MacroBar } from './Ring';
import { C, RISK } from './theme';

// Daily dashboard: calories-remaining ring + macro bars + scanned-food timeline.
export function Dashboard({ visible, onClose, totals, goal, log, profileLabel, onClear }) {
  const consumed = Math.round(totals.calories);
  const remaining = Math.max(0, goal - consumed);
  const over = consumed > goal;

  // daily macro targets ~ 30% protein / 45% carbs / 25% fat of goal calories
  const pGoal = Math.round((goal * 0.30) / 4);
  const cGoal = Math.round((goal * 0.45) / 4);
  const fGoal = Math.round((goal * 0.25) / 9);

  return (
    <Sheet visible={visible} onClose={onClose} title="Today" subtitle={`${profileLabel} · goal ${goal} kcal`} accent={C.blue}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={s.hero}>
          <Ring size={140} stroke={14} progress={consumed / goal} color={over ? C.red : C.cal}>
            <Text style={s.big}>{over ? consumed - goal : remaining}</Text>
            <Text style={s.bigSub}>{over ? 'kcal over' : 'kcal left'}</Text>
          </Ring>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <Stat label="Eaten" value={`${consumed} kcal`} />
            <Stat label="Goal" value={`${goal} kcal`} />
            <Stat label="Items today" value={`${log.length}`} />
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Macros</Text>
          <MacroBar label="Protein" value={totals.protein} max={pGoal} color={C.protein} />
          <MacroBar label="Carbs"   value={totals.carbs}   max={cGoal} color={C.carbs} />
          <MacroBar label="Fat"     value={totals.fat}     max={fGoal} color={C.fat} />
        </View>

        <View style={s.logHeader}>
          <Text style={s.cardTitle}>Food log</Text>
          {log.length > 0 && (
            <TouchableOpacity onPress={onClear}><Text style={s.clear}>Clear</Text></TouchableOpacity>
          )}
        </View>

        {log.length === 0 ? (
          <Text style={s.empty}>No foods logged yet today. Tap SCAN or PICK to add one.</Text>
        ) : (
          log.map((it) => {
            const risk = RISK[it.riskLevel] || RISK.safe;
            return (
              <View key={it.id} style={s.logRow}>
                <View style={[s.dot, { backgroundColor: risk.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.logName}>{it.name}</Text>
                  <Text style={s.logMeta}>{it.time} · {it.recognizedBy || 'manual'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.logKcal}>{Math.round(it.consumed.calories)} kcal</Text>
                  <Text style={s.logMacros}>
                    P{Math.round(it.consumed.protein)} · C{Math.round(it.consumed.carbs)} · F{Math.round(it.consumed.fat)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

function Stat({ label, value }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  big:      { color: C.text, fontSize: 34, fontWeight: '900' },
  bigSub:   { color: C.textDim, fontSize: 12, marginTop: -2 },
  statRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: C.line, borderBottomWidth: 1 },
  statLabel:{ color: C.textDim, fontSize: 13 },
  statValue:{ color: C.text, fontSize: 14, fontWeight: '700' },
  card:     { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle:{ color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 },
  logHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clear:    { color: C.red, fontSize: 13, fontWeight: '700' },
  empty:    { color: C.textFaint, fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },
  logRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  dot:      { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  logName:  { color: C.text, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  logMeta:  { color: C.textFaint, fontSize: 11, marginTop: 2 },
  logKcal:  { color: C.text, fontSize: 15, fontWeight: '800' },
  logMacros:{ color: C.textDim, fontSize: 11, marginTop: 2 },
});
