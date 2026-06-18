# AR Diet Monitoring Project — Context

This file is auto-loaded each session. It holds the research question, goals, and the
Project-1 features (from the UNT Spring 2026 VR projects page) that align with this work,
so future sessions don't have to re-derive them.

**Source for Project 1 reference:** https://ci.unt.edu/ssharma/teaching/spring26/vrprojects26.html

---

## Research Question

How can real-time diet monitoring be enhanced through a mobile augmented reality (AR)
application integrated with mHealth and wearable health data to support chronic disease
management?

---

## Goal 1 — Design and develop a Mobile AR application for interactive real-time diet monitoring

### 1.1 Build a Mobile AR App for Real-Time Diet Monitoring
- Smartphone-based AR application (iOS / Android) that uses the device camera to analyze
  food in real time.
- AR interface allows users to:
  - Tap or point at food items on a plate
  - Overlay nutritional insights directly on detected items
  - Interact with food objects in the real-world view (highlight, select, compare portions)
  - Use on-device spatial AR interaction via camera-based overlays

### 1.2 Extract Nutritional Value and Display in AR
- Apply computer vision and food recognition models to identify food items from camera input.
- Estimate portion size and compute nutritional values using food databases
  (e.g., USDA Food Data Central).
- Display results as AR overlays:
  - Nutritional breakdown shown directly above each food item
  - Structured format: `Calories: X kcal, Protein: X g, Carbs: X g, Fat: X g`
- Allow users to toggle detailed views (summary vs. expanded nutrition panel).
- Computationally analyze the food plate and extract nutritional values.
- Display as a list of `<nutrition, measure>` pairs.

---

## Goal 2 — Integrate real-time health data from mobile phones and wearable devices for risk assessment

- Develop a mobile health integration layer connecting the AR app with:
  - iHealth smart watch, or
  - Google Fit / Wear OS devices
- Collect real-time physiological and behavioral metrics:
  - Heart rate
  - Sleep duration / quality
  - Activity level (steps, calories burned)
- Combine dietary intake + health metrics to compute personalized risk indicators:
  - Cardiovascular risk flags (e.g., high saturated fat + elevated resting heart rate)
  - Diabetes-related alerts (e.g., high sugar intake + low activity levels)
- Provide AR-based feedback:
  - Highlight "risky" food items in red
  - Suggest healthier alternatives in real time
  - Display risk score overlays in the camera view

---

## Goal 3 — Design use cases and perform real-world experiments to measure effectiveness

### Use cases
- A diabetic patient scanning meals at home or restaurants
- A cardiac-risk user tracking saturated fat intake during daily meals
- A fitness user optimizing macros in real time using AR feedback

### Real-world testing dimensions
- Accuracy of food recognition and nutrition estimation
- User engagement and usability of AR overlays
- Effectiveness of risk feedback in influencing dietary decisions
- Integration reliability between mobile AR and wearable health data

---

## Project 1 Reference (UNT Spring 2026): VR-DiabEdu

**Title:** VR-Diabetes Education and Glucose Monitoring Instruction System
**Students:** Ananya Agarwal, Pranava Preethivardhan Chanduri, Praneeth Kumar Thoranala
**Report:** /ssharma/teaching/spring26/doc/1-vr-diablets.pdf

Project 1 itself is a **VR** (Unity 3D) diabetes-education system — not a mobile AR app.
Only the features below are carried over into this mobile AR project because they
directly support the three goals above. The VR-specific scaffolding (city environment,
hospital rooms, training-room navigation) is **not** in scope.

### Features adopted from Project 1 (aligned with goals)

| Project 1 feature | Adopted as | Aligned goal |
|---|---|---|
| Conversational AI characters (Convai-style natural language) discussing blood glucose, diet, symptoms, treatment | In-app conversational assistant that explains AR nutrition overlays and answers diet/health questions in natural language | Goal 1 (interactive diet monitoring), Goal 2 (risk explanation) |
| Meal-construction activity with a glycemic-index (GI) target | GI-aware meal scoring layered on top of the AR nutrition overlay, so diabetic users see a live GI estimate per item and per plate | Goal 2 (diabetes-related alerts), Goal 3 (diabetic-patient use case) |
| Food classification by GI category | GI category tag (low / medium / high) shown alongside macro overlay; high-GI items participate in the "risky food" red-highlight rule when combined with low activity from wearable data | Goal 2 (risk feedback) |
| "Active, decision-driven" health-education framing | AR feedback is designed to drive an immediate dietary decision (eat / swap / portion-adjust), not just display data | Goal 1 (interaction), Goal 3 (effectiveness of risk feedback) |

