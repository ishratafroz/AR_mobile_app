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
- Wearable (Goal 2): **Android Health Connect** is now the PREFERRED source
  (`services/HealthConnect.js`, lib `react-native-health-connect`), with **Google Fit**
  (`react-native-google-fit`) and a demo profile as fallbacks — `getHealthMetrics()`
  tries Health Connect → Google Fit → demo. Health Connect reads heart rate, resting HR,
  steps, active/total calories, sleep, and the latest blood glucose + blood pressure
  (which auto-fill BLANK profile vitals). Returns `{ source:'health_connect', ... }`.
  Non-interactive calls read only if permission was already granted (no launch popup);
  the **"Connect Health Connect"** button in `ui/HealthPanel.js` (`App.connectHealth`,
  interactive) prompts the HC permission screen. Interactive calls bypass the 60s cache.
  HealthKit (iOS) still not wired. **Build note / gotcha (version is load-bearing):**
  pinned to **`react-native-health-connect@3.3.3`** — NOT older, NOT newer:
  - 1.x (connect-client 1.0.0-alpha11) builds on compileSdk 33 but CANNOT see Android
    14+ *built-in* Health Connect → on this Android 15 device `getSdkStatus()` throws
    "Service not available". Dead end.
  - 3.4.0+ (connect-client 1.1.0-alpha11) needs **compileSdk 35**, which needs AGP 8.x;
    RN 0.72 ships AGP 7.4.2 whose aapt2 can't parse API 35's sparse resources
    (`RES_TABLE_TYPE_TYPE entry offsets overlap`). Dead end without an AGP upgrade.
  - **3.0.0–3.3.3 (connect-client 1.1.0-alpha06) build on compileSdk 34 AND support
    built-in HC.** 3.3.3 is the newest of these → verified `getSdkStatus()==3` (AVAILABLE)
    on the device.
  So: `android/build.gradle` compileSdk **34** + build-tools **34.0.0** (both had to be
  `sdkmanager`-installed; android-35's android.jar was also corrupt). targetSdk kept 33.
  v3 `readRecords` returns `{records}` (`HealthConnect.js` `recsOf()` handles both shapes).
  Added health read permissions + permissions-rationale activity-alias/intent-filter in
  `AndroidManifest.xml`. See [[ollama-llama-setup]]/[[android-build-workaround]] for build/run.
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
│   │   ├── RiskEngine.js           ← FSA traffic-light + GI + wearable-aware escalation
│   │   └── Assistant.js            ← on-device, rule-based conversational answers (NO network/LLM)
│   ├── ui/                         ← modern food-tracker UI (react-native-svg)
│   │   ├── theme.js                ← colors, RISK colors, PROFILES (use-case modes)
│   │   ├── Ring.js                 ← SVG calorie/macro rings + MacroBar
│   │   ├── Sheet.js                ← shared bottom-sheet modal shell
│   │   ├── NutritionCard.js        ← Goal 1: rings + GI + portion + summary/expanded toggle
│   │   ├── Dashboard.js            ← Goal 1/3: Today tab (ring+macros+log) + Trends tab (multi-day timeseries chart)
│   │   ├── Assistant.js            ← Goal 1/2: on-device chat sidebar (slide-in), uses engine/Assistant.js
│   │   ├── ConfirmFood.js          ← confirm/correct scan step + CUISINE selector + region-aware quick-pick
│   │   ├── HealthPanel.js          ← Goal 2: risk gauge + wearable cards + healthier swap
│   │   └── ProfilePicker.js        ← Goal 3: Diabetic/Cardiac/Fitness/General modes
│   ├── data/
│   │   ├── GlycemicIndex.js        ← GI table + lookup + COMMON_FOODS list
│   │   ├── Cuisines.js             ← region/cuisine food lists + recognition-bias helpers
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

### Added 2026-06-24 — chat assistant, food timeseries, region-aware scan
Three features added in response to "can it chat / track food over time / detect
foods region-wise":
1. **TWO chat assistants (slide-in side panels), both grounded on the same app data.**
   Generic UI = `ui/ChatPanel.js` (docks left or right via `side` prop; `respond(q,
   priorTurns)` decides the backend). Two FABs on the AR screen: 🦙 teal (left), 💬 blue (right).
   - **RIGHT 💬 "Quick Assistant" — rule-based, fully offline.** `engine/Assistant.js`
     `answer(q, ctx)` — deterministic keyword/intent matching over the app's data. NO
     network, instant. This is the original engine, kept UNCHANGED at the user's request.
   - **LEFT 🦙 "Llama 3" — local LLM, natural language.** `services/LlamaChat.js` talks to
     **Ollama running Llama 3 8B on the paired PC** (NOT on the phone — the Moto G 5G has
     only 3.5 GB RAM, can't host 8B; it runs on the PC's RTX 3050 GPU). Phone reaches it
     via `adb reverse tcp:11434 tcp:11434` → `http://localhost:11434`. **GROUNDED**:
     `engine/Assistant.buildFacts(ctx)` compiles the app's real numbers (log, RiskEngine,
     offline nutrition) into the prompt; system prompt forbids inventing numbers. If the
     server is unreachable the panel says so and points to the offline 💬 panel.
   - **Privacy note:** meal *images* still never leave the phone. The Llama panel sends only
     a small TEXT factsheet to the user's OWN PC (not a third-party cloud) — weaker than
     fully on-device, but the chosen trade-off for real LLM quality on this hardware.
   - **Prereqs for the 🦙 panel to work:** (a) Ollama running on the PC with `llama3` pulled,
     (b) phone on USB with `adb reverse tcp:11434 tcp:11434` set. Models live on **D:**
     (`OLLAMA_MODELS=D:\ollama\models`) because C: was full — see [[ollama-llama-setup]].
