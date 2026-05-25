// ─────────────────────────────────────────────────────────────────────────────
// RiskHUD.js  –  Goal 2
// Persistent AR heads-up display anchored to camera view (screen-space).
// Shows: overall meal risk score, live heart rate, step count,
//        and per-profile risk tier bars.
// Updated every time wearableData or riskResult changes.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Platform }                    from 'react-native';
import {
  ViroNode,
  ViroFlexView,
  ViroText,
  ViroBox,
  ViroAnimations,
  ViroMaterials,
  ViroARCamera,
} from '@reactvision/react-viro';

import { initHealthKit,
         getWearableMetrics  as getHKMetrics,
         subscribeToHeartRate as subscribeHK }  from './HealthKitService';
import { initGoogleFit,
         getWearableMetrics  as getGFMetrics,
         subscribeToHeartRate as subscribeGF }  from './GoogleFitService';

// ─── Materials ────────────────────────────────────────────────────────────────
ViroMaterials.createMaterials({
  hudBg:         { diffuseColor: 'rgba(0,0,0,0.72)',    lightingModel: 'Constant' },
  barSafe:       { diffuseColor: 'rgba(68,204,68,0.9)', lightingModel: 'Constant' },
  barCaution:    { diffuseColor: 'rgba(255,165,0,0.9)', lightingModel: 'Constant' },
  barDanger:     { diffuseColor: 'rgba(220,60,60,0.9)', lightingModel: 'Constant' },
  barTrack:      { diffuseColor: 'rgba(255,255,255,0.15)', lightingModel: 'Constant' },
  heartRed:      { diffuseColor: 'rgba(255,80,80,1.0)', lightingModel: 'Constant' },
});

