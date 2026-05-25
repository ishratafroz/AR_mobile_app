import React, { useState, useEffect, useRef } from 'react';
import {
  ViroARScene,
  ViroText,
  ViroNode,
  ViroARPlaneSelector,
  ViroMaterials,
  ViroAnimations,
  ViroAmbientLight,
  ViroQuad,
  ViroBox,
  ViroTrackingStateConstants,
  ViroARTrackingReasonConstants,
} from '@reactvision/react-viro';

ViroMaterials.createMaterials({
  reticle:        { diffuseColor: 'rgba(120, 220, 120, 0.55)', lightingModel: 'Constant' },
  panelBackground:{ diffuseColor: 'rgba(0, 0, 0, 0.78)',       lightingModel: 'Constant' },
  glowSafe:       { diffuseColor: 'rgba(80, 220, 120, 0.55)',  lightingModel: 'Constant' },
  glowCaution:    { diffuseColor: 'rgba(255, 170, 60, 0.6)',   lightingModel: 'Constant' },
  glowDanger:     { diffuseColor: 'rgba(230, 70, 70, 0.65)',   lightingModel: 'Constant' },
});

ViroAnimations.registerAnimations({
  floatIn:   { properties: { scaleX: 1, scaleY: 1, scaleZ: 1, opacity: 1 }, easing: 'Bounce', duration: 450 },
  pulseRing: { properties: { opacity: 0.25 }, easing: 'EaseInEaseOut', duration: 900, loop: true },
});

const RISK_COLOR = { safe: '#44CC44', caution: '#FFA500', danger: '#FF4444' };
const GLOW_MAT   = { safe: 'glowSafe', caution: 'glowCaution', danger: 'glowDanger' };

// --- Panel rendered above each anchor or in front of camera ---
function NutritionPanel({ food, position }) {
  const color = RISK_COLOR[food.riskLevel] || '#FFFFFF';
  const glow  = GLOW_MAT[food.riskLevel]   || 'glowSafe';

  const giLine = food.gi != null ? `GI        ${food.gi} (${food.giCategory})\n` : '';
  const text =
    `${food.name}\n` +
    `--------------------\n` +
    `Calories  ${food.calories} kcal\n` +
    `Protein   ${food.protein} g\n` +
    `Carbs     ${food.carbs} g\n` +
    `Sugar     ${food.sugar} g\n` +
    `Fat       ${food.fat} g\n` +
    giLine;

  return (
    <ViroNode
      position={position}
      transformBehaviors={['billboard']}
      animation={{ name: 'floatIn', run: true }}
      opacity={0}
      scale={[0.3, 0.3, 0.3]}
    >
      {/* glow underneath food (only meaningful when anchored on plane) */}
      <ViroBox
        position={[0, -0.12, 0]}
        scale={[0.25, 0.005, 0.25]}
        materials={[glow]}
      />

      {/* panel background */}
      <ViroQuad
        width={0.36}
        height={0.30}
        materials={['panelBackground']}
        position={[0, 0, -0.001]}
      />

      {/* nutrition body */}
      <ViroText
        text={text}
        position={[0, 0.02, 0]}
        width={0.34}
        height={0.26}
        scale={[0.12, 0.12, 0.12]}
        style={{
          fontFamily: 'Roboto',
          fontSize: 18,
          color: '#FFFFFF',
          textAlign: 'left',
          textAlignVertical: 'top',
        }}
      />

      {/* risk badge */}
      <ViroText
        text={`${food.riskLevel === 'safe' ? 'OK' : '!'}  ${food.riskLevel.toUpperCase()} — ${food.riskMessage || ''}`}
        position={[0, -0.135, 0]}
        width={0.34}
        height={0.04}
        scale={[0.12, 0.12, 0.12]}
        style={{
          fontFamily: 'Roboto',
          fontSize: 16,
          color,
          textAlign: 'center',
          textAlignVertical: 'center',
          fontWeight: 'bold',
        }}
      />
    </ViroNode>
  );
}

// Camera-relative fallback position so the panel always shows even without a plane
const CAMERA_FALLBACK_POS = [0, 0, -0.6];

export default function ARFoodScanScene(props) {
  const [anchorPos, setAnchorPos]   = useState(null);   // [x,y,z] in world space after plane tap
  const [trackingOk, setTrackingOk] = useState(false);
  const [status, setStatus]         = useState('Initializing AR — move phone slowly');
  const planeSelectorRef            = useRef(null);

  const appProps     = props.arSceneNavigator?.viroAppProps || {};
  const scannedFood  = appProps.food;
  const scanToken    = appProps.scanToken;

  // Tracking state -> status text
  function onTrackingUpdated(state, reason) {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      setTrackingOk(true);
      if (!anchorPos) setStatus('AR ready — tap a flat surface to anchor, or press SCAN / PICK');
    } else if (state === ViroTrackingStateConstants.TRACKING_LIMITED) {
      setTrackingOk(false);
      if (reason === ViroARTrackingReasonConstants.TRACKING_REASON_EXCESSIVE_MOTION) {
        setStatus('Slow down — moving too fast');
      } else if (reason === ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_FEATURES) {
        setStatus('Need more texture — aim at patterned surface');
      } else {
        setStatus('Tracking limited — move phone slowly side to side');
      }
    } else {
      setTrackingOk(false);
      setStatus('AR not ready — move phone in small circles');
    }
  }

  // User tapped a detected surface
  function onPlaneSelected(anchor) {
    const c = anchor?.position || anchor?.center;
    if (!c) return;
    setAnchorPos([c[0], c[1] + 0.05, c[2]]);
    setStatus('Surface anchored — press SCAN or PICK to load nutrition');
  }

  // When a new food arrives from App.js, update status
  useEffect(() => {
    if (scannedFood) {
      setStatus(`Identified: ${scannedFood.name}`);
    }
  }, [scanToken, scannedFood]);

  // Panel position: anchored if user tapped a plane, else floating in front of camera
  const panelPosition = anchorPos ?? CAMERA_FALLBACK_POS;

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      <ViroAmbientLight color="#FFFFFF" intensity={250} />

      {/* status text floating in upper view */}
      <ViroText
        text={status}
        scale={[0.4, 0.4, 0.4]}
        position={[0, 0.5, -1.5]}
        width={3.2}
        height={0.3}
        style={{
          fontFamily: 'Arial',
          fontSize: 18,
          color: '#FFFFFF',
          textAlign: 'center',
          textAlignVertical: 'center',
        }}
      />

      {/* small reticle on detected planes; user taps to anchor.
          Hidden once an anchor has been chosen so it doesn't obstruct the camera. */}
      {!anchorPos && (
        <ViroARPlaneSelector
          ref={planeSelectorRef}
          minHeight={0.1}
          minWidth={0.1}
          alignment="Horizontal"
          onPlaneSelected={onPlaneSelected}
        >
          <ViroQuad
            rotation={[-90, 0, 0]}
            width={0.18}
            height={0.18}
            materials={['reticle']}
            animation={{ name: 'pulseRing', run: true }}
          />
        </ViroARPlaneSelector>
      )}

      {/* Nutrition panel: appears as soon as a food is scanned, anchored or floating */}
      {scannedFood && (
        <NutritionPanel food={scannedFood} position={panelPosition} />
      )}
    </ViroARScene>
  );
}
