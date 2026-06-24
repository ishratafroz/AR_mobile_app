const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

pptx.author = 'AR Diet Monitoring';
pptx.title = 'AR Diet Monitoring — On-Device AI & Clinical Risk Engine';
pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in

// ---- Theme ----
const NAVY = '0F2440';
const BLUE = '2E7BFF';
const TEAL = '12B5A5';
const GREEN = '44CC44';
const AMBER = 'FFA500';
const GREY = '5A6472';
const LIGHT = 'F4F6FA';
const WHITE = 'FFFFFF';
const DARK = '1A1F29';

const W = 13.33, H = 7.5;

function bg(slide, color) { slide.background = { color }; }

// Title bar used on content slides
function header(slide, kicker, title) {
  slide.addShape('rect', { x: 0, y: 0, w: W, h: 1.15, fill: { color: NAVY }, line: { color: NAVY } });
  slide.addShape('rect', { x: 0, y: 1.15, w: W, h: 0.06, fill: { color: BLUE }, line: { color: BLUE } });
  slide.addText(kicker.toUpperCase(), { x: 0.6, y: 0.16, w: 12, h: 0.3, fontSize: 11, color: TEAL, bold: true, charSpacing: 2, fontFace: 'Segoe UI' });
  slide.addText(title, { x: 0.6, y: 0.42, w: 12.1, h: 0.66, fontSize: 26, color: WHITE, bold: true, fontFace: 'Segoe UI' });
}

function footer(slide, n) {
  slide.addText('AR Diet Monitoring  ·  On-Device AI & Risk Engine', { x: 0.6, y: 7.05, w: 8, h: 0.3, fontSize: 9, color: GREY, fontFace: 'Segoe UI' });
  slide.addText(String(n), { x: 12.4, y: 7.05, w: 0.5, h: 0.3, fontSize: 9, color: GREY, align: 'right', fontFace: 'Segoe UI' });
}

// bullet helper
function bullets(items, opts = {}) {
  return items.map((t) => {
    if (typeof t === 'string') return { text: t, options: { bullet: { code: '2022' }, color: DARK, fontSize: opts.fs || 15, paraSpaceAfter: 8, fontFace: 'Segoe UI' } };
    return { text: t.text, options: { bullet: t.sub ? { code: '25AA', indent: 18 } : { code: '2022' }, indentLevel: t.sub ? 1 : 0, color: t.color || DARK, fontSize: t.fs || (t.sub ? 13 : 15), bold: !!t.bold, paraSpaceAfter: 6, fontFace: 'Segoe UI' } };
  });
}

// card helper
function card(slide, x, y, w, h, title, lines, accent) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: WHITE }, line: { color: 'E2E7F0', width: 1 }, shadow: { type: 'outer', color: 'B8C0CC', blur: 6, offset: 2, angle: 90, opacity: 0.35 } });
  slide.addShape('rect', { x, y, w: 0.09, h, fill: { color: accent }, line: { color: accent } });
  slide.addText(title, { x: x + 0.22, y: y + 0.12, w: w - 0.35, h: 0.35, fontSize: 14, bold: true, color: NAVY, fontFace: 'Segoe UI' });
  slide.addText(lines.map((l) => ({ text: l, options: { bullet: { code: '2022' }, fontSize: 11.5, color: DARK, paraSpaceAfter: 4, fontFace: 'Segoe UI' } })),
    { x: x + 0.22, y: y + 0.5, w: w - 0.4, h: h - 0.6, valign: 'top' });
}

// =================== SLIDE 1 — TITLE ===================
let s = pptx.addSlide(); bg(s, NAVY);
s.addShape('rect', { x: 0, y: 5.05, w: W, h: 0.06, fill: { color: BLUE }, line: { color: BLUE } });
s.addText('PROJECT UPDATE', { x: 0.8, y: 1.7, w: 11, h: 0.4, fontSize: 14, color: TEAL, bold: true, charSpacing: 3, fontFace: 'Segoe UI' });
s.addText('Mobile AR Diet Monitoring', { x: 0.8, y: 2.15, w: 11.7, h: 0.9, fontSize: 40, color: WHITE, bold: true, fontFace: 'Segoe UI' });
s.addText('On-Device Food Recognition · Clinical Risk Engine · Personal Accounts', { x: 0.8, y: 3.05, w: 11.7, h: 0.7, fontSize: 22, color: 'AEB9CC', fontFace: 'Segoe UI' });
s.addText([
  { text: 'Cloud-based Gemini Vision replaced by a fully offline, on-device recognition + nutrition pipeline', options: { fontSize: 13, color: 'AEB9CC', fontFace: 'Segoe UI' } },
], { x: 0.8, y: 3.75, w: 11, h: 0.5 });
s.addText('Updates achieved · June 18, 2026', { x: 0.8, y: 5.25, w: 11, h: 0.4, fontSize: 13, color: WHITE, bold: true, fontFace: 'Segoe UI' });
s.addText('Platform: React Native 0.72 · @reactvision/react-viro (ARCore) · Android (Moto G 5G)', { x: 0.8, y: 5.7, w: 11.5, h: 0.4, fontSize: 11, color: GREY, fontFace: 'Segoe UI' });

