# React Native + ViroReact AR — Complete Setup Guide
### AR Diet Monitoring App — From Zero to Working AR Scene


## Prerequisites

Before you touch any code, make sure you have these installed:

| Tool | Version | Why needed |
|------|---------|------------|
| Node.js | 18 LTS or higher | Runs React Native toolchain |
| npm | 9+ (comes with Node) | Package manager |
| Watchman | Latest | File watcher for React Native |
| Xcode | 14+ | iOS build (Mac only) |
| Android Studio | Latest | Android build |
| Java JDK | 17 (Temurin) | Required by Android Studio |
| CocoaPods | 1.12+ | iOS dependency manager |
| Git | Any | Version control |

> **Important:** ViroReact AR runs on a **real physical device only**. The iOS Simulator and Android Emulator do NOT support AR (no real camera). You need a phone with ARKit (iPhone 6s or newer) or ARCore support.

---

## Part 1 — Install System Tools

### 1.1 Install Node.js
Go to https://nodejs.org and download Node 18 LTS. Verify:
```bash
node --version    # should print v18.x.x
npm --version     # should print 9.x.x
```

### 1.2 Install Watchman (Mac)
```bash
brew install watchman
```

### 1.3 Install React Native CLI globally
```bash
npm install -g react-native-cli
```

### 1.4 Install CocoaPods (Mac, for iOS)
```bash
sudo gem install cocoapods
pod --version    # verify: 1.12.x or higher
```

### 1.5 Set up Android Studio
1. Download from https://developer.android.com/studio
2. Open Android Studio → SDK Manager → install:
   - Android SDK Platform 33 (Android 13)
   - Android SDK Build-Tools 33.0.0
   - Android Emulator
   - Android SDK Platform-Tools
3. Add to your shell profile (`~/.zshrc` or `~/.bashrc`):
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```
4. Reload: `source ~/.zshrc`

---

## Part 2 — Create the Project

### 2.1 Create a new React Native project
```bash
npx react-native init ARDietApp --version 0.72.6
cd ARDietApp
```

> Use React Native 0.72.x — ViroReact has been tested and works well with this version.

### 2.2 Install ViroReact (the AR framework)
```bash
npm install @reactvision/react-viro
```

> **Note:** `@reactvision/react-viro` is the actively maintained community fork of the original ViroReact. The old `react-viro` package by Viromedia is no longer maintained. Always use `@reactvision/react-viro`.

### 2.3 Install additional packages you will need
```bash
# For USDA API calls (already built into React Native, no extra install)
# For health/wearables:
npm install react-native-health                 # iOS HealthKit
npm install react-native-google-fit             # Android Google Fit

# For camera frame capture:
npm install react-native-camera

# For navigation between screens:
npm install @react-navigation/native @react-navigation/stack

# Async storage (for caching nutrition data offline):
npm install @react-native-async-storage/async-storage
```

---

## Part 3 — iOS Setup (Mac only)

### 3.1 Link native dependencies with CocoaPods
```bash
cd ios
pod install
cd ..
```

### 3.2 Configure Info.plist for camera and health permissions
Open `ios/ARDietApp/Info.plist` and add these keys inside the `<dict>` tag:

```xml
<key>NSCameraUsageDescription</key>
<string>This app uses the camera to scan and identify food items in AR</string>

<key>NSHealthShareUsageDescription</key>
<string>This app reads your heart rate and activity data to assess dietary risk</string>

<key>NSHealthUpdateUsageDescription</key>
<string>This app logs nutrition data to your health records</string>

<key>NSMotionUsageDescription</key>
<string>This app uses motion data for AR tracking</string>
```

### 3.3 Enable HealthKit capability in Xcode
1. Open `ios/ARDietApp.xcworkspace` in Xcode (always open `.xcworkspace`, not `.xcodeproj`)
2. Click your project in the left sidebar → select your target
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability** → add **HealthKit**

### 3.4 Set minimum iOS deployment target
In Xcode → Build Settings → search "iOS Deployment Target" → set to **14.0**

---

## Part 4 — Android Setup

### 4.1 Configure AndroidManifest.xml
Open `android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:

```xml
<!-- Camera permission for AR -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- ARCore requirement -->
<uses-feature android:name="android.hardware.camera.ar" android:required="true" />

<!-- Google Fit / Health Connect -->
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.BODY_SENSORS" />

<!-- Inside <application> tag, add: -->
<meta-data android:name="com.google.ar.core" android:value="required" />
```

### 4.2 Set minimum SDK version
Open `android/build.gradle` and ensure:
```gradle
minSdkVersion = 26    // ARCore requires at least API 24; 26 is safer
targetSdkVersion = 33
```