2. **Multi-day food timeseries.** Previously the log kept only TODAY (overwritten
   daily). Now `App.js` mirrors each day into a per-user history map
   (`ARDIET_HISTORY_V1::<user>`, capped `HISTORY_DAYS=60`); a stale daily log is
   rolled into history on load. `ui/Dashboard.js` gained a **Trends tab** (SVG
   calories-per-day bar chart with goal line, 7/14/30-day range, per-day macro list).
   Serves Goal 3 (effectiveness over time).
3. **Region/cuisine-aware scan.** `data/Cuisines.js` defines 6 cuisines (Global,
   South Asian, East Asian, Middle East/Med, Latin, Western), each a list of foods
   that all resolve in the offline nutrition table. A **cuisine selector** in
   `ui/ConfirmFood.js` (persisted per-user, `ARDIET_REGION_V1::<user>`) (a) biases
   `App.mergeCandidates` ranking toward that cuisine (`REGION_MATCH=0.15`) and (b)
   drives region-specific quick-pick chips so a missed regional dish is one tap to
   log with correct macros. **Honest limitation (state this in the paper):** the SCAN
   model is a single GLOBAL classifier (AIY Food V1, Western/popular-biased) — it
   cannot reliably *recognize* an unpopular regional dish from pixels without
   per-region fine-tuning. The region selector mitigates via ranking + one-tap
   correction; true regional recognition needs a fine-tuned/larger model (future work).

### Added 2026-06-27 — environment/location context, religion + past-disease awareness, multi-food plate
Six features added in response to a request for weather/air-quality, location/ZIP,
religion-aware recommendations, past-disease 5-year impact, nearby food, and
per-item plate calories:
1. **Environment & location layer.** `services/Environment.js` resolves the user's
   **ZIP** (Zippopotam.us, free no-key) → lat/lon → **weather + temperature**
   (Open-Meteo forecast) + **air quality** (Open-Meteo air-quality: US AQI, PM2.5,
   PM10, ozone) + a **tap-water advisory** (heuristic + EWG Tap Water deep link by
   ZIP). 15-min cache. `ui/EnvironmentPanel.js` shows it all and has a **"Find this
   food near you"** button that opens Google Maps search (no Places key). A tappable
   **weather chip** in the top bar (temp + AQI) opens the panel. GPS is intentionally
   NOT used (needs a native module + rebuild); ZIP is sufficient and the user stressed
   "zip code matters". Only the ZIP/coords leave the phone (to free public weather APIs).
2. **Religion / dietary-tradition filter.** `data/Religion.js` maps religion →
   restricted-food keywords + reason + permissible alternative (Hindu→beef,
   Muslim→pork/alcohol, Jewish→pork/shellfish, Jain→meat/egg/root-veg, Buddhist→meat,
   vegetarian/vegan). `RiskEngine.matchReligiousRestriction` flags a matched food as a
   hard **AVOID** verdict (same mechanism as allergens) with the alternative surfaced.