// =================== SLIDE 2 — OBJECTIVE / SCOPE ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'This update', 'Objective & Scope');
s.addText(bullets([
  { text: 'Goal: privacy-preserving, real-time AI food recognition for diet monitoring (Project Goal 1.2).', bold: true },
  'Replaced cloud-based Gemini Vision with three on-device TFLite models — the meal photo never leaves the phone.',
  'Added a local account system and an expanded clinical health profile (Goal 2 / Goal 3).',
  { text: 'Risk engine now cites the user\'s own labs:', bold: true },
  { text: 'fasting glucose, blood pressure, resting pulse — not just generic thresholds.', sub: true },
  'New SVG-based UI: daily Dashboard, HealthPanel, ProfilePicker, NutritionCard.',
]), { x: 0.6, y: 1.5, w: 7.3, h: 5.2, valign: 'top' });

card(s, 8.2, 1.55, 4.55, 2.45, 'Recognition pipeline (on-device)', [
  '1. Box detector (SSD MobileNet, 16 classes) — location + count',
  '2. Dish classifier (AIY Food V1, 2,024 dishes) — identity',
  '3. Produce classifier (optional) — fills bare-fruit gap',
  '4. Offline nutrition (~70 foods) + GI table (~100 foods)',
], BLUE);
card(s, 8.2, 4.15, 4.55, 2.4, 'Aligned project goals', [
  'Goal 1: instant, on-device diet monitoring',
  'Goal 2: clinical-aware risk + wearable escalation',
  'Goal 3: privacy-by-design for human-subjects testing',
], TEAL);
footer(s, 2);

// =================== SLIDE 3 — WHAT WAS DELIVERED ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Deliverables', 'What Was Built');
card(s, 0.6, 1.5, 3.9, 2.45, 'On-device recognition', [
  'LocalFoodClassifier.js — AIY Food V1 (2,024 dishes)',
  'FoodBoxDetector.js — SSD MobileNet (16 classes)',
  'LocalProduceClassifier.js — optional, gated',
  'mergeCandidates() fuses all signals into one ranked list',
], BLUE);
card(s, 4.7, 1.5, 3.9, 2.45, 'Accounts & profiles', [
  'Accounts.js + Login.js — local sign-up/login',
  'Hashed password, AsyncStorage, no backend',
  'Per-user session + per-user daily food log',
  'HealthIntake.js: blood group, glucose, BP, pulse, notes',
], TEAL);
card(s, 8.8, 1.5, 3.95, 2.45, 'Clinical-aware risk engine', [
  'assessClinical(): ADA glucose + ACC/AHA BP cutoffs',
  'Escalates risk using the user\'s actual numbers',
  'assessNutritionQuality() + history-aware budget',
  'Recommendation text cites real labs, e.g. "140 mg/dL"',
], GREEN);
card(s, 0.6, 4.15, 3.9, 2.4, 'Modern UI (src/ui)', [
  'Dashboard, HealthPanel, ProfilePicker, NutritionCard',
  'SVG calorie/macro rings, bottom-sheet panels',
  'Daily log + chosen profile persist via AsyncStorage',
], AMBER);
card(s, 4.7, 4.15, 3.9, 2.4, 'Today\'s fixes', [
  'Google Fit no longer auto-prompts on launch',
  'Offline table: added tofu, lentils, chickpeas, milk…',
  'USDA junk-match guard: no more phantom 0 kcal items',
], GREY);
card(s, 8.8, 4.15, 3.95, 2.4, 'Docs', [
  'CLAUDE.md fully updated:',
  'on-device architecture + file map',
  'known-issues table incl. today\'s fixes',
], NAVY);
footer(s, 3);