### 4.3 Enable multidex (ViroReact requires it)
In `android/app/build.gradle`, inside `defaultConfig`:
```gradle
multiDexEnabled true
```

And add to `dependencies`:
```gradle
implementation 'androidx.multidex:multidex:2.0.1'
```

---

## Part 5 — Folder Structure

Set up this folder structure inside your project:

```
ARDietApp/
├── android/                    ← Android native code (auto-generated)
├── ios/                        ← iOS native code (auto-generated)
├── src/
│   ├── scenes/
│   │   ├── ARFoodScanScene.js  ← Main AR camera scene (Goal 1)
│   │   └── ARRiskScene.js      ← Risk overlay scene (Goal 2)
│   ├── components/
│   │   ├── NutritionPanel.js   ← Floating AR nutrition label
│   │   ├── RiskBadge.js        ← Red/amber/green risk indicator
│   │   └── MealSummaryHUD.js   ← Corner HUD with total macros
│   ├── services/
│   │   ├── FoodRecognition.js  ← Camera frame → food detection API
│   │   ├── NutritionAPI.js     ← USDA FoodData Central calls
│   │   ├── HealthKit.js        ← iOS HealthKit bridge
│   │   └── GoogleFit.js        ← Android Google Fit bridge
│   ├── engine/
│   │   └── RiskEngine.js       ← Risk score calculator (Goal 2)
│   ├── utils/
│   │   ├── NutritionCache.js   ← Local cache for offline use
│   │   └── PortionEstimator.js ← Bounding box → weight estimate
│   └── constants/
│       ├── RiskThresholds.js   ← Risk rule definitions
│       └── USDAConfig.js       ← API key and endpoints
├── App.js                      ← Root entry point
├── package.json
└── README.md
```

Create the folders now:
```bash
mkdir -p src/scenes src/components src/services src/engine src/utils src/constants
```

---

## Part 6 — Working Hello World AR Scene

This is a complete, runnable AR scene. It opens your camera, detects a horizontal surface (like a table or plate), and places a floating 3D text label saying "Food detected here" in your real-world view.

### 6.1 App.js — Root entry point
Replace the contents of `App.js` with:

```javascript
import React from 'react';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import ARFoodScanScene from './src/scenes/ARFoodScanScene';

export default function App() {
  return (
    <ViroARSceneNavigator
      autofocus={true}
      initialScene={{ scene: ARFoodScanScene }}
      style={{ flex: 1 }}
    />
  );
}
```

### 6.2 src/scenes/ARFoodScanScene.js — The AR scene
Create this file:

```javascript
import React, { useState, useRef } from 'react';
import {
  ViroARScene,
  ViroText,
  ViroFlexView,
  ViroNode,
  ViroARPlaneSelector,
  ViroMaterials,
  ViroBox,
  ViroAnimations,
  ViroAmbientLight,
  ViroQuad,
} from '@reactvision/react-viro';

// --- Register materials for risk highlights ---
ViroMaterials.createMaterials({
  safeGreen: {
    diffuseColor: 'rgba(100, 220, 100, 0.4)',
    lightingModel: 'Constant',
  },
  riskRed: {
    diffuseColor: 'rgba(220, 80, 80, 0.4)',
    lightingModel: 'Constant',
  },
  riskAmber: {
    diffuseColor: 'rgba(240, 160, 50, 0.4)',
    lightingModel: 'Constant',
  },
  panelBackground: {
    diffuseColor: 'rgba(0, 0, 0, 0.75)',
    lightingModel: 'Constant',
  },
});

// --- Register float-in animation for nutrition panel ---
ViroAnimations.registerAnimations({
  floatIn: {
    properties: { scaleX: 1, scaleY: 1, scaleZ: 1, opacity: 1 },
    easing: 'Bounce',
    duration: 500,
  },
});

// --- Sample nutrition data (Goal 1: will come from USDA API in full app) ---
const SAMPLE_FOOD = {
  name: 'Grilled Chicken',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  saturatedFat: 1.0,
  sugar: 0,
  sodium: 74,
  riskLevel: 'safe',       // 'safe' | 'caution' | 'danger'
  riskMessage: 'Good protein source',
};

function NutritionPanel({ food, position }) {
  const riskColor =
    food.riskLevel === 'danger' ? '#FF4444'
    : food.riskLevel === 'caution' ? '#FFA500'
    : '#44CC44';

  const riskMaterial =
    food.riskLevel === 'danger' ? 'riskRed'
    : food.riskLevel === 'caution' ? 'riskAmber'
    : 'safeGreen';

  return (
    <ViroNode
      position={position}
      animation={{ name: 'floatIn', run: true }}
      opacity={0}
      scale={[0.1, 0.1, 0.1]}
    >
      {/* Highlight glow box beneath food */}
      <ViroBox
        position={[0, -0.15, 0]}
        scale={[0.25, 0.01, 0.25]}
        materials={[riskMaterial]}
      />

      {/* Nutrition info panel */}
      <ViroFlexView
        style={{
          flexDirection: 'column',
          padding: 0.04,
          width: 0.5,
          backgroundColor: '#000000CC',
        }}
        position={[0, 0.05, 0]}
      >
        {/* Food name header */}
        <ViroText
          text={food.name}
          style={{
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#FFFFFF',
            fontWeight: 'bold',
            textAlignVertical: 'center',
            textAlign: 'center',
          }}
          width={0.45}
          height={0.06}
        />

        {/* Divider line */}
        <ViroFlexView
          style={{ width: 0.45, height: 0.005, backgroundColor: '#FFFFFF44' }}
        />

        {/* Macro rows */}
        {[
          ['Calories', `${food.calories} kcal`],
          ['Protein',  `${food.protein} g`],
          ['Carbs',    `${food.carbs} g`],
          ['Fat',      `${food.fat} g`],
        ].map(([label, value]) => (
          <ViroFlexView
            key={label}
            style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 0.01 }}
          >
            <ViroText
              text={label}
              style={{ fontFamily: 'Arial', fontSize: 14, color: '#AAAAAA' }}
              width={0.22}
              height={0.045}
            />
            <ViroText
              text={value}
              style={{ fontFamily: 'Arial', fontSize: 14, color: '#FFFFFF', fontWeight: '500' }}
              width={0.22}
              height={0.045}
              textAlign="right"
            />
          </ViroFlexView>
        ))}

        {/* Risk indicator */}
        <ViroFlexView
          style={{
            marginTop: 0.015,
            padding: 0.01,
            backgroundColor: food.riskLevel === 'danger' ? '#FF444433'
              : food.riskLevel === 'caution' ? '#FFA50033'
              : '#44CC4433',
            borderRadius: 4,
          }}
        >
          <ViroText
            text={`${food.riskLevel === 'safe' ? '✓' : '⚠'} ${food.riskMessage}`}
            style={{ fontFamily: 'Arial', fontSize: 13, color: riskColor, textAlign: 'center' }}
            width={0.44}
            height={0.04}
          />
        </ViroFlexView>
      </ViroFlexView>
    </ViroNode>
  );
}

export default function ARFoodScanScene() {
  const [panelPosition, setPanelPosition] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [scanStatus, setScanStatus] = useState('Point camera at a flat surface like a plate or table');

  // When user taps on detected AR plane → place nutrition panel
  function onPlaneSelected(anchor) {
    const x = anchor.center[0];
    const y = anchor.center[1] + 0.1;  // float slightly above surface
    const z = anchor.center[2];
    setPanelPosition([x, y, z]);
    setSelectedFood(SAMPLE_FOOD);      // in full app: trigger food recognition here
    setScanStatus(`Detected surface — tap to scan food`);
  }

  function onSceneInitialized(state, reason) {
    if (state === 'TRACKING_NORMAL') {
      setScanStatus('Move camera slowly over your food plate');
    } else if (state === 'TRACKING_UNAVAILABLE') {
      setScanStatus('AR tracking lost — move to better lighting');
    }
  }

  return (
    <ViroARScene onTrackingUpdated={onSceneInitialized}>
      {/* Ambient light so 3D objects are visible */}
      <ViroAmbientLight color="#FFFFFF" intensity={200} />

      {/* Status text shown at top of screen in AR space */}
      <ViroText
        text={scanStatus}
        scale={[0.5, 0.5, 0.5]}
        position={[0, 0.6, -2]}
        style={{
          fontFamily: 'Arial',
          fontSize: 20,
          color: '#FFFFFF',
          textAlignVertical: 'center',
          textAlign: 'center',
        }}
        width={3}
        height={0.3}
      />

      {/* AR plane detector — user taps a flat surface to anchor nutrition panel */}
      <ViroARPlaneSelector
        onPlaneSelected={onPlaneSelected}
        minHeight={0.1}
        minWidth={0.1}
      >
        {/* Visual guide: semi-transparent quad shown on detected plane */}
        <ViroQuad
          rotation={[-90, 0, 0]}
          width={0.3}
          height={0.3}
          materials={['safeGreen']}
        />
      </ViroARPlaneSelector>

      {/* Nutrition panel — appears after user taps a surface */}
      {panelPosition && selectedFood && (
        <NutritionPanel
          food={selectedFood}
          position={panelPosition}
        />
      )}
    </ViroARScene>
  );
}
```

---

## Part 7 — Run on Your Device

