import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Sheet } from './Sheet';
import { Ring } from './Ring';
import { C, RISK } from './theme';

// Goal 2 — wearable/mHealth + risk assessment panel.
export function HealthPanel({ visible, onClose, health, food, onConnect }) {
  const risk = food ? (RISK[food.riskLevel] || RISK.safe) : null;
  const score = food?.score ?? 0;
  const [connecting, setConnecting] = useState(false);
  const connected = health?.source === 'health_connect';

  async function connect() {
    if (!onConnect || connecting) return;
    setConnecting(true);
    try { await onConnect(); } finally { setConnecting(false); }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Health & Risk" accent={C.red}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* risk gauge for the last scanned food */}
        {food ? (
          <View style={s.hero}>
            <Ring size={120} stroke={12} progress={Math.min(1, score / 8)} color={risk.color}>
              <Text style={[s.score, { color: risk.color }]}>{score}</Text>
              <Text style={s.scoreSub}>risk score</Text>
            </Ring>
            <View style={{ flex: 1, marginLeft: 18 }}>
              <View style={[s.pill, { backgroundColor: risk.color + '22', borderColor: risk.color }]}>
                <Text style={[s.pillText, { color: risk.color }]}>{risk.label}</Text>
              </View>
              <Text style={s.foodName}>{food.name}</Text>
              {food.reasons?.length > 0
                ? food.reasons.map((r, i) => <Text key={i} style={s.reason}>• {r}</Text>)
                : <Text style={s.reason}>No risk factors flagged</Text>}
            </View>
          </View>
        ) : (
          <Text style={s.empty}>Scan a food to see its risk assessment.</Text>
        )}

        {/* Religion / dietary-tradition restriction (hard AVOID) */}
        {food?.religion && (
          <View style={[s.flag, { borderColor: C.purple, backgroundColor: C.purple + '14' }]}>
            <Text style={[s.flagLabel, { color: C.purple }]}>⚠ NOT PERMITTED FOR YOU</Text>
            <Text style={s.flagText}>{food.religion.reason}.</Text>
          </View>
        )}

        {/* 5-year impact projection from the user's past diseases */}
        {food?.projection?.factors?.length > 0 && (
          <View style={[s.flag, { borderColor: C.amber, backgroundColor: C.amber + '14' }]}>
            <Text style={[s.flagLabel, { color: C.amber }]}>🕒 5-YEAR IMPACT (based on your history)</Text>
            {food.projection.factors.map((f, i) => (
              <Text key={i} style={s.flagText}>• {f.impact}</Text>
            ))}
          </View>
        )}

        {/* Environment-aware, health-conscious note */}
        {food?.envNote && (
          <View style={[s.flag, { borderColor: C.teal, backgroundColor: C.teal + '14' }]}>
            <Text style={[s.flagLabel, { color: C.teal }]}>🌦 LOCAL ENVIRONMENT</Text>
            <Text style={s.flagText}>{food.envNote}</Text>
          </View>
        )}

        {food?.alternative && (
          <View style={[s.swap, { borderColor: C.green }]}>
            <Text style={s.swapLabel}>SUGGESTED HEALTHIER ALTERNATIVE</Text>
            <Text style={s.swapVal}>{food.alternative}</Text>
          </View>
        )}

        {/* wearable metric cards */}
        <Text style={s.section}>Wearable metrics</Text>
        <View style={s.grid}>
          <Metric icon="❤️" label="Resting HR" value={fmt(health?.restingHeartRate, 'bpm')} warn={health?.restingHeartRate > 90} />
          <Metric icon="👟" label="Steps today" value={fmt(health?.stepsToday)} warn={health?.stepsToday != null && health.stepsToday < 3000} />
          <Metric icon="😴" label="Sleep" value={fmt(health?.sleepHours, 'h')} warn={health?.sleepHours != null && health.sleepHours < 5} />
          <Metric icon="🔥" label="Cal burned" value={fmt(health?.caloriesBurned, 'kcal')} />
          {health?.glucose != null && (
            <Metric icon="🩸" label="Glucose" value={fmt(health.glucose, 'mg/dL')} warn={health.glucose >= 126} />
          )}
          {health?.bpSystolic != null && (
            <Metric icon="🫀" label="Blood pressure" value={`${health.bpSystolic}/${health.bpDiastolic ?? '—'}`} warn={health.bpSystolic >= 140 || health.bpDiastolic >= 90} />
          )}
          {health?.weightKg != null && (
            <Metric icon="⚖️" label="Weight" value={fmt(health.weightKg, 'kg')} />
          )}
        </View>
        <Text style={s.source}>
          Source: {sourceLabel(health?.source)}
        </Text>

        {/* Connect to Android Health Connect (real wearable data) */}
        <TouchableOpacity
          style={[s.connectBtn, connected && { borderColor: C.green, backgroundColor: C.green + '14' }]}
          onPress={connect} disabled={connecting} activeOpacity={0.85}
        >
          {connecting
            ? <ActivityIndicator color={C.teal} />
            : <Text style={[s.connectText, connected && { color: C.green }]}>
                {connected ? '✓ Health Connect linked — tap to refresh' : '＋ Connect Health Connect (real wearable data)'}
              </Text>}
        </TouchableOpacity>
        <Text style={s.connectHint}>
          Pulls heart rate, steps, calories, sleep (and latest glucose/BP) from the Health Connect
          app on your phone. Data stays on-device.
        </Text>

        <View style={s.note}>
          <Text style={s.noteText}>
            Risk combines food nutrients (saturated fat, sugar, sodium, glycemic index) with live
            wearable signals — e.g. low activity + high glycemic load escalates a diabetes flag, and
            elevated heart rate + saturated fat raises cardiovascular caution.
          </Text>
        </View>
      </ScrollView>
    </Sheet>
  );
}

