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

## Current Implementation State (as of 2026-05-23)

### Stack
- **React Native 0.72.6** + **@reactvision/react-viro 2.41.6** (AR framework)
- Android: ARCore (manifest declares `com.google.ar.core` required). iOS path follows the
  setup guide but has not been built — primary test device is a Moto G 5G.
- Vision: **Google Cloud Vision API** (label + web detection). Keys live in
  `ARDietApp/src/constants/APIKeys.js` (USDA + Vision; both are populated).
- Nutrition: **USDA FoodData Central** REST API, with a small offline hardcoded table for
  ~12 common foods in `services/NutritionAPI.js` (`getNutritionOffline`).
- GI lookup: curated ~100-food table in `src/data/GlycemicIndex.js` with exact-match
  + word-overlap fuzzy match.
- Wearable: **Google Fit** via `react-native-google-fit` (Android). HealthKit (iOS)
  not yet wired. If Fit is unavailable, falls back to a demo profile so the risk
  engine always has data.

### Project layout (live code under `ARDietApp/`)
```
ARDietApp/
├── App.js                          ← root UI: AR view + bottom bar (SCAN / PICK / DETAILS)
├── index.js                        ← AppRegistry entry → App.js
├── src/
│   ├── scenes/
│   │   └── ARFoodScanScene.js      ← Viro AR scene: reticle, billboard nutrition panel
│   ├── services/
│   │   ├── FoodRecognition.js      ← Google Vision label/web-entity detection
│   │   ├── NutritionAPI.js         ← USDA lookup + offline fallback
│   │   └── HealthMetrics.js        ← Google Fit + demo fallback (Goal 2)
│   ├── engine/
│   │   └── RiskEngine.js           ← FSA traffic-light + GI + wearable-aware escalation
│   ├── data/
│   │   └── GlycemicIndex.js        ← GI table + lookup + COMMON_FOODS list
│   └── constants/
│       └── APIKeys.js              ← USDA + Vision keys (populated)
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
- **SCAN flow**: AR-scene screenshot → Google Vision labels → top-5 USDA lookups
  (then offline fallback) → risk engine → AR panel.
- **Details modal**: full per-100g nutrition table, GI line, **Wearable/mHealth section**
  showing source/HR/steps/sleep and the risk reasons fed into the engine.
- **Risk engine**: FSA cardiovascular thresholds + GI-based diabetes flag + wearable
  escalation (HR > 90 + sat fat → caution; steps < 3000 + high glycemic load →
  diabetes flag; sleep < 5h + sugar → caution).

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
- Portion estimation: `PortionEstimator` exists in `files/` but live app uses USDA's
  per-100g values directly (no portion override yet).
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
| `No food labels detected` | Vision returned only generic labels (food/dish/plate) | All filtered in `FoodRecognition.NON_FOOD_LABELS`; fall back to PICK |
| `USDA had no match` | weird Vision label (e.g. "comfort food") | App now tries top-5 guesses, then offline table, before erroring |
| Risk badge always "safe" on demo | wearable metrics absent | `HealthMetrics.getHealthMetrics` now always returns at least demo profile |

