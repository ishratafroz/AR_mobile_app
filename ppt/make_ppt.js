const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

pptx.author = 'AR Diet Monitoring';
pptx.title = 'AR Diet Monitoring — Gemini Vision Integration';
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
  slide.addText('AR Diet Monitoring  ·  Gemini Vision Integration', { x: 0.6, y: 7.05, w: 8, h: 0.3, fontSize: 9, color: GREY, fontFace: 'Segoe UI' });
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
s.addText('Gemini Vision — Food Recognition & Nutrition Estimation', { x: 0.8, y: 3.05, w: 11.7, h: 0.7, fontSize: 22, color: 'AEB9CC', fontFace: 'Segoe UI' });
s.addText([
  { text: 'Integrating Google Gemini multimodal AI into the AR scan pipeline', options: { fontSize: 13, color: 'AEB9CC', fontFace: 'Segoe UI' } },
], { x: 0.8, y: 3.75, w: 11, h: 0.5 });
s.addText('Updates achieved · June 4, 2026', { x: 0.8, y: 5.25, w: 11, h: 0.4, fontSize: 13, color: WHITE, bold: true, fontFace: 'Segoe UI' });
s.addText('Platform: React Native 0.72 · @reactvision/react-viro (ARCore) · Android (Moto G 5G, Android 15)', { x: 0.8, y: 5.7, w: 11.5, h: 0.4, fontSize: 11, color: GREY, fontFace: 'Segoe UI' });

// =================== SLIDE 2 — OBJECTIVE / SCOPE ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'This update', 'Objective & Scope');
s.addText(bullets([
  { text: 'Goal: enhance real-time diet monitoring with AI food recognition (Project Goal 1.2).', bold: true },
  'Integrate Google Gemini multimodal model into the AR app.',
  { text: 'Two capabilities delivered:', bold: true },
  { text: 'Gemini food recognition — identify the specific dish from the camera photo.', sub: true },
  { text: 'Gemini nutrition + portion estimation — grams, per-portion kcal, and per-100g macros.', sub: true },
  'Keep USDA FoodData Central as the authoritative macro source when it has a match.',
  'Graceful fallbacks so a scan is never a dead end.',
]), { x: 0.6, y: 1.5, w: 7.3, h: 5.2, valign: 'top' });

card(s, 8.2, 1.55, 4.55, 2.45, 'Recognition pipeline (priority)', [
  '1. Gemini — specific food + portion + macros',
  '2. USDA — authoritative per-100g macros',
  '3. Offline table — ~12 common foods',
  '4. Gemini per-100g estimate (if USDA misses)',
], BLUE);
card(s, 8.2, 4.15, 4.55, 2.4, 'Aligned project goals', [
  'Goal 1: interactive real-time diet monitoring',
  'Goal 1.2: CV food recognition + nutrition in AR',
  'Feeds Goal 2 risk engine (GI, macros)',
], TEAL);
footer(s, 2);

// =================== SLIDE 3 — WHAT WAS DELIVERED ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Deliverables', 'What Was Built');
card(s, 0.6, 1.5, 3.9, 2.45, 'New: GeminiVision service', [
  'src/services/GeminiVision.js',
  'One structured-JSON call → foods[], portionGrams, portionLabel, per100g',
  'analyzeFoodImageGemini() + nutritionFromGemini()',
  'Model: gemini-flash-latest',
], BLUE);
card(s, 4.7, 1.5, 3.9, 2.45, 'SCAN flow rewired', [
  'App.js onScan() = Gemini-first',
  'Photo capture via device camera',
  'USDA / offline / Gemini fallbacks',
  'Surfaces real error reason',
], TEAL);
card(s, 8.8, 1.5, 3.95, 2.45, 'UI: portion shown', [
  'AR overlay panel: "Portion ~Xg (Y kcal)"',
  'Bottom bar: kcal / g summary',
  'Details: "Portion (estimated)" section',
  'Shows Recognized by: Gemini',
], GREEN);
card(s, 0.6, 4.15, 3.9, 2.4, 'API keys', [
  'GEMINI_API_KEY added & wired',
  'Verified live against Gemini API',
  'USDA key active',
], AMBER);
card(s, 4.7, 4.15, 3.9, 2.4, 'Dependency added', [
  'react-native-image-picker',
  'Reliable camera still capture',
  'Autolinked, APK rebuilt & installed',
], GREY);
card(s, 8.8, 4.15, 3.95, 2.4, 'Docs', [
  'CLAUDE.md updated:',
  'new SCAN flow + capture rationale',
  'error table + known issues',
], NAVY);
footer(s, 3);

