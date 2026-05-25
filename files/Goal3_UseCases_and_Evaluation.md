# Goal 3 — Use Case Specifications & Evaluation Protocol
## AR Diet Monitoring System — Real-World Experiment Design
### DTSC 5777/4777 | UNT | Spring 2026

---

## Overview

Three use cases are defined to evaluate the AR Diet Monitoring system across clinically relevant user profiles. Each use case includes a scenario specification, test environment, acceptance criteria, and links to the evaluation metrics below.

Four experiment protocols measure: food recognition accuracy, AR overlay usability, risk feedback behaviour change, and wearable integration reliability.

---

---

# PART A — USE CASE SPECIFICATIONS

---

## UC-1: Diabetic Patient — Home and Restaurant Meal Scanning

### 1.1 Use Case Summary

| Field | Detail |
|-------|--------|
| Use Case ID | UC-1 |
| Title | Diabetic patient scans meals to manage glycaemic intake |
| Actor | Adult with Type 2 diabetes (diagnosed, diet-managed or medicated) |
| Trigger | User is about to eat a meal and wants to assess sugar / carb content |
| Preconditions | AR app installed, iHealth watch paired, USDA API reachable |
| Postconditions | Nutritional values logged, risk score computed, food choices possibly modified |

### 1.2 Scenario Description

Maria, 58, has been managing Type 2 diabetes for 6 years through diet and oral medication (Metformin). She eats 3 meals per day and is concerned about post-meal glucose spikes. She opens the AR app before each meal, points her phone at the plate, and reviews the glycaemic risk score before deciding whether to modify her portion or substitute a food item.

At a restaurant she cannot control ingredients. She uses the AR app to identify high-sugar and high-refined-carb items on her plate, reads the risk overlay, and decides whether to eat the item, reduce the portion, or ask for a substitution.

### 1.3 Normal Flow

| Step | Actor | System Response |
|------|-------|----------------|
| 1 | User opens app before meal | App opens AR camera; connects to iHealth watch via BLE; loads today's step count and heart rate from HealthKit |
| 2 | User points camera at plate | AR plane detection locks onto plate surface |
| 3 | App scans frame | Clarifai Food API returns detected food labels with confidence scores |
| 4 | App queries USDA | Nutrition fetched for each item; portion estimated from bounding box |
| 5 | App computes risk | RiskEngine evaluates: sugar, refined carbs, and today's activity level |
| 6 | AR overlays render | Each food item gets a floating nutrition panel; high-sugar items highlighted amber or red |
| 7 | User taps an item | Expanded nutrition panel opens showing full `<nutrient, measure>` pair list |
| 8 | Risk is high | AR panel shows ⚠ warning + 3 healthier alternative suggestions |
| 9 | User modifies choice | Swaps white rice for salad; rescans; risk level drops to green |
| 10 | Session logged | Meal data saved to local history |

### 1.4 Alternative Flows

- **A1 — Food not recognised:** App shows "Tap to name this food manually" button; user enters label; USDA lookup proceeds.
- **A2 — Wearable disconnected:** Risk score computed from nutrition only (activity defaults to neutral 50%); HUD shows "No wearable — partial risk only" warning.
- **A3 — Offline:** Cached USDA results used; no API call made.

### 1.5 Risk Triggers for UC-1 (Diabetes Profile)

| Condition | Threshold | AR Response |
|-----------|-----------|-------------|
| Total sugar per meal | > 25g | Red highlight + "High glycaemic spike risk" |
| Refined carbs per meal | > 60g | Amber highlight + "Consider lower-GI option" |
| Steps today | < 3,000 | Escalates risk score +15 points |
| Steps today | > 7,500 | Reduces risk score −10 points |

### 1.6 Acceptance Criteria

- App correctly identifies ≥ 3 food items on a typical diabetic meal plate (rice, protein, vegetable)
- Diabetes risk score ≥ 65 triggers red overlay for a meal with > 30g sugar
- User can complete a full scan-to-risk-assessment in under 45 seconds
- Suggested alternatives are appropriate (low-GI substitutions, not random items)

---

## UC-2: Cardiac-Risk User — Saturated Fat Tracking During Daily Meals

### 2.1 Use Case Summary

| Field | Detail |
|-------|--------|
| Use Case ID | UC-2 |
| Title | Cardiac-risk user monitors saturated fat and sodium across daily meals |
| Actor | Adult with diagnosed high cholesterol or hypertension; resting HR > 80 bpm |
| Trigger | User prepares or orders a meal; wants to check cardiac risk before eating |
| Preconditions | AR app installed; Google Fit or Apple HealthKit connected; wearable paired |
| Postconditions | Saturated fat intake logged for the day; user optionally modifies food choice |