// =================== SLIDE 4 — DATA FLOW ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Architecture', 'SCAN Data Flow');
const fy = 2.0, bw = 2.35, bh = 1.0, gap = 0.25;
const steps = [
  ['1 · Capture', 'Device camera\nsnaps a still', BLUE],
  ['2 · Detect+Classify', 'On-device TFLite\nbox + dish models', TEAL],
  ['3 · Nutrition', 'Offline table +\nportion scaling', GREEN],
  ['4 · GI + Risk', 'Glycemic index +\nclinical-aware risk', AMBER],
  ['5 · AR Overlay', 'Panel pinned\nin camera view', NAVY],
];
let x = 0.55;
steps.forEach((st, i) => {
  s.addShape('roundRect', { x, y: fy, w: bw, h: bh, rectRadius: 0.06, fill: { color: st[2] }, line: { color: st[2] } });
  s.addText(st[0], { x, y: fy + 0.12, w: bw, h: 0.35, align: 'center', fontSize: 14, bold: true, color: WHITE, fontFace: 'Segoe UI' });
  s.addText(st[1], { x, y: fy + 0.45, w: bw, h: 0.5, align: 'center', fontSize: 10.5, color: 'EAF0FF', fontFace: 'Segoe UI' });
  if (i < steps.length - 1) s.addText('▶', { x: x + bw - 0.02, y: fy + 0.28, w: gap + 0.05, h: 0.4, align: 'center', fontSize: 14, color: GREY });
  x += bw + gap;
});
s.addText('Fallback chain if a step has no result', { x: 0.55, y: 3.35, w: 12, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'Low-confidence detection  →  user confirms/corrects in ConfirmFood (one-tap quick-pick produce chips).', fs: 13 },
  { text: 'Recognized dish not in the offline table  →  name + confidence still shown; user-triggered USDA text search (not auto-logged).', fs: 13 },
  { text: 'The meal image — and even the recognized food name — never leave the phone. Zero network calls on SCAN.', fs: 13, color: BLUE, bold: true },
]), { x: 0.6, y: 3.7, w: 12.1, h: 2.4, valign: 'top' });
footer(s, 4);

// =================== SLIDE 5 — KEY ENGINEERING WINS ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Engineering', 'Key Problems Solved');
s.addShape('roundRect', { x: 0.6, y: 1.5, w: 5.9, h: 2.5, rectRadius: 0.08, fill: { color: 'FFF1F1' }, line: { color: 'F3B5B5', width: 1 } });
s.addText('Symptoms', { x: 0.8, y: 1.62, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: 'C0392B', fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'Gemini sent meal photos to Google\'s servers — a privacy problem for Goal 3 human-subjects research.', fs: 12.5 },
  { text: 'Debug builds crashed instantly (SIGABRT) on SCAN if Metro/adb-reverse dropped.', fs: 12.5 },
  { text: 'Google account picker popped up on every app launch.', fs: 12.5 },
]), { x: 0.85, y: 2.0, w: 5.5, h: 1.9, valign: 'top' });

s.addShape('roundRect', { x: 6.8, y: 1.5, w: 5.95, h: 2.5, rectRadius: 0.08, fill: { color: 'EFFaF0' }, line: { color: 'AEE0B4', width: 1 } });
s.addText('Root causes', { x: 7.0, y: 1.62, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: '1E7E34', fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'react-native-fast-tflite loads .tflite models over HTTP from Metro in debug builds (ECONNREFUSED → JNI SIGABRT, not catchable in JS).', fs: 12.5 },
  { text: 'getHealthMetrics() called GoogleFit.authorize() unconditionally on every call, even before login.', fs: 12.5 },
]), { x: 7.05, y: 2.0, w: 5.6, h: 1.9, valign: 'top' });

s.addShape('roundRect', { x: 0.6, y: 4.2, w: 12.15, h: 2.3, rectRadius: 0.08, fill: { color: WHITE }, line: { color: BLUE, width: 1.5 } });
s.addText('The fix', { x: 0.8, y: 4.32, w: 11, h: 0.35, fontSize: 15, bold: true, color: BLUE, fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'Migrated SCAN to three on-device TFLite models — zero network calls, image and recognized name never leave the phone.', fs: 13.5 },
  { text: 'Release/standalone APK bundles models into the APK and loads from disk — no localhost dependency, no crash.', fs: 13.5 },
  { text: 'getHealthMetrics({ interactive }) now defaults to non-interactive → demo profile; only an explicit "Connect Google Fit" tap authorizes.', fs: 13.5, bold: true, color: '1E7E34' },
]), { x: 0.85, y: 4.7, w: 11.9, h: 1.7, valign: 'top' });
footer(s, 5);

// =================== SLIDE 6 — VERIFICATION ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Result', 'Verified On Device');
s.addText(bullets([
  { text: 'Release APK built & installed on Moto G 5G (Android 15) — gradle build log confirms BUILD SUCCESSFUL.', fs: 14 },
  { text: 'SCAN runs three TFLite models locally via react-native-fast-tflite — confirmed zero network calls.', fs: 14 },
  { text: 'mergeCandidates() fuses box-detector + dish-classifier (+ optional produce) output into one ranked list; the user always confirms/corrects in ConfirmFood.', fs: 14 },
  { text: 'Risk engine is profile-aware (Diabetic / Cardiac / Fitness / General) and now also clinical-aware — escalates using the user\'s entered glucose, BP and pulse.', fs: 14, bold: true },
]), { x: 0.6, y: 1.5, w: 7.2, h: 5.0, valign: 'top' });

