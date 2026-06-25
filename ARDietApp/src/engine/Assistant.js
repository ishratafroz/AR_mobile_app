// Conversational assistant — TWO modes (the UI prefers the LLM, falls back to rules):
//  1. answer(question, ctx)  — deterministic rule-based responder. NO network, NO LLM.
//     Used as the offline fallback when the local Llama 3 server isn't reachable.
//  2. buildFacts(ctx)        — compiles the same on-device data into a grounding
//     factsheet for the local Llama 3 (Ollama) backend (services/LlamaChat.js), so the
//     LLM phrases natural answers while the NUMBERS stay correct (grounded generation).
// Both read only data the app already computes (food log, risk engine, health profile,
// nutrition tables) — see CLAUDE.md "conversational AI" feature.
//
// answer(question, ctx) -> { text, chips? }
//   ctx = { user, lastFood, totals, goal, log, history, health, profileLabel }

import { getNutritionOffline, OFFLINE_FOODS } from '../services/NutritionAPI';
import { lookupGI, classifyGI } from '../data/GlycemicIndex';
import { suggestAlternative, assessClinical } from './RiskEngine';

const has = (q, ...words) => words.some(w => q.includes(w));

// Suggested quick-questions shown under the input.
export const SUGGESTIONS = [
  'How many calories do I have left?',
  'What did I eat today?',
  'Is my last scan good for me?',
  'Show my trend this week',
  'What should I eat instead?',
];

function round(n) { return Math.round(n || 0); }

// Find a known food name mentioned in the question (for "how much sugar in X").
function foodMentioned(q) {
  const names = OFFLINE_FOODS || [];
  // longest match first so "apple pie" beats "apple"
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (name.length >= 3 && q.includes(name.toLowerCase())) return name;
  }
  return null;
}

function caloriesLeft(ctx) {
  const left = ctx.goal - round(ctx.totals.calories);
  if (left > 0) {
    return { text: `You have about ${left} kcal left today — you've eaten ${round(ctx.totals.calories)} of your ${ctx.goal} kcal goal.` };
  }
  return { text: `You're ${Math.abs(left)} kcal over your ${ctx.goal} kcal goal today (eaten ${round(ctx.totals.calories)}). Consider a lighter next meal.` };
}

function todaysLog(ctx) {
  if (!ctx.log.length) return { text: "You haven't logged any food yet today. Tap SCAN or PICK to add a meal." };
  const lines = ctx.log.map(it => `• ${it.name} — ${round(it.consumed.calories)} kcal (${it.time})`).join('\n');
  const t = ctx.totals;
  return { text: `Today you logged ${ctx.log.length} item${ctx.log.length === 1 ? '' : 's'}:\n${lines}\n\nTotals: ${round(t.calories)} kcal · P${round(t.protein)} · C${round(t.carbs)} · F${round(t.fat)}.` };
}

function macroToday(ctx, which) {
  const t = ctx.totals;
  const map = { protein: t.protein, carbs: t.carbs, carb: t.carbs, fat: t.fat };
  const g = round(map[which]);
  return { text: `So far today you've had about ${g} g of ${which === 'carb' ? 'carbs' : which}. Full breakdown: P${round(t.protein)} · C${round(t.carbs)} · F${round(t.fat)} · ${round(t.calories)} kcal.` };
}

function lastScanVerdict(ctx) {
  const f = ctx.lastFood;
  if (!f) return { text: "You haven't scanned anything yet. Tap SCAN to analyze a meal, then ask me about it." };
  if (f.noNutrition) return { text: `Your last scan (${f.name}) was recognized but isn't in the nutrition table yet, so I can't judge it. You can search USDA for it from the nutrition card.` };
  const parts = [];
  parts.push(`Your last scan was ${f.name}.`);
  if (f.riskMessage) parts.push(f.riskMessage);
  else parts.push(`Risk level: ${f.riskLevel}.`);
  if (f.caloriesPortion != null) parts.push(`Portion: ~${round(f.caloriesPortion)} kcal.`);
  const swap = (f.riskLevel && f.riskLevel !== 'safe') ? suggestAlternative(f.name, f.riskLevel) : null;
  if (swap) parts.push(`A healthier swap: ${swap}.`);
  return { text: parts.join(' ') };
}