// =================== SLIDE 4 — DATA FLOW ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Architecture', 'SCAN Data Flow');
const fy = 2.0, bw = 2.35, bh = 1.0, gap = 0.25;
const steps = [
  ['1 · Capture', 'System camera\nsnaps a still', BLUE],
  ['2 · Gemini', 'Recognize food\n+ portion + macros', TEAL],
  ['3 · USDA', 'Authoritative\nper-100g macros', GREEN],
  ['4 · Risk + GI', 'Traffic-light +\nglycemic index', AMBER],
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
  { text: 'Gemini fails / no food  →  Google Vision labels (note: currently disabled — billing off on its GCP project).', fs: 13 },
  { text: 'USDA no match  →  offline table  →  Gemini\'s own per-100g estimate.', fs: 13 },
  { text: 'Portion (grams + per-portion kcal) is attached only on the Gemini path.', fs: 13, color: BLUE, bold: true },
]), { x: 0.6, y: 3.7, w: 12.1, h: 2.4, valign: 'top' });
footer(s, 4);

// =================== SLIDE 5 — KEY FIX ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Engineering', 'Key Problem Solved: Black-Image Bug');
s.addShape('roundRect', { x: 0.6, y: 1.5, w: 5.9, h: 2.5, rectRadius: 0.08, fill: { color: 'FFF1F1' }, line: { color: 'F3B5B5', width: 1 } });
s.addText('Symptom', { x: 0.8, y: 1.62, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: 'C0392B', fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'Every scan returned "Gemini detected no food".', fs: 12.5 },
  { text: 'AR screenshot came back fully black.', fs: 12.5 },
  { text: 'Fell through to Vision → HTTP 403.', fs: 12.5 },
]), { x: 0.85, y: 2.0, w: 5.5, h: 1.9, valign: 'top' });

s.addShape('roundRect', { x: 6.8, y: 1.5, w: 5.95, h: 2.5, rectRadius: 0.08, fill: { color: 'EFFaF0' }, line: { color: 'AEE0B4', width: 1 } });
s.addText('Root cause', { x: 7.0, y: 1.62, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: '1E7E34', fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'Viro renders the camera to a GL SurfaceView.', fs: 12.5 },
  { text: 'view-shot / captureRef can\'t read it → black frame.', fs: 12.5 },
  { text: 'Viro takeScreenshot needs WRITE_EXTERNAL_STORAGE — ungrantable on Android 13+ (errorCode 1).', fs: 12.5 },
]), { x: 7.05, y: 2.0, w: 5.6, h: 1.9, valign: 'top' });

s.addShape('roundRect', { x: 0.6, y: 4.2, w: 12.15, h: 2.3, rectRadius: 0.08, fill: { color: WHITE }, line: { color: BLUE, width: 1.5 } });
s.addText('The fix', { x: 0.8, y: 4.32, w: 11, h: 0.35, fontSize: 15, bold: true, color: BLUE, fontFace: 'Segoe UI' });
s.addText(bullets([
  { text: 'Capture a real photo with the device camera (react-native-image-picker launchCamera) instead of screenshotting the GL surface.', fs: 13.5 },
  { text: 'ARCore pauses while the camera intent is up, then resumes — no camera contention.', fs: 13.5 },
  { text: 'Gemini now receives a clear photo → accurate recognition, portion and nutrition.', fs: 13.5, bold: true, color: '1E7E34' },
]), { x: 0.85, y: 4.7, w: 11.9, h: 1.7, valign: 'top' });
footer(s, 5);

// =================== SLIDE 6 — VERIFICATION ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Result', 'Verified On Device');
s.addText(bullets([
  { text: 'Built & installed on Moto G 5G (Android 15); ARCore active; camera permission granted.', fs: 14 },
  { text: 'Gemini API verified live (recognition + structured JSON + portion + macros).', fs: 14 },
  { text: 'Live scan of a mandarin returned a complete, sensible result:', fs: 14, bold: true },
]), { x: 0.6, y: 1.5, w: 7.2, h: 2.6, valign: 'top' });

