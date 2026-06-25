---
name: health-connect-setup
description: Health Connect integration — the exact library/SDK versions that work on this Android 15 device + RN 0.72
metadata:
  type: project
---

Real wearable data in ARDietApp comes from **Android Health Connect** via
`react-native-health-connect`. Getting it to BOTH build (RN 0.72 / AGP 7.4.2) AND
detect Android 15's built-in Health Connect was version-sensitive. The working combo:

- **`react-native-health-connect@3.3.3`** (NOT 1.x, NOT 3.4.0+). Why:
  - 1.x → connect-client 1.0.0-alpha11: builds on compileSdk 33 but throws
    **"Service not available"** on Android 15 (can't see the OS built-in HC; looks for
    the legacy `com.google.android.apps.healthdata` APK which isn't installed).
  - 3.4.0+ → connect-client 1.1.0-alpha11: requires **compileSdk 35**, which needs AGP
    8.x. RN 0.72's AGP 7.4.2 aapt2 can't parse API 35 sparse resources
    (`RES_TABLE_TYPE_TYPE entry offsets overlap`).
  - **3.0.0–3.3.3 → connect-client 1.1.0-alpha06: compileSdk 34 + built-in HC support.**
    3.3.3 verified `getSdkStatus()==3` (SDK_AVAILABLE) on the device.
- `android/build.gradle`: **compileSdkVersion 34, buildToolsVersion "34.0.0"** (both
  `sdkmanager`-installed: `platforms;android-34`, `build-tools;34.0.0`). targetSdk/minSdk
  unchanged (33 / 26). NOTE: the installed android-35 platform's android.jar was CORRUPT —
  reinstalled but unusable anyway due to the AGP 7.4.2 sparse-resource limit.
- Manifest: `android.permission.health.READ_*` perms, `<queries>` for HC, and a
  permissions-rationale activity-alias + `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`
  intent-filter on MainActivity.
- App code: `services/HealthConnect.js` (`getHealthConnectMetrics`, `recsOf()` normalizes
  v1 array vs v3 `{records}`); `HealthMetrics.getHealthMetrics()` tries HC → Google Fit →
  demo; interactive calls bypass the 60s cache; "Connect Health Connect" button in
  `ui/HealthPanel.js` → `App.connectHealth` prompts permission + auto-fills blank glucose/BP.

After changing the installed library version, ALWAYS restart Metro (`--reset-cache`) — a
Metro started before an npm (un)install won't resolve the new/changed module (causes the
red "could not connect / 500" screen). Reads need the user to tap Connect once to grant
permission in the HC permission screen. See [[android-build-workaround]].
