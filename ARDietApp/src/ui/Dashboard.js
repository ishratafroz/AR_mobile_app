import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { Sheet } from './Sheet';
import { Ring, MacroBar } from './Ring';
import { C, RISK } from './theme';

// Daily dashboard with two tabs:
//  • Today — calories-remaining ring + macro bars + scanned-food timeline.
//  • Trends — multi-day timeseries of calorie intake (Goal 3: effectiveness over time).
export function Dashboard({ visible, onClose, totals, goal, log, history, profileLabel, onClear }) {
  const [tab, setTab] = useState('today');

  return (
    <Sheet visible={visible} onClose={onClose} title="Today" subtitle={`${profileLabel} · goal ${goal} kcal`} accent={C.blue}>
      <View style={s.tabs}>
        <Tab label="Today"  active={tab === 'today'}  onPress={() => setTab('today')} />
        <Tab label="Trends" active={tab === 'trends'} onPress={() => setTab('trends')} />
      </View>
      {tab === 'today'
        ? <TodayView totals={totals} goal={goal} log={log} onClear={onClear} />
        : <TrendsView history={history} goal={goal} />}
    </Sheet>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------- Today ----------------
function TodayView({ totals, goal, log, onClear }) {
  const consumed = Math.round(totals.calories);
  const remaining = Math.max(0, goal - consumed);
  const over = consumed > goal;

  // daily macro targets ~ 30% protein / 45% carbs / 25% fat of goal calories
  const pGoal = Math.round((goal * 0.30) / 4);
  const cGoal = Math.round((goal * 0.45) / 4);
  const fGoal = Math.round((goal * 0.25) / 9);

  return (
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
  );
}

// ---------------- Trends (timeseries) ----------------
function dayTotals(items) {
  return (items || []).reduce(
    (a, it) => ({
      calories: a.calories + (it.consumed?.calories || 0),
      protein:  a.protein  + (it.consumed?.protein  || 0),
      carbs:    a.carbs    + (it.consumed?.carbs    || 0),
      fat:      a.fat      + (it.consumed?.fat      || 0),
      items:    a.items    + 1,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 }
  );
}

// Build the last `n` calendar days (oldest→newest), each with totals (0 if no log).
function buildSeries(history, n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ key, date: d, ...dayTotals(history?.[key]) });
  }
  return out;
}