### 2.2 Scenario Description

James, 47, was diagnosed with high LDL cholesterol and mild hypertension two years ago. His cardiologist recommended reducing saturated fat below 15g/day and sodium below 2,300mg/day. He uses the AR app at every meal to track cumulative sat-fat and sodium intake.

The app integrates with his Google Pixel Watch (Wear OS via Google Fit) to read his resting heart rate. When his resting HR is elevated (> 85 bpm) combined with a high-sat-fat meal, the app escalates the cardiovascular risk score and highlights the offending food items in red with a pulsing outline.

### 2.3 Normal Flow

| Step | Actor | System Response |
|------|-------|----------------|
| 1 | User opens app at lunch | App connects to Google Fit; reads resting HR (87 bpm), steps (2,100 today) |
| 2 | Points camera at burger and fries | Plate surface detected; multi-food scan runs |
| 3 | Food items detected | "Hamburger" (confidence 89%), "French fries" (confidence 84%) |
| 4 | Nutrition fetched | Burger: 14g sat. fat, 730mg sodium; Fries: 3g sat. fat, 312mg sodium |
| 5 | Risk computed | Cardiovascular score: 78/100 (DANGER) — sat. fat 17g + HR 87 bpm triggers threshold |
| 6 | AR overlays render | Burger and fries outlined in pulsing red; HUD shows "78 — High cardiac risk" |
| 7 | Expanded panel shows | Full nutrient list; "Saturated fat 17g — AHA limit is 7g per meal" |
| 8 | Alternative suggested | "Try grilled chicken breast (1.0g sat. fat) or baked salmon" |
| 9 | Daily total displayed | "Today sat. fat: 23g / 15g daily limit — EXCEEDED" |
| 10 | User swaps burger for grilled chicken | Rescan; cardiovascular score drops to 34 (caution) |

### 2.4 Alternative Flows

- **A1 — No resting HR available:** Risk computed from food only; HR weight redistributed to sat-fat and sodium sub-scores.
- **A2 — All items within safe range:** All outlines green; HUD shows "Meal risk: 18 — Good cardiac choice."

### 2.5 Risk Triggers for UC-2 (Cardiovascular Profile)

| Condition | Threshold | AR Response |
|-----------|-----------|-------------|
| Saturated fat per meal | > 7g | Red highlight on specific food item |
| Saturated fat per meal | 4–7g | Amber highlight |
| Sodium per meal | > 600mg | Red highlight |
| Resting heart rate | > 85 bpm | Escalates all CV risk scores by +20% |
| Combined sat-fat + HR | Both above threshold | Pulsing red + alert tone |

### 2.6 Acceptance Criteria

- App identifies burger and fries correctly in ≥ 80% of test sessions
- Cardiovascular score ≥ 65 for a meal with > 7g sat. fat AND resting HR > 85 bpm
- Red pulsing animation triggers correctly on flagged items
- Daily running total of sat-fat and sodium updates after each meal scan

---

## UC-3: Fitness User — Real-Time Macro Optimisation

### 3.1 Use Case Summary

| Field | Detail |
|-------|--------|
| Use Case ID | UC-3 |
| Title | Fitness user optimises macronutrient ratios using AR feedback |
| Actor | Healthy adult with specific daily macro targets (e.g. athlete, bodybuilder, weight manager) |
| Trigger | User is about to eat a meal and wants to verify it fits within daily macro budget |
| Preconditions | AR app installed; daily macro targets configured in app settings; wearable optional |
| Postconditions | Macros for this meal logged; remaining daily budget displayed |

### 3.2 Scenario Description

Alex, 27, is a recreational athlete following a 2,500 kcal / 40-30-30 (carbs/protein/fat) macro split. She meal-preps weekly but scans each meal before eating to verify portions haven't drifted. She uses the AR app to confirm macro breakdown and adjust portion sizes if needed, aiming to hit daily totals within ±10%.

### 3.3 Normal Flow

| Step | Actor | System Response |
|------|-------|----------------|
| 1 | User configures profile | Sets daily targets: 250g carbs, 187g protein, 83g fat, 2,500 kcal |
| 2 | Scans meal prep container | App detects: "Brown rice", "Grilled chicken", "Steamed broccoli" |
| 3 | Portions estimated | Rice: 150g, Chicken: 180g, Broccoli: 100g (using plate reference + user confirm) |
| 4 | Nutrition fetched and aggregated | Meal total: 580 kcal, 52g protein, 68g carbs, 8g fat |
| 5 | Fitness profile computed | Protein 52g vs 56g target (−7%) — caution; Carbs 68g vs 75g target (−9%) — safe |
| 6 | AR overlays render | Macro progress bars shown for each item; green items safe, amber slightly off-target |
| 7 | HUD shows daily remaining | "Today remaining: 1,920 kcal, 135g protein, 182g carbs, 75g fat" |
| 8 | User adjusts rice portion | Changes from "medium" to "large" in AR; nutrition panel updates live |
| 9 | Rescan confirms targets met | All items green; HUD confirms "On track" |