function swapAdvice(ctx) {
  const f = ctx.lastFood;
  if (f && !f.noNutrition) {
    const swap = suggestAlternative(f.name, f.riskLevel);
    if (swap) return { text: `Instead of ${f.name}, try ${swap} — it's gentler for your profile while keeping you full.` };
    if (f.riskLevel === 'safe') return { text: `${f.name} already looks fine for you — no swap needed. Keep your portion in check and you're good.` };
  }
  return { text: 'Scan or pick a food first and I can suggest a specific healthier alternative. In general: swap fried for grilled/baked, sugary drinks for water, and refined grains for whole grains.' };
}

function trendAnswer(ctx) {
  const hist = ctx.history || {};
  const days = Object.keys(hist).filter(k => (hist[k] || []).length > 0).sort();
  if (!days.length) return { text: 'No food history yet — once you log meals over a few days, I can show your calorie and macro trends here.' };
  const recent = days.slice(-7);
  const dayCals = recent.map(k => (hist[k] || []).reduce((a, it) => a + (it.consumed?.calories || 0), 0));
  const avg = round(dayCals.reduce((a, c) => a + c, 0) / dayCals.length);
  const onGoal = dayCals.filter(c => c <= ctx.goal).length;
  return { text: `Over your last ${recent.length} logged day${recent.length === 1 ? '' : 's'} you averaged ${avg} kcal/day (goal ${ctx.goal}). You stayed at or under goal on ${onGoal} of ${recent.length} days. Open Today → Trends for the chart.` };
}

function wearableAnswer(ctx) {
  const h = ctx.health;
  if (!h) return { text: 'No wearable data is connected yet. The app uses a demo profile until you connect Google Fit from the Health panel.' };
  const bits = [];
  if (h.restingHeartRate != null) bits.push(`resting HR ~${round(h.restingHeartRate)} bpm`);
  if (h.stepsToday != null) bits.push(`${round(h.stepsToday)} steps today`);
  if (h.sleepHours != null) bits.push(`${h.sleepHours} h sleep`);
  if (h.caloriesBurned != null) bits.push(`${round(h.caloriesBurned)} kcal burned`);
  const demo = h.source && String(h.source).startsWith('demo');
  const src = demo ? ' (demo data — connect Google Fit in the Health panel for live values)' : (h.source ? ` (source: ${h.source})` : '');
  return { text: bits.length ? `Your current metrics: ${bits.join(', ')}.${src}` : 'Wearable connected but no metrics available right now.' };
}

function clinicalAnswer(ctx) {
  const c = assessClinical(ctx.user);
  const flags = [];
  if (c.glucoseCat) flags.push(`Fasting glucose ${ctx.user.glucose} mg/dL — ${c.glucoseCat}.`);
  if (c.bpCat)      flags.push(`Blood pressure ${ctx.user.bpSystolic}/${ctx.user.bpDiastolic} — ${c.bpCat}.`);
  if (c.pulseCat)   flags.push(`Resting pulse ${ctx.user.pulse} bpm — ${c.pulseCat}.`);
  if (flags.length) {
    const advice = [];
    if (c.diabetesRisk) advice.push('watch sugar and high-GI foods');
    if (c.hypertensionRisk) advice.push('keep sodium down');
    const tail = advice.length ? `\n\nGiven this, I'd ${advice.join(' and ')}.` : '';
    return { text: flags.map(f => `• ${f}`).join('\n') + tail };
  }
  return { text: 'I have no vitals on file to flag yet. Add your fasting glucose, blood pressure, and resting pulse in the health profile and I can tailor advice to your numbers.' };
}