// result chip
s.addShape('roundRect', { x: 8.0, y: 1.6, w: 4.75, h: 3.4, rectRadius: 0.1, fill: { color: DARK }, line: { color: DARK } });
s.addText('LIVE SCAN OUTPUT', { x: 8.2, y: 1.78, w: 4.4, h: 0.3, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, fontFace: 'Segoe UI' });
s.addText('mandarin', { x: 8.2, y: 2.1, w: 4.4, h: 0.55, fontSize: 26, bold: true, color: WHITE, fontFace: 'Segoe UI' });
s.addText([
  { text: '46 kcal', options: { fontSize: 18, bold: true, color: GREEN, fontFace: 'Segoe UI' } },
  { text: '  for  ', options: { fontSize: 13, color: 'AAB3C2', fontFace: 'Segoe UI' } },
  { text: '80 g portion', options: { fontSize: 18, bold: true, color: WHITE, fontFace: 'Segoe UI' } },
], { x: 8.2, y: 2.75, w: 4.4, h: 0.5 });
s.addText([
  { text: 'GI 43', options: { fontSize: 15, bold: true, color: WHITE, fontFace: 'Segoe UI' } },
  { text: '  (low glycemic index)', options: { fontSize: 12, color: 'AAB3C2', fontFace: 'Segoe UI' } },
], { x: 8.2, y: 3.35, w: 4.4, h: 0.4 });
s.addShape('roundRect', { x: 8.2, y: 3.85, w: 1.7, h: 0.5, rectRadius: 0.25, fill: { color: GREEN }, line: { color: GREEN } });
s.addText('SAFE', { x: 8.2, y: 3.9, w: 1.7, h: 0.4, align: 'center', fontSize: 14, bold: true, color: WHITE, fontFace: 'Segoe UI' });
s.addText('Recognized by: Gemini', { x: 8.2, y: 4.5, w: 4.4, h: 0.35, fontSize: 12, italic: true, color: 'AAB3C2', fontFace: 'Segoe UI' });

s.addText('Why this proves the integration works: the "/ 80 g" portion value is set only on the Gemini path, so a populated portion confirms recognition + portion + nutrition all ran end-to-end.',
  { x: 0.6, y: 5.25, w: 12.1, h: 1.1, fontSize: 13, color: NAVY, italic: true, fontFace: 'Segoe UI' });
footer(s, 6);

// =================== SLIDE 7 — LIMITATIONS / NEXT ===================
s = pptx.addSlide(); bg(s, LIGHT); header(s, 'Status', 'Known Limitations & Next Steps');
card(s, 0.6, 1.55, 5.95, 4.9, 'Known limitations', [
  'Google Vision fallback disabled (billing off on its GCP project) — Gemini is the working path.',
  'Gemini free-tier rate limits: rapid scans can briefly 429 (auto-retry / rescan).',
  'SCAN opens the camera to take a photo (not an instant live-frame grab) — a workaround for the GL-surface capture limit.',
  'PICK flow still uses USDA per-100g only (no portion).',
  'One food panel per scan (multi-item plate = stretch goal).',
], AMBER);
card(s, 6.75, 1.55, 6.0, 4.9, 'Next steps', [
  'Show "healthier alternative" as an AR overlay (Goal 2).',
  'Per-item detection & multiple AR panels per plate.',
  'Portion estimation on the PICK path too.',
  'Wire iOS HealthKit alongside Google Fit.',
  'Optional: enable billing to restore Vision as a true fallback.',
  'User testing for recognition accuracy & AR usability (Goal 3).',
], BLUE);
footer(s, 7);

// =================== SLIDE 8 — CLOSING ===================
s = pptx.addSlide(); bg(s, NAVY);
s.addShape('rect', { x: 0, y: 3.5, w: W, h: 0.06, fill: { color: BLUE }, line: { color: BLUE } });
s.addText('Summary', { x: 0.8, y: 1.5, w: 11, h: 0.4, fontSize: 14, color: TEAL, bold: true, charSpacing: 3, fontFace: 'Segoe UI' });
s.addText('Gemini food recognition + nutrition/portion estimation is live and verified on device.',
  { x: 0.8, y: 2.0, w: 11.6, h: 1.3, fontSize: 26, bold: true, color: WHITE, fontFace: 'Segoe UI' });
s.addText([
  { text: 'Scan a meal  →  Gemini identifies it, estimates the portion, and computes nutrition  →  USDA refines macros  →  GI + risk  →  AR overlay.', options: { fontSize: 15, color: 'AEB9CC', fontFace: 'Segoe UI', paraSpaceAfter: 10 } },
  { text: 'Delivered: GeminiVision service · reworked SCAN pipeline · reliable camera capture · portion shown across AR panel, bottom bar & details.', options: { fontSize: 15, color: 'AEB9CC', fontFace: 'Segoe UI' } },
], { x: 0.8, y: 3.8, w: 11.7, h: 2.2, valign: 'top' });
s.addText('AR Diet Monitoring · June 4, 2026', { x: 0.8, y: 6.7, w: 11, h: 0.4, fontSize: 11, color: GREY, fontFace: 'Segoe UI' });

const out = 'D:/UNT_PHD/AR_Sharma/AR_Diet_Gemini_Update.pptx';
pptx.writeFile({ fileName: out }).then(() => console.log('WROTE ' + out));
