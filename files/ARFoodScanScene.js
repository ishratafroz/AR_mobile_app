// ─────────────────────────────────────────────────────────────────────────────
// ARFoodScanScene.js  –  Goal 1 (complete)
// Multi-food AR scene.  Camera frames are analysed periodically;
// each detected food item gets its own anchored NutritionPanel.
// Supports: tap-to-select, portion override, summary/expanded toggle,
//           plate-level aggregate, and (in Goal 2) risk highlights.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useRef, useEffect, useCallback
} from 'react';
import {
  StyleSheet, View, TouchableOpacity, Text, ActivityIndicator,
} from 'react-native';
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroARPlaneSelector,
  ViroAmbientLight,
  ViroNode,
  ViroQuad,
  ViroText,
  ViroFlexView,
  ViroMaterials,
  ViroAnimations,
  ViroARCamera,
} from '@reactvision/react-viro';
import { RNCamera }             from 'react-native-camera';

import { identifyFoodItems }    from '../services/FoodRecognition';
import { getNutritionForFood,
         aggregatePlateNutrition } from '../services/NutritionAPI';
import { estimatePortionGrams,
         getPortionSizeLabel }  from '../utils/PortionEstimator';
import NutritionPanel           from '../components/NutritionPanel';
import RiskHUD                  from '../components/RiskHUD';          // Goal 2
import { computeRiskScore }     from '../engine/RiskEngine';           // Goal 2

// ─── Constants ────────────────────────────────────────────────────────────────
const SCAN_INTERVAL_MS  = 2500;   // scan a new frame every 2.5 seconds
const MAX_ITEMS_ON_PLATE = 6;

// ─── Scene-level AR materials ─────────────────────────────────────────────────
ViroMaterials.createMaterials({
  planeGuide: { diffuseColor: 'rgba(77,166,255,0.25)', lightingModel: 'Constant' },
});