### 3.4 Risk Triggers for UC-3 (Fitness Profile)

| Condition | Threshold | AR Response |
|-----------|-----------|-------------|
| Macro deviation from target | > 30% over or under | Red — "Significantly off target" |
| Macro deviation | 10–30% | Amber — "Slightly off target" |
| Macro deviation | < 10% | Green — "On track" |
| Calorie total for day | > 110% of daily target | Red — "Over daily budget" |

### 3.5 Acceptance Criteria

- App correctly identifies all items in a standard 3-component meal prep (protein + carb + vegetable)
- Portion adjustment via small/medium/large immediately updates AR panel without re-scanning
- Daily macro budget HUD updates correctly after each meal
- Fitness score reflects user-configured targets (not generic defaults)

---
---

# PART B — EXPERIMENT PROTOCOLS

---

## EP-1: Food Recognition Accuracy

### Objective
Measure the accuracy of the food classification pipeline (Clarifai API + USDA lookup) on a standardised test set of real food plates.

### Metric
- Primary: Top-1 accuracy (%) — does the highest-confidence prediction match the ground truth label?
- Secondary: Top-3 accuracy (%) — is the correct label within the top 3 predictions?
- Tertiary: Mean Average Precision (mAP) for multi-food plates (≥ 2 items)

### Target Values
| Metric | Minimum Pass | Target |
|--------|-------------|--------|
| Top-1 accuracy | 70% | 85% |
| Top-3 accuracy | 85% | 95% |
| mAP (multi-food) | 0.60 | 0.75 |
| Portion weight error | ± 35% | ± 20% |

### Participant Criteria
None — this is a system evaluation, not a user study. A test set of food images is used.

### Test Set Construction
1. Prepare 60 food items spanning 6 categories (10 per category):
   - Proteins: chicken, beef, fish, tofu, egg, pork
   - Grains: white rice, brown rice, pasta, bread
   - Vegetables: broccoli, salad, carrot, spinach, tomato
   - Fruits: apple, banana, orange, grapes, strawberry
   - Dairy: cheese, yogurt
   - Fast food: burger, pizza, fries
2. Photograph each item on a standard white plate in 3 lighting conditions:
   - Good natural light (near window)
   - Indoor artificial light (overhead LED)
   - Low light (evening lamp only)
3. Total: 60 items × 3 lighting = 180 test images
4. Ground truth labels assigned by two independent researchers (inter-rater agreement required ≥ 90%)

### Procedure
1. Load each test image through the app's `identifyFoodItems()` function
2. Record: top-1 label, top-1 confidence score, top-3 labels, inference time (ms)
3. Compare top-1 prediction to ground truth label
4. For portion estimation: weigh each food item with a kitchen scale before photographing; compare to `estimatePortionGrams()` output
5. Repeat each image 3 times and average results to control for API variability

### Data Collection Form — EP-1

| Image ID | Food Item | Lighting | GT Label | Top-1 Predicted | Top-1 Confidence | Match? | Top-3 Match? | Actual Weight (g) | Estimated Weight (g) | Error (%) | Inference Time (ms) |
|----------|-----------|----------|----------|----------------|-----------------|--------|-------------|------------------|---------------------|-----------|-------------------|
| IMG_001 | Grilled chicken | Good | grilled chicken | | | | | | | | |
| IMG_002 | Grilled chicken | Indoor | grilled chicken | | | | | | | | |
| *(repeat for all 180 images)* | | | | | | | | | | | |

### Analysis
- Compute accuracy as (correct predictions / total predictions) × 100
- Compute portion error as mean(|estimated − actual| / actual) × 100
- Run chi-square test across lighting conditions to check if accuracy varies significantly
- Report confusion matrix for top-10 most confused food pairs

---

## EP-2: AR Overlay Usability (SUS Evaluation)

### Objective
Measure the usability of the AR nutrition overlay interface using the System Usability Scale (SUS) with real users in a structured lab session.

### Metric
- Primary: SUS score (0–100; ≥ 68 = "Above average", ≥ 80.3 = "Excellent")
- Secondary: Task completion rate (%), Task time (seconds), Error count