### Features intentionally NOT adopted
- Unity 3D VR environment, explorable city, hospital waiting area / reception /
  consultation room, training room — these are VR-immersion scaffolding and do not
  contribute to real-time mobile AR diet monitoring or wearable integration.

---

## Working notes for future sessions
- Platform target: mobile AR (iOS / Android), camera-based overlays. Not VR, not headset.
- Nutrition data source of record: USDA Food Data Central (unless replaced explicitly).
- Wearable integration targets: iHealth smart watch and Google Fit / Wear OS.
- When adding features, check alignment with Goals 1–3 before pulling more from Project 1
  or other VR-projects-page entries.

---

## Current Implementation State (as of 2026-06-11)

### Stack
- **React Native 0.72.6** + **@reactvision/react-viro 2.41.6** (AR framework)
- Android: ARCore (manifest declares `com.google.ar.core` required). iOS path follows the
  setup guide but has not been built — primary test device is a Moto G 5G.
- **Recognition (current): up to THREE on-device TFLite models** via `react-native-fast-tflite`,
  fused in `App.js onScan` (`mergeCandidates`). The meal image NEVER leaves the device
  (privacy — required this over Gemini, which sent images to Google):
  1. **Dish CLASSIFIER — Google "AIY Vision Classifier Food V1"**
     (`services/LocalFoodClassifier.js`, model `assets/aiy_food_V1.tflite`,
     TF Hub/Kaggle id `google/aiy/tfLite/vision-classifier-food-v1`). MobileNet-based,
     **2,024 food-dish vocabulary** incl. international cuisine; 224×224 input; labels in
     `src/data/AiyFoodLabels.js`. Answers "what dish is this?"
  2. **Box DETECTOR — SSD MobileNet (Food.AI / Open Images food classes)**
     (`services/FoodBoxDetector.js`, model `assets/food_detect.tflite`, 16-class labelmap:
     bread, pancake, waffle, bagel, muffin, doughnut, hamburger, pizza, sandwich, hot dog,
     french fries, apple, orange, banana, grape). TF1 detection-API export. Answers
     "WHERE is the food and HOW MANY items?" — drives item counting ("3 × apple") and
     portion scaling.
  3. **Produce CLASSIFIER — raw fruit/vegetable model** (`services/LocalProduceClassifier.js`,
     model `assets/produce.tflite`, labels `src/data/ProduceLabels.js`). Fills the dish
     classifier's blind spot: AIY Food V1 has **no bare-fruit classes** (its vocab is all
     prepared dishes — Apple pie, Banana split…), so raw produce was the accuracy gap. This
     model is **wired but OPTIONAL** — gated behind `services/produceModelSource.js` (exports
     `null` until you drop a model in + flip one require line). Until then it returns `[]`
     and SCAN is unchanged. See `assets/README_MODEL.md` for how to obtain/activate.
  Fusion (`App.js mergeCandidates`): all models merge into one ranked candidate list — none
  auto-wins, but **raw-food signals (produce classifier + box detector) get a rank boost**
  over the dish classifier (whose vocabulary can't emit a bare fruit), and multi-model
  agreement boosts further. The user always confirms/corrects in the `ConfirmFood` step
  (now with one-tap quick-pick produce chips). `recognizedBy` shows as "Confirmed by you".
  **Legacy, no longer called by SCAN:** `LocalFoodDetector.js` (YOLOv8n COCO,
  `assets/yolov8n_float32.tflite`), `GeminiVision.js`, `FoodRecognition.js` (Google Vision).
- Nutrition: **fully offline table** in `services/NutritionAPI.js` (`getNutritionOffline`,
  now ~70 foods, each with a typical `serving` for portion). SCAN uses offline only —
  zero network calls; even the recognized food *name* stays on the phone. USDA REST is
  still used by the **PICK** path (text-only food-name query, no image), and offered as a
  user-triggered text search when SCAN recognizes a dish that isn't in the offline table.
- GI lookup: curated ~100-food table in `src/data/GlycemicIndex.js` with exact-match
  + word-overlap fuzzy match.
- Wearable: **Google Fit** via `react-native-google-fit` (Android). HealthKit (iOS)
  not yet wired. If Fit is unavailable, falls back to a demo profile so the risk
  engine always has data. Fit is only queried AFTER login (avoids the Google account
  prompt appearing before sign-in).
- **Accounts & login (local, on-device — NO server):** `services/Accounts.js` +
  `ui/Login.js`. Sign-up/login gate the whole app (`App.js` returns `<Login>` until
  `authUser` is set). Accounts live in AsyncStorage `ARDIET_ACCOUNTS_V1` (password is
  djb2-hashed — obfuscation for a local prototype, NOT real security; there's no backend
  to defend). Session = `ARDIET_SESSION_V1`. Each account stores its own health profile;
  the daily food log is per-user (`ARDIET_LOG_V1::<username>`). Logout lives in the
  profile sheet. Health data never leaves the phone (Goal 3 privacy).
- **Expanded health profile (`ui/HealthIntake.js`, `EMPTY_USER`):** beyond age/sex/
  height/weight/focus/conditions/allergies/goal, now also captures **blood group,
  fasting glucose (mg/dL), last BP (systolic/diastolic), resting pulse, and free-text
  notes** during profile setup.
- **Clinical-aware recommendations (`engine/RiskEngine.js`):** `assessClinical(user)`
  interprets the entered vitals (ADA fasting-glucose cutoffs 100/126; ACC/AHA BP
  130/80 & 140/90; pulse >100). `assessForUser` then: feeds the manual pulse into the
  HR-aware rules when no wearable, and **escalates the risk level** when the user's own
  labs make a borderline food riskier (high glucose + high-GI/sugar → diabetes flag;
  hypertension + sodium ≥400 mg). The recommendation string cites the user's actual
  numbers (e.g. "Your last fasting sugar (140 mg/dL, prediabetic range)…"). Also added
  this round: `assessNutritionQuality()` ("Nutritious / Low nutrition / Empty calories")
  and history-aware budget lines (uses today's running total vs goal).

### Project layout (live code under `ARDietApp/`)
```
ARDietApp/
├── App.js                          ← root UI: AR view + bottom bar (SCAN / PICK / DETAILS)
├── index.js                        ← AppRegistry entry → App.js
├── src/
│   ├── scenes/
│   │   └── ARFoodScanScene.js      ← Viro AR scene: reticle, billboard nutrition panel
│   ├── services/
│   │   ├── LocalFoodClassifier.js  ← ON-DEVICE dish classifier (AIY Food V1, 2,024 dishes) — current SCAN
│   │   ├── FoodBoxDetector.js      ← ON-DEVICE box detector (SSD MobileNet, Food.AI) — counting/portions
│   │   ├── LocalFoodDetector.js    ← YOLOv8 COCO detector (legacy, unused by SCAN)
│   │   ├── FoodRecognition.js      ← Google Vision (legacy, unused by SCAN)
│   │   ├── GeminiVision.js         ← Gemini multimodal (legacy, unused by SCAN — privacy)
│   │   ├── NutritionAPI.js         ← offline table ~70 foods (SCAN) + USDA lookup (PICK)
│   │   └── HealthMetrics.js        ← Google Fit + demo fallback (Goal 2)
│   ├── engine/
│   │   └── RiskEngine.js           ← FSA traffic-light + GI + wearable-aware escalation
│   ├── ui/                         ← modern food-tracker UI (react-native-svg)
│   │   ├── theme.js                ← colors, RISK colors, PROFILES (use-case modes)
│   │   ├── Ring.js                 ← SVG calorie/macro rings + MacroBar
│   │   ├── Sheet.js                ← shared bottom-sheet modal shell
│   │   ├── NutritionCard.js        ← Goal 1: rings + GI + portion + summary/expanded toggle
│   │   ├── Dashboard.js            ← Goal 1/3: daily calorie ring + macro bars + food-log timeline
│   │   ├── HealthPanel.js          ← Goal 2: risk gauge + wearable cards + healthier swap
│   │   └── ProfilePicker.js        ← Goal 3: Diabetic/Cardiac/Fitness/General modes
│   ├── data/
│   │   ├── GlycemicIndex.js        ← GI table + lookup + COMMON_FOODS list
│   │   └── AiyFoodLabels.js        ← 2,024 labels for the AIY classifier (from model metadata)
│   └── constants/
│       └── APIKeys.js              ← USDA + Vision + Gemini keys (populated)
├── assets/
│   ├── aiy_food_V1.tflite          ← dish classifier model (current SCAN)
│   ├── food_detect.tflite          ← box detector model (current SCAN)
│   ├── yolov8n_float32.tflite      ← YOLOv8 model (legacy)
│   └── README_MODEL.md             ← how the models were obtained/exported
├── android/                        ← manifest already has CAMERA, ARCore, INTERNET, BODY_SENSORS, ACTIVITY_RECOGNITION
└── ios/                            ← scaffold only; not built
```

> The `files/` folder at the repo root contains alternate reference implementations
> from the planning phase (RNCamera-based multi-region scan, richer NutritionPanel
> with summary/expanded toggle). They are **not** wired into the live app yet — pull
> from them when extending Goal 1 with per-item AR panels.

### What works end-to-end
- **AR scene boots**: small green reticle pulses on detected horizontal planes; tapping
  one anchors a position. If no plane is anchored, the nutrition panel still appears
  60 cm in front of the camera (billboard-oriented) — so scanning is never blocked by
  plane detection.
- **PICK flow**: search/select from ~140 GI-tabled foods → USDA lookup (with offline
  fallback) → risk engine → AR panel + bottom-bar summary + details modal.
- **SCAN flow (on-device, fully offline)**: `captureScene()` snaps a still via
  `react-native-image-picker` `launchCamera` → base64 JPEG (decoded with `jpeg-js`) →
  two TFLite models run locally via `react-native-fast-tflite`:
  `FoodBoxDetector.detectFoodBoxes` (SSD MobileNet — boxes + item count) and
  `LocalFoodClassifier.classifyFoodLocal` (**AIY Food V1** — top-K dish candidates).
  Fusion: a confident box detection wins (it can count, e.g. "3 × apple" scales the
  portion); otherwise the classifier's top dish is used → `getNutritionOffline`
  (offline macros + typical serving portion) → risk engine → AR panel. **The image —
  and even the recognized food name — never leaves the phone.** Portion (grams +
  per-portion kcal) shows on the AR panel, bottom bar, and Details; `recognizedBy` =
  "On-device AI (xx%)" with other candidates under "Also detected". If the recognized
  dish isn't in the offline table, the card still shows name + confidence (Goal 1) and
  offers a user-triggered USDA text search (not auto-logged).

  > **Why on-device instead of Gemini:** Gemini sent meal photos to Google's servers — a
  > privacy problem (esp. Goal 3 human-subjects research). TFLite runs locally, offline.
  > The earlier YOLOv8n/COCO detector only knew 10 food classes; the AIY Food V1
  > classifier covers 2,024 dishes, with the SSD MobileNet box detector adding
  > localization/counting that a classifier can't do. Both model files ship in
  > `ARDietApp/assets/` (see `assets/README_MODEL.md`). No native rebuild needed to swap
  > a model — just replace the file and reload Metro.

  > **Capture note:** still uses a photo intent, not an AR-frame screenshot — Viro renders the
  > camera to a GL `SurfaceView` that `captureRef` reads as black, and Viro's `takeScreenshot`
  > needs `WRITE_EXTERNAL_STORAGE` (ungrantable on Android 13+). `launchCamera` sidesteps both
  > (ARCore pauses during the intent, then resumes).
- **Details modal**: full per-100g nutrition table, GI line, **Wearable/mHealth section**
  showing source/HR/steps/sleep and the risk reasons fed into the engine.
- **Risk engine**: FSA cardiovascular thresholds + GI-based diabetes flag + wearable
  escalation (HR > 90 + sat fat → caution; steps < 3000 + high glycemic load →
  diabetes flag; sleep < 5h + sugar → caution). Now **profile-aware** —
  `computeRisk(nutrition, health, profile)` retunes weights/thresholds per use-case
  (diabetic ↑sugar/GI, cardiac ↑satfat/sodium, fitness flags low protein).
- **Modern UI (food-tracker style, `src/ui/`)**: top summary pill (mini calorie ring +
  profile chip), tappable last-scan card, bottom action bar (Today/Pick/SCAN/Health/Profile),
  and bottom-sheet panels: NutritionCard (rings + summary/expanded), Dashboard (daily ring +
  macro bars + food-log timeline), HealthPanel (risk gauge + wearable cards + swap),
  ProfilePicker (use-case modes). Daily **food log + chosen profile persist via AsyncStorage**
  (`ARDIET_LOG_V1` keyed by date, `ARDIET_PROFILE_V1`); daily totals drive the dashboard rings.
  New dep: **react-native-svg 13.14.0** (pinned for RN 0.72).

### Known fixes applied this session
- `App.js onScan`: was reading `navRef.current.arSceneNavigator.takeScreenshot` which is
  `undefined` in @reactvision/react-viro 2.41 — replaced with a helper that tries
  `navRef.current.takeScreenshot`, `._arNavigator.takeScreenshot`, and
  `.arSceneNavigator.takeScreenshot` in order. Was the root cause of every "scan error".
- `ARFoodScanScene.js`: removed the 1m × 1m opaque green `ViroQuad` that covered the
  camera view on plane detection; replaced with an 18cm pulsing reticle via
  `ViroARPlaneSelector`. Panel now uses billboard transform + camera-relative fallback
  position so it always renders after a successful scan.
- Scan error messages now name the failing step (capture / image read / Vision / USDA),
  with offline-table fallback before showing an error.

### How to run (Android, current setup)
```powershell
cd D:\UNT_PHD\AR_Sharma\ARDietApp
npx react-native start          # in one terminal
npx react-native run-android    # in another, with the Moto G 5G connected via USB
```
APK has been built and installed (`gradle-build5.log` → BUILD SUCCESSFUL).
A real device is required — emulators don't expose ARCore.

### What's still mocked or open
- iOS HealthKit bridge: file exists in planning (`files/HealthKitService.js`) but not
  wired into `services/HealthMetrics.js`.
- Portion estimation: SCAN uses the offline table's typical `serving` grams, scaled by
  the box detector's item count ("3 × apple"). No visual size estimation yet. The PICK
  path still uses USDA per-100g only (no portion). `files/PortionEstimator.js`
  (geometry-based) remains unused.
- Multi-food per plate: live scene shows one panel per scan. Multi-region detection +
  per-item panels remain a stretch goal — see `files/ARFoodScanScene.js` for the
  intended architecture.
- "Suggest healthier alternatives" is implemented in `RiskEngine.suggestAlternative`
  and surfaced in the Details modal, but is not yet shown as an AR overlay.

### Common errors and the actual fix in this codebase
| Symptom | Real cause | Fix |
|---|---|---|
| `AR scene not ready` on SCAN | wrong takeScreenshot ref path | Use the multi-shape helper in `App.js getTakeScreenshot` (already applied) |
| Camera shows green wall, no overlays | giant ViroQuad covering plane | Use small reticle via `ViroARPlaneSelector` (already applied) |
| `On-device food model failed to load` | `assets/aiy_food_V1.tflite` missing/corrupt | Restore the model file (see `assets/README_MODEL.md`); reload Metro — no native rebuild |
| `No food recognized on-device` | both box detector and classifier below confidence threshold | Retake with a clearer/closer shot, or use PICK |
| Scanned dish shows "Not in the offline nutrition table" | AIY recognized a dish outside the ~70-food offline table | Expected: card still shows name+confidence and offers user-triggered USDA text search |
| `No food labels detected` *(legacy Vision path)* | Vision returned only generic labels (food/dish/plate) | All filtered in `FoodRecognition.NON_FOOD_LABELS`; fall back to PICK |
| `Gemini HTTP 400/403` *(legacy Gemini path)* | AI Studio key invalid/disabled (must start with `AIza`) or model name wrong | Replace `GEMINI_API_KEY` in `APIKeys.js` — but SCAN no longer calls Gemini |
| `USDA had no match` (PICK) | odd food-name query | App tries USDA, then offline table, before erroring |
| Risk badge always "safe" on demo | wearable metrics absent | `HealthMetrics.getHealthMetrics` now always returns at least demo profile |

