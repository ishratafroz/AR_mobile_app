# AR Diet Monitoring — Presentation Script


## Slide 1 — Title

Good [morning/afternoon]. This is the latest update on the Mobile AR Diet
Monitoring project. Since the last update, we've made a fundamental
architecture change: the food-recognition pipeline that used to rely on
Google's Gemini Vision API now runs entirely on-device. I'll walk through
what changed, why, and what's actually working today on the Moto G 5G test
device.

## Slide 2 — Objective & Scope

The core goal hasn't changed — real-time AR diet monitoring that helps
people make better food decisions. What's new this round is threefold.
First, we replaced cloud-based Gemini recognition with three on-device
TFLite models, so meal photos never leave the phone. Second, we added a
real account system with an expanded clinical health profile — blood
group, fasting glucose, blood pressure, resting pulse. Third, the risk
engine now uses those numbers directly, so a recommendation can say
something like "this is risky for you because of your blood pressure,"
not just a generic warning. On the right, you can see the four-stage
on-device recognition pipeline and how each piece maps back to our three
project goals.

## Slide 3 — What Was Built

This slide breaks down the six pieces of this update. On-device
recognition combines a box detector that finds and counts food items, a
dish classifier covering over two thousand foods, and an optional produce
classifier for raw fruits and vegetables — all fused into one ranked
list. Accounts and profiles give each user their own login, their own
health intake form, and their own daily food log, stored only on the
device. The risk engine is now clinical-aware — I'll show a live example
of that shortly. We also shipped a new SVG-based UI — the dashboard,
health panel, profile picker, and nutrition card you'll see in the
screenshots later. And there are two small fixes from today: Google Fit
no longer pops up an account picker on launch, and the offline nutrition
table no longer returns phantom zero-calorie results.

## Slide 4 — SCAN Data Flow

This is the actual data flow when someone scans a meal. The camera
captures a still photo, two or three TFLite models run locally to detect
and classify what's on the plate, the result is matched against an
offline nutrition table with portion scaling based on item count, then
the glycemic index and the clinical risk engine run together, and finally
the AR overlay is drawn in the camera view. The important line at the
bottom: this entire chain runs with zero network calls. If a result is
ambiguous, the user confirms or corrects it themselves — you'll see that
confirmation step reflected in the screenshots.

## Slide 5 — Key Problems Solved

Three real problems came up this round. Gemini was sending meal photos to
Google's servers, which is a genuine privacy concern given this is
human-subjects research. Debug builds were also crashing outright if the
TFLite models couldn't reach the Metro dev server. And Google Fit was
popping up an account picker every time the app launched, before anyone
had even logged in. The fix for all three: move recognition fully
on-device, ship a release APK that bundles the models so there's no
network dependency, and make the Google Fit check non-interactive by
default — it only asks to connect when the user explicitly taps "Connect
Google Fit."

## Slide 6 — Verified On Device

We built and installed a release APK on the Moto G 5G and confirmed the
build log says BUILD SUCCESSFUL. SCAN now runs three TFLite models
locally with confirmed zero network calls. The fusion logic combines the
box detector and dish classifier into one ranked list, and the user
always has the final say in the confirmation screen. The risk engine is
now profile-aware and clinical-aware at the same time — it adjusts for
whether someone's in diabetic, cardiac, fitness, or general mode, and
then escalates further using their actual glucose, blood pressure, and
pulse numbers. The card on the right is really the headline of this
whole update: the meal photo, the recognized food name, and the health
profile never leave the phone.

## Slide 7 — Prototype (App Screens + Video)

This is the app actually running. On the right is a short screen
recording from the device. On the left are four real scans pulled
straight from a test session. The first is pasta — confirmed by the
user, flagged "Good for you," 316 kilocalories, low GI, well within the
daily budget. The second is instant noodles, and this is a good example
of the clinical escalation we just talked about: it's flagged "Risky for
you" specifically because of high sodium combined with the user's own
blood pressure reading of 100 over 80, and the app suggests whole wheat
pasta as a swap. The third is rice, flagged "Caution" for a high
glycemic index of 73, with a diabetes-relevant high-glycemic-load note.
The fourth screen is the expanded nutrition view for that same noodles
scan, showing the full macro breakdown and the healthier-swap card.
These aren't mockups — this is the actual risk engine reasoning over
actual entered health data.

## Slide 8 — Known Limitations & Next Steps

To be transparent about where we are: iOS HealthKit isn't wired up yet,
portion size still comes from the box detector's item count rather than
true visual size estimation, the produce classifier is built but not
activated, and we only show one food panel per scan rather than multiple
items at once. The healthier-alternative suggestion you just saw in the
noodles example exists in the engine, but it isn't yet surfaced as an AR
overlay in the camera view. Next up: wiring iOS HealthKit, geometry-based
portion estimation, multi-item AR panels, surfacing swaps directly in
AR, activating the produce model, and starting real user testing for
Goal 3.

## Slide 9 — Closing

So, where this leaves us: on-device food recognition and a
clinical-aware risk engine are live, fully offline, and gated behind
real per-user accounts. The flow end-to-end is — scan a meal, the phone
identifies and counts it locally, nutrition and portion come from the
offline table, GI and clinical risk run using the person's own numbers,
and the result shows up as an AR overlay. That's the update — happy to
take questions or go deeper into any one piece.