### Target Values
| Metric | Minimum Pass | Target |
|--------|-------------|--------|
| SUS score | 68 (above average) | 80 (good) |
| Task completion rate | 80% | 95% |
| Mean task time (scan + read nutrition) | < 60 seconds | < 30 seconds |

### Participant Criteria
- n = 15 participants minimum (10 for pilot, 15 for final evaluation)
- Age range: 25–65 years
- Inclusion: owns a smartphone (iOS or Android); willing to handle food
- Exclusion: prior experience with AR food apps; visual impairment not corrected by glasses
- Recruitment: university campus, community health centres, UNT volunteer pool
- IRB approval required before recruiting (see Section B5 below)

### Session Procedure (45 minutes per participant)
1. **Briefing (5 min):** Explain study purpose; obtain written informed consent; collect demographics form
2. **Onboarding (5 min):** Show participant how to open app and aim at a surface. Do NOT demonstrate the nutrition panel — let them discover it.
3. **Task set (25 min):** Participant completes 5 standardised tasks (see Task List below)
4. **SUS questionnaire (5 min):** Paper form completed immediately after tasks
5. **Semi-structured interview (5 min):** 3 open-ended questions about the experience

### Task List

| Task # | Description | Completion Criterion |
|--------|-------------|---------------------|
| T1 | Open the app and scan the plate to detect at least one food item | Nutrition panel appears |
| T2 | Find and read the calorie count for the chicken item | Participant states correct kcal value aloud |
| T3 | Expand the nutrition panel to see all nutrients | Full nutrient list displayed |
| T4 | Change the portion size from medium to large | Nutrition values update |
| T5 | Identify which food item has the highest risk rating | Participant correctly identifies the red-highlighted item |

### SUS Questionnaire (standard 10-item SUS)

Rate each item 1 (Strongly disagree) to 5 (Strongly agree):

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

**SUS Scoring:** Odd items: (score − 1). Even items: (5 − score). Sum all. Multiply by 2.5.

### Data Collection Form — EP-2

| Participant ID | Age | Gender | Smartphone type | T1 Complete? | T1 Time (s) | T2 Complete? | T2 Time (s) | T3 Complete? | T3 Time (s) | T4 Complete? | T4 Time (s) | T5 Complete? | T5 Time (s) | SUS Score | Notes |
|----------------|-----|--------|----------------|-------------|------------|-------------|------------|-------------|------------|-------------|------------|-------------|------------|-----------|-------|
| P001 | | | | | | | | | | | | | | | |
| *(repeat for all n participants)* | | | | | | | | | | | | | | | |

---

## EP-3: Risk Feedback Behaviour Change

### Objective
Measure whether AR risk warnings cause users to modify food choices, and whether the effect persists over 5 days of use.

### Metric
- Primary: Food choice switch rate (%) — % of meals where user chose a different food after seeing red/amber AR warning
- Secondary: Nutrient reduction (%) — reduction in flagged nutrient (sat. fat / sugar) on days with AR vs control days
- Tertiary: Self-reported confidence in food choices (1–7 Likert scale)

### Target Values
| Metric | Minimum Pass | Target |
|--------|-------------|--------|
| Food choice switch rate | 20% | 35% |
| Sat. fat reduction (UC-2 group) | 10% | 25% |
| Sugar reduction (UC-1 group) | 10% | 20% |
| Confidence score improvement | +0.5 | +1.0 |

### Participant Criteria
- n = 20 participants minimum
- Group A (n=10): Participants with diabetes diagnosis or pre-diabetes (HbA1c ≥ 5.7%)
- Group B (n=10): Participants with self-reported cardiovascular concern or family history
- Each participant completes a 5-day study (3 meals/day = 15 meal sessions each)
- Control condition: Day 1–2 without AR risk feedback (nutrition panel only, no colour coding)
- Intervention condition: Day 3–5 with full AR risk feedback (red/amber/green highlights)

### 5-Day Protocol

| Day | Condition | Instructions to Participant |
|-----|-----------|----------------------------|
| 1–2 | Control | "Use the app to scan every meal. Read the nutrition information. Make your normal food choices." |
| 3–5 | Intervention | "The app will now highlight risky foods. You may choose to follow or ignore the suggestions." |

### Data Collection Form — EP-3

| Session ID | Participant | Day | Meal | Food Items Scanned | Risk Level Shown | Participant Switched Food? | Switched From | Switched To | Sat. Fat (g) | Sugar (g) | Confidence Rating (1–7) |
|-----------|------------|-----|------|-------------------|-----------------|--------------------------|--------------|------------|-------------|----------|------------------------|
| S001 | P001 | 1 | Lunch | | None (control) | — | — | — | | | |
| S002 | P001 | 3 | Lunch | | Red | | | | | | |
| *(repeat)* | | | | | | | | | | | |