function TrendsView({ history, goal }) {
  const [range, setRange] = useState(7);
  const series = buildSeries(history, range);
  const logged = series.filter(d => d.items > 0);

  if (logged.length === 0) {
    return (
      <View style={{ paddingVertical: 24 }}>
        <Text style={s.empty}>
          No food history yet. Your daily intake will build up here over the next few days
          so you can see calorie and macro trends over time.
        </Text>
      </View>
    );
  }

  const avgCals = Math.round(logged.reduce((a, d) => a + d.calories, 0) / logged.length);
  const onTarget = logged.filter(d => d.calories <= goal).length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
      <View style={s.rangeRow}>
        {[7, 14, 30].map(r => (
          <TouchableOpacity key={r} style={[s.range, range === r && s.rangeActive]} onPress={() => setRange(r)}>
            <Text style={[s.rangeText, range === r && s.rangeTextActive]}>{r}d</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.statsRow}>
        <Mini label="Days logged" value={`${logged.length}`} />
        <Mini label="Avg kcal/day" value={`${avgCals}`} />
        <Mini label="On goal" value={`${onTarget}/${logged.length}`} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Calories per day</Text>
        <CalorieChart series={series} goal={goal} />
      </View>

      <Text style={[s.cardTitle, { marginBottom: 8 }]}>By day</Text>
      {[...series].reverse().filter(d => d.items > 0).map(d => {
        const over = d.calories > goal;
        return (
          <View key={d.key} style={s.dayRow}>
            <View style={{ width: 54 }}>
              <Text style={s.dayDow}>{d.date.toLocaleDateString([], { weekday: 'short' })}</Text>
              <Text style={s.dayDate}>{d.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
            </View>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.min(100, (d.calories / goal) * 100)}%`, backgroundColor: over ? C.red : C.cal }]} />
              </View>
              <Text style={s.dayMacros}>P{Math.round(d.protein)} · C{Math.round(d.carbs)} · F{Math.round(d.fat)} · {d.items} item{d.items === 1 ? '' : 's'}</Text>
            </View>
            <Text style={[s.dayKcal, over && { color: C.red }]}>{Math.round(d.calories)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// SVG bar chart: one bar per day, dashed goal line.
function CalorieChart({ series, goal }) {
  const W = 300, H = 150, padB = 22, padT = 8;
  const maxVal = Math.max(goal, ...series.map(d => d.calories)) * 1.1 || 1;
  const n = series.length;
  const gap = 3;
  const bw = (W - gap * (n - 1)) / n;
  const plotH = H - padB - padT;
  const yOf = v => padT + plotH * (1 - v / maxVal);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* goal line */}
      <Line x1={0} y1={yOf(goal)} x2={W} y2={yOf(goal)} stroke={C.green} strokeWidth={1} strokeDasharray="4 4" />
      <SvgText x={W} y={yOf(goal) - 3} fill={C.green} fontSize="9" textAnchor="end">goal {goal}</SvgText>
      {series.map((d, i) => {
        const x = i * (bw + gap);
        const h = d.calories > 0 ? Math.max(2, plotH * (d.calories / maxVal)) : 0;
        const over = d.calories > goal;
        return (
          <G key={d.key}>
            {h > 0 && (
              <Rect x={x} y={H - padB - h} width={bw} height={h} rx={2}
                fill={over ? C.red : C.cal} opacity={0.9} />
            )}
            {(n <= 14 || i % 3 === 0) && (
              <SvgText x={x + bw / 2} y={H - 8} fill={C.textFaint} fontSize="8" textAnchor="middle">
                {d.date.getDate()}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

function Mini({ label, value }) {
  return (
    <View style={s.mini}>
      <Text style={s.miniValue}>{value}</Text>
      <Text style={s.miniLabel}>{label}</Text>
    </View>
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
  tabs:     { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 4, marginBottom: 14 },
  tab:      { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive:{ backgroundColor: C.surface2 },
  tabText:  { color: C.textDim, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: C.text },

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
  empty:    { color: C.textFaint, fontSize: 13, fontStyle: 'italic', paddingVertical: 12, lineHeight: 19 },
  logRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  dot:      { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  logName:  { color: C.text, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  logMeta:  { color: C.textFaint, fontSize: 11, marginTop: 2 },
  logKcal:  { color: C.text, fontSize: 15, fontWeight: '800' },
  logMacros:{ color: C.textDim, fontSize: 11, marginTop: 2 },

  rangeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  range:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginLeft: 6, backgroundColor: C.surface },
  rangeActive: { backgroundColor: C.blue },
  rangeText: { color: C.textDim, fontSize: 12, fontWeight: '700' },
  rangeTextActive: { color: '#fff' },

  statsRow: { flexDirection: 'row', marginBottom: 16 },
  mini:     { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, marginRight: 8, alignItems: 'center' },
  miniValue:{ color: C.text, fontSize: 18, fontWeight: '900' },
  miniLabel:{ color: C.textFaint, fontSize: 10, marginTop: 2, textAlign: 'center' },

  dayRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  dayDow:   { color: C.text, fontSize: 13, fontWeight: '700' },
  dayDate:  { color: C.textFaint, fontSize: 11, marginTop: 1 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF14', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 4 },
  dayMacros:{ color: C.textFaint, fontSize: 10, marginTop: 4 },
  dayKcal:  { color: C.text, fontSize: 15, fontWeight: '800', width: 44, textAlign: 'right' },
});