function Metric({ icon, label, value, warn }) {
  return (
    <View style={[s.metric, warn && { borderColor: C.red, backgroundColor: C.red + '14' }]}>
      <Text style={s.metricIcon}>{icon}</Text>
      <Text style={[s.metricValue, warn && { color: C.red }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const fmt = (v, unit = '') => (v == null ? '—' : `${v}${unit ? ' ' + unit : ''}`);

function sourceLabel(src) {
  if (src === 'health_connect') return 'Health Connect (live)';
  if (src === 'google_fit') return 'Google Fit';
  if (!src || String(src).startsWith('demo')) return 'demo profile (not connected)';
  return src;
}

const s = StyleSheet.create({
  hero:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  score:    { fontSize: 34, fontWeight: '900' },
  scoreSub: { color: C.textDim, fontSize: 11, marginTop: -2 },
  pill:     { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 6 },
  pillText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  foodName: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 6, textTransform: 'capitalize' },
  reason:   { color: C.textDim, fontSize: 13, marginTop: 1 },
  empty:    { color: C.textFaint, fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },
  flag:     { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  flagLabel:{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  flagText: { color: C.textDim, fontSize: 13, lineHeight: 18, marginTop: 1 },
  swap:     { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: C.green + '14' },
  swapLabel:{ color: C.textDim, fontSize: 11, fontWeight: '700' },
  swapVal:  { color: C.green, fontSize: 16, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  section:  { color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.5, marginBottom: 10 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metric:   { width: '48%', backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  metricIcon:{ fontSize: 20, marginBottom: 6 },
  metricValue:{ color: C.text, fontSize: 18, fontWeight: '800' },
  metricLabel:{ color: C.textDim, fontSize: 12, marginTop: 2 },
  source:   { color: C.textFaint, fontSize: 12, marginBottom: 10 },
  connectBtn:{ borderWidth: 1, borderColor: C.teal, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: C.teal + '14' },
  connectText:{ color: C.teal, fontSize: 14, fontWeight: '700' },
  connectHint:{ color: C.textFaint, fontSize: 11, marginTop: 6, marginBottom: 14, lineHeight: 16 },
  note:     { backgroundColor: C.surface, borderRadius: 12, padding: 12 },
  noteText: { color: C.textDim, fontSize: 12, lineHeight: 18 },
});