### Analysis
- Paired t-test: nutrient intake on control days vs intervention days per participant
- McNemar test: proportion of meals with "switched" choice before vs after AR feedback
- Linear mixed model: time effect (Day 1→5) on nutrient intake, controlling for participant

---

## EP-4: Wearable Integration Reliability

### Objective
Measure the reliability and latency of the wearable data pipeline (HealthKit / Google Fit → RiskEngine → AR display) under real-world conditions.

### Metric
- Primary: Sync latency (ms) — time from wearable HR reading to AR HUD update
- Secondary: Dropout rate (%) — % of meal sessions where wearable data was unavailable
- Tertiary: Data accuracy — correlation between wearable-reported HR and a medical-grade reference pulse oximeter

### Target Values
| Metric | Minimum Pass | Target |
|--------|-------------|--------|
| Sync latency (median) | < 5,000ms | < 2,000ms |
| Sync latency (95th percentile) | < 10,000ms | < 5,000ms |
| Dropout rate | < 20% | < 5% |
| HR correlation with reference | r > 0.85 | r > 0.95 |

### Participant Criteria
- n = 10 device-pairing sessions (not participants — device-level testing)
- Test devices: Apple Watch Series 8+, iHealth View wristband, Google Pixel Watch 2, Samsung Galaxy Watch 6
- Each device runs 30 meal-session simulations

### Procedure
1. Pair device with test smartphone
2. Start a meal scan session; note timestamp
3. Trigger a heart rate reading on wearable; record the exact timestamp
4. Record timestamp when HR value appears in AR HUD
5. Calculate latency = HUD timestamp − wearable reading timestamp
6. Repeat 30 times per device across 3 network conditions:
   - Strong WiFi (home / lab)
   - 4G/LTE (outdoor)
   - Weak signal (basement / tunnel)
7. Simultaneously measure HR with a certified pulse oximeter (Masimo MightySat) and record for correlation analysis

### Data Collection Form — EP-4

| Session # | Device | OS | Network | Wearable HR (bpm) | Reference HR (bpm) | HUD Update Time (ms) | Data Available? | Notes |
|-----------|--------|----|---------|--------------------|-------------------|---------------------|----------------|-------|
| 1 | Apple Watch S8 | iOS 17 | WiFi | | | | Yes/No | |
| 2 | iHealth View | iOS 17 | WiFi | | | | Yes/No | |
| *(repeat for all sessions)* | | | | | | | | |

---

---

# PART C — EVALUATION SUMMARY MATRIX

| Experiment | Goal | Metric | Tool | n | Duration |
|-----------|------|--------|------|---|----------|
| EP-1: Food recognition | Goal 1 | Top-1 accuracy, mAP, portion error | System test (no users) | 180 images | 1 day |
| EP-2: AR usability | Goal 1 | SUS score, task completion | Lab session + SUS | 15 participants | 1–2 days |
| EP-3: Behaviour change | Goal 2 | Switch rate, nutrient reduction | 5-day diary + app logs | 20 participants | 5 days |
| EP-4: Wearable reliability | Goal 2 | Latency, dropout rate | Device testing | 10 device sessions | 1 day |

---

# PART D — IRB CONSIDERATIONS

For EP-2 and EP-3 (human subject studies), the following IRB requirements apply:

1. **Informed consent:** Written consent form explaining: data collected, how it is stored, right to withdraw at any time, no medical advice will be provided by the app or researchers.

2. **Data anonymisation:** All participant data stored with numeric IDs only (P001, P002…). Name-to-ID mapping kept in a separate password-protected file accessible only to the PI.

3. **Health data sensitivity:** Diabetes diagnosis and cardiovascular risk factor data collected under EP-3 Group A and B are classified as sensitive health data. Stored encrypted on lab server; not synced to any cloud service.

4. **No medical claims:** The app and study make no diagnostic claims. All risk scores are advisory only. A disclaimer is shown on app launch: "This app provides general nutritional information only and does not constitute medical advice."

5. **Participant exclusion safety:** Any participant who becomes distressed by risk warnings during EP-3 may withdraw immediately with no penalty. Researcher contact info provided.

6. **Data retention:** All study data retained for 3 years post-publication, then securely deleted per UNT data governance policy.

---

*Document version: 1.0 | May 2026 | DTSC 5777/4777 AR Diet Monitoring Project*