// privacy guarantee chip
s.addShape('roundRect', { x: 8.0, y: 1.6, w: 4.75, h: 3.4, rectRadius: 0.1, fill: { color: DARK }, line: { color: DARK } });
s.addText('PRIVACY GUARANTEE', { x: 8.2, y: 1.78, w: 4.4, h: 0.3, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, fontFace: 'Segoe UI' });
s.addText('On-device SCAN', { x: 8.2, y: 2.1, w: 4.4, h: 0.55, fontSize: 24, bold: true, color: WHITE, fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'Meal photo never leaves the phone', fs: 13, color: WHITE },
  { text: 'Recognized food name never leaves the phone', fs: 13, color: WHITE },
  { text: 'Health profile + daily log stay in local AsyncStorage', fs: 13, color: WHITE },
]), { x: 8.2, y: 2.7, w: 4.4, h: 1.3, valign: 'top' });
s.addShape('roundRect', { x: 8.2, y: 4.05, w: 1.9, h: 0.5, rectRadius: 0.25, fill: { color: GREEN }, line: { color: GREEN } });
s.addText('OFFLINE', { x: 8.2, y: 4.1, w: 1.9, h: 0.4, align: 'center', fontSize: 14, bold: true, color: WHITE, fontFace: 'Segoe UI' });

s.addText('Why this matters: meets Goal 3 privacy requirements for human-subjects testing, without sacrificing recognition coverage (2,024 dishes + 16 detector classes).',
  { x: 0.6, y: 5.7, w: 12.1, h: 0.9, fontSize: 13, color: NAVY, italic: true, fontFace: 'Segoe UI' });
footer(s, 6);

// =================== SLIDE 7 — LIMITATIONS / NEXT ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Status', 'Known Limitations & Next Steps');
card(s, 0.6, 1.55, 5.95, 4.9, 'Known limitations', [
  'iOS HealthKit bridge not wired (planning file exists, not integrated).',
  'Portion estimation uses the box detector\'s item count, not visual size — no geometry-based estimation yet.',
  'Produce classifier is wired but optional/gated until a model file is dropped in.',
  'One food panel per scan — multi-item plate detection remains a stretch goal.',
  '"Suggest healthier alternative" exists in the risk engine but isn\'t yet shown as an AR overlay.',
], AMBER);
card(s, 6.75, 1.55, 6.0, 4.9, 'Next steps', [
  'Wire iOS HealthKit alongside Google Fit.',
  'Geometry-based visual portion/size estimation.',
  'Per-item detection & multiple AR panels per plate.',
  'Surface "healthier alternative" as an AR overlay (Goal 2).',
  'Activate the optional produce classifier with a real model.',
  'User testing for recognition accuracy & AR usability (Goal 3).',
], BLUE);
footer(s, 7);

// =================== SLIDE 8 — CLOSING ===================
s = pptx.addSlide(); bg(s, NAVY);
s.addShape('rect', { x: 0, y: 3.5, w: W, h: 0.06, fill: { color: BLUE }, line: { color: BLUE } });
s.addText('Summary', { x: 0.8, y: 1.5, w: 11, h: 0.4, fontSize: 14, color: TEAL, bold: true, charSpacing: 3, fontFace: 'Segoe UI' });
s.addText('On-device food recognition + a clinical-aware risk engine are live, fully offline, and account-gated per user.',
  { x: 0.8, y: 2.0, w: 11.6, h: 1.3, fontSize: 26, bold: true, color: WHITE, fontFace: 'Segoe UI' });
s.addText([
  { text: 'Scan a meal  →  on-device AI identifies it and counts items  →  offline nutrition + portion  →  GI + clinical risk (using your own labs)  →  AR overlay.', options: { fontSize: 15, color: 'AEB9CC', fontFace: 'Segoe UI', paraSpaceAfter: 10 } },
  { text: 'Delivered: on-device TFLite pipeline (AIY classifier + box detector) · accounts & expanded health intake · clinical-aware risk engine · modern SVG UI · Google Fit popup fix · nutrition table fixes.', options: { fontSize: 15, color: 'AEB9CC', fontFace: 'Segoe UI' } },
], { x: 0.8, y: 3.8, w: 11.7, h: 2.2, valign: 'top' });
s.addText('AR Diet Monitoring · June 18, 2026', { x: 0.8, y: 6.7, w: 11, h: 0.4, fontSize: 11, color: GREY, fontFace: 'Segoe UI' });

const out = 'D:/UNT_PHD/AR_Sharma/AR_Diet_Gemini_Update.pptx';
pptx.writeFile({ fileName: out }).then(() => console.log('WROTE ' + out));