3. **Past / chronic diseases (manual) + 5-year impact projection.** New `pastDiseases`
   multi-select in the profile (`theme.PAST_DISEASES`). `RiskEngine.projectFiveYear`
   pairs each recorded disease with how THIS food's pattern aggravates it (educational,
   not diagnostic) — e.g. prior cardiac event + high satfat/sodium → recurrent-event
   risk; diabetes + high GI → complications; kidney + sodium/protein; fatty liver +
   sugar; gout + purines; obesity + calorie-dense. Shown in the recommendation + a
   dedicated **5-YEAR IMPACT** card in HealthPanel.
4. **Environment-aware health note.** `RiskEngine.assessForUser` now takes `env` and
   adds `environmentFoodNote` (hot day → hydrate/lighter + salty-item thirst warning;
   poor AQI → antioxidant foods + limit exertion; water advisory). Surfaced in the
   recommendation and a **LOCAL ENVIRONMENT** card in HealthPanel.
5. **Profile additions.** `EMPTY_USER` gained `religion`, `zip`, `pastDiseases`;
   `ui/HealthIntake.js` got the corresponding sections. Persisted per-account as usual.
6. **Multi-food plate detection (the "wrong info on a mixed plate" fix).** When the box
   detector localizes **2+ distinct foods**, `App.onScan` now routes to the new
   `ui/ConfirmPlate.js` instead of collapsing to one wrong guess. ConfirmPlate lists
   each item with **its own calories**, per-item count steppers, on/off toggles, and an
   "add missed item" search; `App.onConfirmPlate` logs **each item as its own entry**
   (own calories + own personalized risk), sets the highest-calorie item as the AR
   "hero", and alerts a per-item breakdown + plate total. **Honest limitation:** the box
   detector only knows 15 classes (bread/pizza/burger/fries/hot dog/sandwich + the 4
   fruits…), so true per-item separation only works for those; non-detector dishes still
   fall to the single-item confirm. Full multi-region per-item recognition needs a
   detector with a larger food vocabulary (future work).
   - `assessForUser(nutrition, healthMetrics, user, history, env)` — note the new 5th
     `env` arg; all four call sites in `App.js` pass it.

### Added 2026-06-27 (later) — plate builder + OPTIONAL local-AI multi-item detection
Follow-up to "detect every item on a mixed plate (tomato/avocado/spinach…)". The
on-device TFLite models CANNOT do this (15-class box detector + whole-dish classifier),
so two layers were added:
1. **Plate builder (on-device, private).** Composite dishes (`COMPOSITE_RE` in App.js:
   salad/bowl/platter/mixed veg/wrap/thali) now route to `ui/ConfirmPlate.js` instead of
   logging one wrong item. A **produce quick-pick palette** (`PRODUCE_PALETTE`) lets the
   user tap each component (tomato, avocado, spinach, mushroom, sweet potato, cauliflower,
   …) → each logs with its OWN calories. Added ~18 salad vegetables/produce to the
   `NutritionAPI` offline table (they were missing → 0 kcal). A manual "🍱 Several foods?"
   button on the single-item confirm opens the same builder.