ViroAnimations.registerAnimations({
  heartBeat: {
    properties: { scaleX: 1.25, scaleY: 1.25, scaleZ: 1.25 },
    easing: 'Bounce',
    duration: 350,
  },
  heartBeatReturn: {
    properties: { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 },
    easing: 'EaseOut',
    duration: 350,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RiskHUD
 *
 * Props:
 *   riskResult      {RiskResult}        – from RiskEngine.computeRiskScore
 *   onMetricsUpdate {(WearableMetrics) => void}  – propagates live data up
 */
export default function RiskHUD({ riskResult, onMetricsUpdate }) {
  const [metrics,    setMetrics]    = useState(null);
  const [heartAnim,  setHeartAnim]  = useState(false);

  // ─── Initialise wearables on mount ────────────────────────────────────────
  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      if (Platform.OS === 'ios') {
        const ok = await initHealthKit();
        if (ok) {
          const m = await getHKMetrics();
          setMetrics(m);
          onMetricsUpdate?.(m);
          unsubscribe = subscribeHK((bpm) => {
            setMetrics(prev => prev ? { ...prev, heartRate: bpm } : { heartRate: bpm });
            pulseHeart();
          });
        }
      } else {
        const ok = await initGoogleFit();
        if (ok) {
          const m = await getGFMetrics();
          setMetrics(m);
          onMetricsUpdate?.(m);
          unsubscribe = subscribeGF((bpm) => {
            setMetrics(prev => prev ? { ...prev, heartRate: bpm } : { heartRate: bpm });
            pulseHeart();
          });
        }
      }
    })();

    // Refresh full metrics every 60 seconds
    const refreshTimer = setInterval(async () => {
      const m = Platform.OS === 'ios'
        ? await getHKMetrics()
        : await getGFMetrics();
      setMetrics(m);
      onMetricsUpdate?.(m);
    }, 60_000);

    return () => {
      unsubscribe();
      clearInterval(refreshTimer);
    };
  }, []);

  // Animate heart icon on new HR reading
  function pulseHeart() {
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 800);
  }

  const risk = riskResult ?? { score: 0, level: 'safe', message: '—', profiles: {} };
  const hr   = metrics?.heartRate          ?? '—';
  const steps = metrics?.steps != null
    ? metrics.steps.toLocaleString()
    : '—';
  const sleep = metrics?.sleepHours != null
    ? `${metrics.sleepHours}h`
    : '—';

  const scoreColor = risk.level === 'danger' ? '#FF4444'
    : risk.level === 'caution' ? '#FFA500'
    : '#44CC44';

  // ─── HUD positioned in top-right of camera view ───────────────────────────
  // position={[0.45, 0.35, -1.2]} works for most phone FOVs
  return (
    <ViroNode
      position={[0.45, 0.35, -1.2]}
      rotation={[0, 0, 0]}
    >
      {/* ── Outer container ── */}
      <ViroFlexView
        style={{
          flexDirection:   'column',
          width:            0.32,
          backgroundColor: '#000000B8',
          padding:          0.016,
        }}
      >

        {/* ─ Row 1: Risk score + label ─ */}
        <ViroFlexView style={{ flexDirection: 'row', justifyContent: 'space-between',
                               alignItems: 'center', marginBottom: 0.01 }}>
          <ViroText
            text="MEAL RISK"
            style={{ fontFamily: 'Arial', fontSize: 10, color: '#888888',
                     fontWeight: 'bold', letterSpacing: 1 }}
            width={0.15}
            height={0.03}
          />
          <ViroText
            text={`${risk.score}/100`}
            style={{ fontFamily: 'Arial', fontSize: 18, color: scoreColor,
                     fontWeight: 'bold', textAlign: 'right' }}
            width={0.12}
            height={0.04}
          />
        </ViroFlexView>

        {/* Risk message */}
        <ViroText
          text={risk.message}
          style={{ fontFamily: 'Arial', fontSize: 10, color: scoreColor }}
          width={0.28}
          height={0.028}
        />

        {/* ─ Divider ─ */}
        <ViroBox scale={[0.28, 0.002, 0.001]} materials={['barTrack']}
          style={{ marginTop: 0.01, marginBottom: 0.01 }} />

        {/* ─ Profile bars ─ */}
        {[
          { label: 'Cardio',    profile: 'cardiovascular' },
          { label: 'Diabetes',  profile: 'diabetes'       },
          { label: 'Fitness',   profile: 'fitness'        },
        ].map(({ label, profile }) => {
          const p     = risk.profiles?.[profile];
          const score = p?.score ?? 0;
          const level = p?.level ?? 'safe';
          const barW  = Math.max(0.004, (score / 100) * 0.22);
          const barMat = level === 'danger' ? 'barDanger'
            : level === 'caution' ? 'barCaution'
            : 'barSafe';
          return (
            <ViroFlexView key={profile}
              style={{ flexDirection: 'row', alignItems: 'center',
                       marginBottom: 0.007 }}>
              <ViroText
                text={label}
                style={{ fontFamily: 'Arial', fontSize: 10, color: '#AAAAAA' }}
                width={0.072}
                height={0.028}
              />
              {/* Track */}
              <ViroBox scale={[0.22, 0.008, 0.001]}
                position={[0.11, 0, 0]}
                materials={['barTrack']}
              />
              {/* Fill */}
              <ViroBox scale={[barW, 0.008, 0.002]}
                position={[0.11 - (0.22 - barW) / 2, 0, 0.001]}
                materials={[barMat]}
              />
              <ViroText
                text={`${score}`}
                style={{ fontFamily: 'Arial', fontSize: 10, color: '#AAAAAA',
                         textAlign: 'right' }}
                width={0.03}
                height={0.028}
              />
            </ViroFlexView>
          );
        })}

        {/* ─ Divider ─ */}
        <ViroBox scale={[0.28, 0.002, 0.001]} materials={['barTrack']}
          style={{ marginTop: 0.006, marginBottom: 0.01 }} />

        {/* ─ Wearable metrics row ─ */}
        <ViroFlexView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {/* Heart rate */}
          <ViroFlexView style={{ flexDirection: 'column', alignItems: 'center' }}>
            <ViroBox
              scale={[0.018, 0.018, 0.002]}
              materials={['heartRed']}
              animation={heartAnim ? { name: 'heartBeat', run: true } : undefined}
            />
            <ViroText
              text={`${hr} bpm`}
              style={{ fontFamily: 'Arial', fontSize: 11, color: '#FF8888',
                       textAlign: 'center' }}
              width={0.09}
              height={0.028}
            />
          </ViroFlexView>

          {/* Steps */}
          <ViroFlexView style={{ flexDirection: 'column', alignItems: 'center' }}>
            <ViroText
              text="Steps"
              style={{ fontFamily: 'Arial', fontSize: 9, color: '#888888' }}
              width={0.07}
              height={0.024}
            />
            <ViroText
              text={steps}
              style={{ fontFamily: 'Arial', fontSize: 13, color: '#88CCFF',
                       textAlign: 'center', fontWeight: '500' }}
              width={0.09}
              height={0.03}
            />
          </ViroFlexView>

          {/* Sleep */}
          <ViroFlexView style={{ flexDirection: 'column', alignItems: 'center' }}>
            <ViroText
              text="Sleep"
              style={{ fontFamily: 'Arial', fontSize: 9, color: '#888888' }}
              width={0.06}
              height={0.024}
            />
            <ViroText
              text={sleep}
              style={{ fontFamily: 'Arial', fontSize: 13, color: '#CCAAFF',
                       textAlign: 'center', fontWeight: '500' }}
              width={0.06}
              height={0.03}
            />
          </ViroFlexView>
        </ViroFlexView>

        {/* No wearable warning */}
        {!metrics && (
          <ViroText
            text="No wearable connected"
            style={{ fontFamily: 'Arial', fontSize: 9, color: '#FF8844',
                     textAlign: 'center' }}
            width={0.28}
            height={0.024}
          />
        )}
      </ViroFlexView>
    </ViroNode>
  );
}