ViroAnimations.registerAnimations({
  scanPulse: {
    properties: { opacity: 0.15 },
    easing: 'EaseInEaseOut',
    duration: 700,
    loop: true,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Inner ViroARScene component
// ─────────────────────────────────────────────────────────────────────────────
function FoodARScene({ arSceneNavigator }) {
  // Each food item detected on the plate
  const [foodItems, setFoodItems]     = useState([]);   // Array of FoodItem
  const [isScanning, setIsScanning]   = useState(false);
  const [scanStatus, setScanStatus]   = useState('Slowly move camera over your plate');
  const [plateAnchor, setPlateAnchor] = useState(null);

  // Wearable data injected from parent (Goal 2)
  const wearableData = arSceneNavigator?.viroAppProps?.wearableData ?? null;

  const cameraRef    = useRef(null);
  const scanTimerRef = useRef(null);
  const itemsRef     = useRef(foodItems);
  itemsRef.current   = foodItems;

  // ─── Start periodic scanning once plate surface is anchored ───────────────
  useEffect(() => {
    if (!plateAnchor) return;
    scanTimerRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
    return () => clearInterval(scanTimerRef.current);
  }, [plateAnchor]);

  // ─── Core scan function ───────────────────────────────────────────────────
  const scanFrame = useCallback(async () => {
    if (isScanning || !cameraRef.current) return;
    if (itemsRef.current.length >= MAX_ITEMS_ON_PLATE) return;

    setIsScanning(true);
    setScanStatus('Analysing...');

    try {
      // 1. Capture camera frame
      const photo = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.5, skipProcessing: true,
      });

      // 2. Identify food items in the frame
      const concepts = await identifyFoodItems(photo.base64);
      if (!concepts.length) {
        setScanStatus('No food detected – aim camera at your plate');
        setIsScanning(false);
        return;
      }

      // 3. For each new concept not already on the plate, fetch nutrition
      const existing  = new Set(itemsRef.current.map(i => i.label));
      const newConcepts = concepts.filter(c => !existing.has(c.label));

      for (const concept of newConcepts.slice(0, 2)) {  // max 2 new per scan
        // Estimate portion
        const portionResult = estimatePortionGrams({
          foodLabel: concept.label,
          boundingBox: null,   // refine when bounding box detection available
          imageSize:  { width: photo.width, height: photo.height },
          plateBBox:  plateAnchor,
        });

        // Fetch nutrition from USDA
        const nutrition = await getNutritionForFood(
          concept.label,
          portionResult.grams
        );
        if (!nutrition) continue;

        // Compute risk score (Goal 2 – safe fallback if no wearable data)
        const risk = computeRiskScore(nutrition.summary, wearableData);

        // Assign world-space position:
        // Spread items around the plate centre with slight offset per index
        const idx   = itemsRef.current.length;
        const angle = (idx / MAX_ITEMS_ON_PLATE) * 2 * Math.PI;
        const radius = 0.15;
        const pos    = [
          plateAnchor.x + Math.cos(angle) * radius,
          plateAnchor.y + 0.22,
          plateAnchor.z + Math.sin(angle) * radius,
        ];

        const newItem = {
          id:           `food_${Date.now()}_${idx}`,
          label:        concept.label,
          confidence:   concept.confidence,
          portionGrams: portionResult.grams,
          portionMethod: portionResult.method,
          nutrition,
          riskLevel:    risk.level,
          riskMessage:  risk.message,
          position:     pos,
          visible:      true,
        };

        setFoodItems(prev => [...prev, newItem]);
      }

      setScanStatus(
        `${itemsRef.current.length} item(s) detected — tap a panel to expand`
      );
    } catch (err) {
      console.error('[ARFoodScanScene] Scan error:', err);
      setScanStatus('Scan failed – please try again');
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, plateAnchor, wearableData]);

  // ─── Portion override ────────────────────────────────────────────────────
  const handlePortionChange = useCallback(async (itemId, size) => {
    setFoodItems(prev => prev.map(async item => {
      if (item.id !== itemId) return item;
      const newPortion  = estimatePortionGrams({
        foodLabel: item.label, userOverride: size,
      });
      const newNutrition = await getNutritionForFood(item.label, newPortion.grams);
      const newRisk      = computeRiskScore(newNutrition?.summary ?? item.nutrition.summary, wearableData);
      return {
        ...item,
        portionGrams: newPortion.grams,
        nutrition: newNutrition ?? item.nutrition,
        riskLevel: newRisk.level,
        riskMessage: newRisk.message,
      };
    }));
  }, [wearableData]);

  // ─── Dismiss an item ─────────────────────────────────────────────────────
  const handleDismiss = useCallback((itemId) => {
    setFoodItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  // ─── Plane selected ──────────────────────────────────────────────────────
  const onPlaneSelected = useCallback((anchor) => {
    setPlateAnchor({
      x: anchor.center[0],
      y: anchor.center[1],
      z: anchor.center[2],
      w: anchor.extent?.[0] ?? 0.3,
      h: anchor.extent?.[2] ?? 0.3,
    });
    setScanStatus('Plate surface locked — scanning food...');
  }, []);

  // ─── Tracking status ────────────────────────────────────────────────────
  const onTrackingUpdated = useCallback((state) => {
    if (state === 'TRACKING_NORMAL' && !plateAnchor) {
      setScanStatus('AR ready — tap a flat surface to lock onto plate');
    } else if (state === 'TRACKING_UNAVAILABLE') {
      setScanStatus('Tracking lost — move to better lighting');
    }
  }, [plateAnchor]);

  // ─── Plate aggregate for HUD ────────────────────────────────────────────
  const plateAggregate = aggregatePlateNutrition(foodItems.map(i => i.nutrition));

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      <ViroAmbientLight color="#FFFFFF" intensity={250} />

      {/* Status text floating in top-centre of view */}
      <ViroText
        text={isScanning ? 'Scanning...' : scanStatus}
        scale={[0.45, 0.45, 0.45]}
        position={[0, 0.55, -1.8]}
        style={{
          fontFamily: 'Arial', fontSize: 18,
          color: '#FFFFFF', textAlign: 'center',
        }}
        width={3.5}
        height={0.28}
      />

      {/* Plate surface selector — shows AR guide quad on detected planes */}
      {!plateAnchor && (
        <ViroARPlaneSelector
          onPlaneSelected={onPlaneSelected}
          minHeight={0.15}
          minWidth={0.15}
        >
          <ViroQuad
            rotation={[-90, 0, 0]}
            width={0.35}
            height={0.35}
            materials={['planeGuide']}
            animation={{ name: 'scanPulse', run: true }}
          />
        </ViroARPlaneSelector>
      )}

      {/* Nutrition panels – one per detected food item */}
      {foodItems.map(item => (
        item.visible && (
          <NutritionPanel
            key={item.id}
            position={item.position}
            foodName={item.label}
            nutrition={item.nutrition}
            riskLevel={item.riskLevel}
            riskMessage={item.riskMessage}
            portionGrams={item.portionGrams}
            onDismiss={() => handleDismiss(item.id)}
            onPortionChange={(size) => handlePortionChange(item.id, size)}
          />
        )
      ))}

      {/* Plate total aggregate node */}
      {foodItems.length > 1 && plateAnchor && (
        <PlateTotalPanel
          position={[plateAnchor.x, plateAnchor.y + 0.35, plateAnchor.z]}
          aggregate={plateAggregate}
          itemCount={foodItems.length}
        />
      )}
    </ViroARScene>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plate total summary panel
// ─────────────────────────────────────────────────────────────────────────────
function PlateTotalPanel({ position, aggregate, itemCount }) {
  return (
    <ViroNode position={position}>
      <ViroFlexView
        style={{
          flexDirection: 'column',
          width: 0.38,
          backgroundColor: '#001833CC',
          padding: 0.018,
        }}
      >
        <ViroText
          text={`PLATE TOTAL  (${itemCount} items)`}
          style={{ fontFamily: 'Arial', fontSize: 12, color: '#4DA6FF',
                   fontWeight: 'bold', textAlign: 'center' }}
          width={0.36}
          height={0.038}
        />
        {[
          [`${aggregate.calories} kcal`, 'Calories'],
          [`${aggregate.protein}g`,      'Protein'],
          [`${aggregate.carbs}g`,        'Carbs'],
          [`${aggregate.fat}g`,          'Fat'],
        ].map(([val, lbl]) => (
          <ViroFlexView key={lbl}
            style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 0.006 }}>
            <ViroText text={lbl} style={{ fontFamily: 'Arial', fontSize: 12, color: '#AAAAAA' }}
              width={0.16} height={0.036} />
            <ViroText text={val} style={{ fontFamily: 'Arial', fontSize: 12, color: '#FFFFFF', fontWeight: '500', textAlign: 'right' }}
              width={0.16} height={0.036} />
          </ViroFlexView>
        ))}
      </ViroFlexView>
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root exported component – wraps ViroARSceneNavigator + camera layer
// ─────────────────────────────────────────────────────────────────────────────
export default function ARFoodScanScreen({ wearableData }) {
  const cameraRef = useRef(null);

  return (
    <View style={styles.root}>
      {/* Native camera layer (used for frame capture only) */}
      <RNCamera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        type={RNCamera.Constants.Type.back}
        captureAudio={false}
        androidCameraPermissionOptions={{
          title: 'Camera permission',
          message: 'ARDietApp needs camera access to scan food',
        }}
      />

      {/* ViroReact AR overlay layer */}
      <ViroARSceneNavigator
        autofocus
        style={StyleSheet.absoluteFill}
        initialScene={{ scene: FoodARScene }}
        viroAppProps={{ wearableData, cameraRef }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