2. **OPTIONAL local-AI auto-detect (`services/VisionDetect.js`).** Real multi-item
   recognition via a **vision** model in the user's Ollama on the paired PC (reuses the
   `adb reverse tcp:11434` bridge). `detectFoodsVision(base64)` posts the photo to
   `/api/generate` with `images:[…]`, parses a JSON food list, resolves each to the
   offline table, and pre-fills the plate builder. Surfaced as a purple "✨ Smart-detect
   every item (local AI)" button in ConfirmFood + ConfirmPlate (`App.aiDetectPlate`, photo
   base64 kept in `shotB64Ref`). **Privacy trade-off (state in paper):** unlike the default
   on-device SCAN, this sends the meal IMAGE to the user's OWN PC (localhost over USB, not
   cloud) — opt-in. **Prereq: a VISION model must be pulled** — `llama3` (text) CANNOT see
   images. `getVisionModel()` auto-picks from llava/moondream/bakllava/llama3.2-vision/etc.
   Recommend `ollama pull moondream` (1.8B, fits the RTX 3050's ~4 GB VRAM) or `ollama pull
   llava`. Note: as of this build the user's `ollama list` showed EMPTY — no model pulled yet.
   - **Detection-quality fixes (2026-06-28):** moondream falsely reported "avocado" on a
     breakfast plate. TWO causes: (a) the prompt's format example LISTED real foods
     (`["avocado",…]`) → small VLMs copy example words → fixed to placeholder-only
     (`["<food1>",…]`) + explicit anti-hallucination rules; (b) moondream (1.8B) is weak.
     Pulled **`qwen2.5vl:3b`** (~3.2 GB, fits the RTX 3050 **6 GB**; research: Qwen2.5-VL 7B
     beats Llama-3.2-Vision 11B). `VISION_HINTS` reordered STRONGEST-FIRST so the app
     auto-prefers qwen, moondream last. Verified: qwen returns `[]` on a non-food image (no
     hallucination). Cold load+inference ≈60s on the 3050 → `TIMEOUT_MS` raised to 120s;
     warm the model + `keep_alive:'30m'` to avoid cold-start timeouts. GPU = RTX 3050 6 GB
     Laptop (≈4.7 GB free); 11B vision models don't fit. Ollama server stores models on
     **C:** (15 GB free) despite `OLLAMA_MODELS=D:\ollama\models` user-env (server didn't
     inherit it) — a concurrent Gradle build once exhausted C: mid-pull.
   - **True on-device segmentation was rejected as infeasible:** no good broad-vocabulary
     food-segmentation `.tflite` to ship, and seg models (Mask R-CNN/DeepLab class) are too
     heavy for the 3.5 GB Moto G 5G. The vision-LLM-on-PC path is the realistic alternative.

### What's still mocked or open
- iOS HealthKit bridge: file exists in planning (`files/HealthKitService.js`) but not
  wired into `services/HealthMetrics.js`.
- Water contamination is an **indicative heuristic + EWG deep link**, not a live
  measured feed (no free no-key nationwide API). Nearby-food availability is a Maps
  search deep link, not a Places-API result list.
- Local-AI plate detection needs a **vision** model pulled in Ollama; degrades with a
  clear message when none is present. On-device SCAN remains the private default.

### Gotcha — release builds blocked HTTP to localhost (fixed 2026-06-27)
Symptom: "Local AI unavailable — could not reach local vision model" (and the same would
hit the **Llama 3 chat**) in a **release** APK, even with Ollama running + `adb reverse
tcp:11434` set. Cause: `android:usesCleartextTraffic="true"` lives ONLY in
`src/debug/AndroidManifest.xml`, so release builds blocked cleartext HTTP to
`http://localhost:11434`. Fix: added `src/main/res/xml/network_security_config.xml`
permitting cleartext to **localhost / 127.0.0.1 / 10.0.2.2 only** (HTTPS still enforced for
weather/air/water APIs) and referenced it via `android:networkSecurityConfig` on the
`<application>` in the **main** manifest. Anything reaching the PC's Ollama or Metro from a
**release** build depends on this.
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
| **App crashes (closes instantly) on SCAN** | In a **debug** build, `react-native-fast-tflite` loads the `.tflite` models over HTTP from Metro (`http://localhost:8081/assets/...`). If port 8081 is unreachable (adb-reverse dropped / Metro down), the native loader (`libVisionCameraTflite.so` `nativeInstall`) hits ECONNREFUSED and **hard-crashes via JNI SIGABRT** — not a catchable JS error. | Keep `adb reverse tcp:8081 tcp:8081` set AND Metro running; OR (proper fix) ship a **release/standalone APK** (`cd android && ./gradlew installRelease`) — release bundles the models INTO the apk and loads them from disk, so there's no localhost dependency and no crash. Release is signed with the debug keystore (`build.gradle` `signingConfigs.debug`). |
| Google/Gmail account picker pops up on launch | `getHealthMetrics()` called `GoogleFit.authorize()` automatically | Fixed: `getHealthMetrics({ interactive })` now defaults to NON-interactive → demo profile, never calls `authorize()`. Only an explicit "Connect Google Fit" tap should pass `interactive: true`. |

