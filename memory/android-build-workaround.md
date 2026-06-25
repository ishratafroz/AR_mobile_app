---
name: android-build-workaround
description: On this Windows machine `npx react-native run-android` fails; build via the gradlew wrapper directly
metadata:
  type: project
---

On this Windows setup, `npx react-native run-android` fails with
`'gradlew.bat' is not recognized as an internal or external command` (the RN CLI
resolves the wrapper path wrong). **Working build+install path instead:**

```powershell
adb reverse tcp:8081 tcp:8081
# Metro in one bg process:
npx react-native start
# Build+install directly via the wrapper:
Set-Location D:\UNT_PHD\AR_Sharma\ARDietApp\android; .\gradlew.bat installDebug
# Then launch:
adb shell monkey -p com.ardietapp -c android.intent.category.LAUNCHER 1
```

- App package id is **`com.ardietapp`** (no `package=` attr in AndroidManifest.xml
  anymore — it's in build.gradle).
- Device: Moto G 5G (adb id `ZA222X2T28`, shows as "moto g 5G - 2024 - 15").
- `installDebug` takes ~1.5 min. Debug build loads JS live from Metro, so JS-only
  changes don't need a rebuild — just reload Metro.
- See [[CLAUDE.md]] for the documented (but failing on Windows) run commands.