### iOS (Mac required)
Connect your iPhone via USB. Trust the computer on your iPhone when prompted.

```bash
npx react-native run-ios --device "Your iPhone Name"
```

If you are unsure of your device name:
```bash
xcrun xctrace list devices
```

### Android
Enable Developer Options on your phone: go to Settings → About Phone → tap Build Number 7 times. Then enable USB Debugging.

```bash
npx react-native run-android
```

---

## Part 8 — What You Should See

When the app launches on your phone:

1. The camera opens immediately (this is your AR view)
2. You see the status text: "Move camera slowly over your food plate"
3. Slowly move the camera over a flat surface (table, plate, floor)
4. A green translucent square appears where a surface is detected
5. Tap the green square
6. A floating black nutrition panel appears above the surface showing:
   - "Grilled Chicken" (sample food name)
   - Calories, Protein, Carbs, Fat values
   - A green "✓ Good protein source" risk badge
7. The panel animates in with a bounce effect

This confirms your AR scene is working end to end.

---

## Part 9 — Next Steps to Build Goal 1 Fully

Now that the Hello World AR scene works, replace the sample food data with real detection:

### Step A — Add Clarifai food recognition API call
In `src/services/FoodRecognition.js`:

```javascript
const CLARIFAI_API_KEY = 'your_key_here';
const CLARIFAI_MODEL_ID = 'food-item-recognition';

export async function identifyFood(base64Image) {
  const response = await fetch(
    `https://api.clarifai.com/v2/models/${CLARIFAI_MODEL_ID}/outputs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Key ${CLARIFAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [{ data: { image: { base64: base64Image } } }],
      }),
    }
  );
  const data = await response.json();
  // Returns list of { name, value (confidence) }
  return data.outputs[0].data.concepts;
}
```

### Step B — Add USDA nutrition lookup
In `src/services/NutritionAPI.js`:

```javascript
const USDA_API_KEY = 'your_key_here';   // free key at fdc.nal.usda.gov

export async function getNutrition(foodName) {
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&api_key=${USDA_API_KEY}&pageSize=1`
  );
  const data = await res.json();
  if (!data.foods?.length) return null;

  const food = data.foods[0];
  const get = (name) =>
    food.foodNutrients.find(n => n.nutrientName.includes(name))?.value ?? 0;

  return {
    name: food.description,
    calories:      get('Energy'),
    protein:       get('Protein'),
    carbs:         get('Carbohydrate'),
    fat:           get('Total lipid'),
    saturatedFat:  get('Fatty acids, total saturated'),
    sugar:         get('Sugars, total'),
    sodium:        get('Sodium'),
  };
}
```

### Step C — Connect recognition + nutrition in the AR scene
In `ARFoodScanScene.js`, replace the `onPlaneSelected` handler:

```javascript
async function onPlaneSelected(anchor) {
  setScanStatus('Analyzing food...');

  // 1. Capture camera frame as base64
  const frame = await cameraRef.current.takePictureAsync({ base64: true });

  // 2. Identify food
  const concepts = await identifyFood(frame.base64);
  const topFood = concepts[0].name;   // e.g. "pizza", "salad"

  // 3. Look up nutrition
  const nutrition = await getNutrition(topFood);

  // 4. Compute risk (Goal 2)
  const risk = computeRiskScore(nutrition, wearableData);

  // 5. Place AR panel
  const [x, y, z] = anchor.center;
  setPanelPosition([x, y + 0.1, z]);
  setSelectedFood({ ...nutrition, ...risk });
  setScanStatus('');
}
```

---

## Free API Keys You Need

| Service | URL | Cost |
|---------|-----|------|
| USDA FoodData Central | https://fdc.nal.usda.gov/api-guide.html | Free |
| Clarifai Food Recognition | https://clarifai.com | Free tier (1,000 calls/month) |
| Google Cloud Vision (alternative) | https://cloud.google.com/vision | Free tier (1,000 calls/month) |

---

## Common Errors and Fixes

| Error | Fix |
|-------|-----|
| `ViroARSceneNavigator is undefined` | Run `pod install` in `/ios` again, then rebuild |
| `AR tracking unavailable` | Test on a real device, not simulator |
| `Camera permission denied` | Check Info.plist has `NSCameraUsageDescription` |
| `Build failed: multiDex` | Add `multiDexEnabled true` to `android/app/build.gradle` |
| `Pod install fails` | Run `sudo gem install cocoapods` then retry |
| `Module not found: @reactvision/react-viro` | Run `npm install @reactvision/react-viro` then `pod install` |
| App crashes on launch (Android) | Check `minSdkVersion` is 26 in `android/build.gradle` |

---

*Guide version: May 2026 | React Native 0.72 | @reactvision/react-viro 2.41+*