function foodFactAnswer(ctx, q, name) {
  const n = getNutritionOffline(name);
  if (!n) return null;
  const gi = lookupGI(name);
  const giStr = gi != null ? ` GI ${gi} (${classifyGI(gi)}).` : '';
  if (has(q, 'sugar')) return { text: `${name} (per 100 g): ~${round(n.sugar)} g sugar.${giStr}` };
  if (has(q, 'protein')) return { text: `${name} (per 100 g): ~${round(n.protein)} g protein.` };
  if (has(q, 'carb')) return { text: `${name} (per 100 g): ~${round(n.carbs)} g carbs.${giStr}` };
  if (has(q, 'fat')) return { text: `${name} (per 100 g): ~${round(n.fat)} g fat (${round(n.saturatedFat || 0)} g saturated).` };
  if (has(q, 'gi', 'glycemic')) return { text: gi != null ? `${name}: GI ${gi} (${classifyGI(gi)}).` : `I don't have a glycemic index for ${name}.` };
  return { text: `${name} (per 100 g): ${round(n.calories)} kcal · P${round(n.protein)} · C${round(n.carbs)} · F${round(n.fat)} · ${round(n.sugar)} g sugar.${giStr}` };
}

const HELP = {
  text:
    "I'm your on-device diet assistant — everything stays on your phone. You can ask me:\n" +
    '• "How many calories do I have left?"\n' +
    '• "What did I eat today?"\n' +
    '• "Is my last scan good for me?"\n' +
    '• "What should I eat instead?"\n' +
    '• "Show my trend this week"\n' +
    '• "How much sugar is in <food>?"\n' +
    '• "What\'s my heart rate / steps?"',
};

export function answer(rawQuestion, ctx) {
  const q = String(rawQuestion || '').toLowerCase().trim();
  if (!q) return HELP;

  if (has(q, 'help', 'what can you', 'who are you', 'hi', 'hello', 'hey')) return HELP;

  // Specific-food fact ("how much sugar in apple") — check before generic macro.
  const name = foodMentioned(q);
  if (name && has(q, 'sugar', 'protein', 'carb', 'fat', 'gi', 'glycemic', 'calor', 'how much', 'how many', 'nutrition')) {
    const fa = foodFactAnswer(ctx, q, name);
    if (fa) return fa;
  }

  if (has(q, 'calorie', 'kcal') && has(q, 'left', 'remain', 'budget', 'have')) return caloriesLeft(ctx);
  if (has(q, 'trend', 'week', 'average', 'history', 'over time', 'past')) return trendAnswer(ctx);
  if (has(q, 'eat today', 'ate today', 'log', 'what did i', 'today')) return todaysLog(ctx);
  if (has(q, 'instead', 'swap', 'alternative', 'healthier', 'replace')) return swapAdvice(ctx);
  if (has(q, 'last scan', 'this food', 'good for me', 'bad for me', 'risky', 'should i eat', 'is it ok', 'why')) return lastScanVerdict(ctx);
  if (has(q, 'protein')) return macroToday(ctx, 'protein');
  if (has(q, 'carb')) return macroToday(ctx, 'carb');
  if (has(q, 'fat')) return macroToday(ctx, 'fat');
  if (has(q, 'heart', 'hr', 'pulse', 'steps', 'sleep', 'wearable', 'fit', 'activity')) return wearableAnswer(ctx);
  if (has(q, 'diabet', 'glucose', 'sugar level', 'blood pressure', 'bp', 'risk', 'clinical')) return clinicalAnswer(ctx);
  if (has(q, 'calorie', 'kcal')) return caloriesLeft(ctx);

  return {
    text: "I'm not sure about that one. I can help with your calories, macros, food log, last scan, trends, swaps, and wearable metrics. Try one of the suggestions below.",
  };
}

// ---------------- Grounding factsheet for the local LLM (Llama 3) ----------------
// Compiles the SAME on-device data the rule engine uses into a compact, authoritative
// block. The LLM is told to answer ONLY from this — so numbers stay correct while the
// model handles natural language. Kept short to stay fast on the local 8B model.
export function buildFacts(ctx) {
  const L = [];
  const t = ctx.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  L.push(`User profile/focus: ${ctx.profileLabel || 'General'}. Daily calorie goal: ${ctx.goal} kcal.`);

  // Today
  const eaten = round(t.calories);
  const left = ctx.goal - eaten;
  L.push(`Today so far: eaten ${eaten} kcal (${left >= 0 ? `${left} left` : `${Math.abs(left)} over goal`}); ` +
         `protein ${round(t.protein)} g, carbs ${round(t.carbs)} g, fat ${round(t.fat)} g; ${ctx.log?.length || 0} items logged.`);
  if (ctx.log?.length) {
    L.push('Today\'s items: ' + ctx.log.map(it => `${it.name} (${round(it.consumed?.calories)} kcal, risk ${it.riskLevel || 'n/a'})`).join('; ') + '.');
  }

  // Last scan
  const f = ctx.lastFood;
  if (f) {
    if (f.noNutrition) {
      L.push(`Last scan: ${f.name} — recognized but no nutrition data available.`);
    } else {
      const gi = (f.gi != null) ? `, GI ${f.gi}` : '';
      const n = getNutritionOffline(f.name);
      const per100 = n ? ` Per 100 g: ${round(n.calories)} kcal, P${round(n.protein)}, C${round(n.carbs)}, F${round(n.fat)}, sugar ${round(n.sugar)} g, sat fat ${round(n.saturatedFat || 0)} g.` : '';
      L.push(`Last scan: ${f.name} — risk level ${f.riskLevel}${gi}.` +
             (f.caloriesPortion != null ? ` Portion ~${round(f.caloriesPortion)} kcal.` : '') +
             (f.riskMessage ? ` Note: ${f.riskMessage}` : '') + per100);
      const swap = (f.riskLevel && f.riskLevel !== 'safe') ? suggestAlternative(f.name, f.riskLevel) : null;
      if (swap) L.push(`Suggested healthier swap for ${f.name}: ${swap}.`);
    }
  } else {
    L.push('Last scan: none yet this session.');
  }

  // Multi-day trend
  const hist = ctx.history || {};
  const days = Object.keys(hist).filter(k => (hist[k] || []).length > 0).sort();
  if (days.length) {
    const recent = days.slice(-7);
    const cals = recent.map(k => (hist[k] || []).reduce((a, it) => a + (it.consumed?.calories || 0), 0));
    const avg = round(cals.reduce((a, c) => a + c, 0) / cals.length);
    const onGoal = cals.filter(c => c <= ctx.goal).length;
    L.push(`Recent trend: ${recent.length} logged days, avg ${avg} kcal/day, ${onGoal}/${recent.length} at-or-under goal.`);
  }

  // Wearable
  const h = ctx.health;
  if (h) {
    const demo = h.source && String(h.source).startsWith('demo');
    const bits = [];
    if (h.restingHeartRate != null) bits.push(`resting HR ${round(h.restingHeartRate)} bpm`);
    if (h.stepsToday != null) bits.push(`${round(h.stepsToday)} steps`);
    if (h.sleepHours != null) bits.push(`${h.sleepHours} h sleep`);
    if (bits.length) L.push(`Wearable${demo ? ' (demo data)' : ''}: ${bits.join(', ')}.`);
  }

  // Clinical (only if the user entered vitals)
  const c = assessClinical(ctx.user);
  const cl = [];
  if (c.glucoseCat) cl.push(`fasting glucose ${ctx.user.glucose} mg/dL (${c.glucoseCat})`);
  if (c.bpCat)      cl.push(`BP ${ctx.user.bpSystolic}/${ctx.user.bpDiastolic} (${c.bpCat})`);
  if (c.pulseCat)   cl.push(`resting pulse ${ctx.user.pulse} bpm (${c.pulseCat})`);
  if (cl.length) L.push(`User vitals on file: ${cl.join(', ')}.`);

  return L.join('\n');
}
