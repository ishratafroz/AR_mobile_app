// ─────────────────────────────────────────────────────────────────────────────
// NutritionPanel.js  –  Goal 1
// AR floating panel component.
// Renders a <nutrition, measure> pair list anchored above a detected food item.
// Supports toggle between Summary view (4 macros) and Expanded view (all nutrients).
// Color-coded by risk level (driven by RiskEngine in Goal 2).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  ViroNode,
  ViroFlexView,
  ViroText,
  ViroAnimations,
  ViroMaterials,
  ViroBox,
  ViroImage,
} from '@reactvision/react-viro';

// ─── Animations ───────────────────────────────────────────────────────────────
ViroAnimations.registerAnimations({
  panelAppear: {
    properties: { scaleX: 1, scaleY: 1, scaleZ: 1, opacity: 1 },
    easing: 'Bounce',
    duration: 400,
  },
  panelDisappear: {
    properties: { scaleX: 0, scaleY: 0, scaleZ: 0, opacity: 0 },
    easing: 'EaseIn',
    duration: 200,
  },
  pulseRed: {
    properties: { opacity: 0.3 },
    easing: 'EaseInEaseOut',
    duration: 600,
    loop: true,
  },
});

// ─── Materials ────────────────────────────────────────────────────────────────
ViroMaterials.createMaterials({
  riskSafe:    { diffuseColor: 'rgba(68,204,68,0.45)',  lightingModel: 'Constant' },
  riskCaution: { diffuseColor: 'rgba(255,165,0,0.45)', lightingModel: 'Constant' },
  riskDanger:  { diffuseColor: 'rgba(220,60,60,0.50)', lightingModel: 'Constant' },
  panelBg:     { diffuseColor: 'rgba(10,10,10,0.82)',  lightingModel: 'Constant' },
  divider:     { diffuseColor: 'rgba(255,255,255,0.15)', lightingModel: 'Constant' },
});

// ─── Style constants ──────────────────────────────────────────────────────────
const COLORS = {
  white:      '#FFFFFF',
  muted:      '#AAAAAA',
  green:      '#44CC44',
  amber:      '#FFA500',
  red:        '#FF4444',
  blue:       '#4DA6FF',
  header:     '#FFFFFF',
  subheader:  '#CCCCCC',
};

const FONT = 'Arial';
const PANEL_WIDTH  = 0.52;
const ROW_HEIGHT   = 0.042;
const ROW_GAP      = 0.006;
const PADDING      = 0.022;

// ─── Category section headers ─────────────────────────────────────────────────
const SECTION_ORDER = ['macro', 'mineral', 'vitamin'];
const SECTION_LABELS = {
  macro:   'Macronutrients',
  mineral: 'Minerals',
  vitamin: 'Vitamins',
};

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * NutritionPanel
 *
 * Props:
 *   position       {[x,y,z]}         AR world position
 *   foodName       {string}
 *   nutrition      {NutritionResult}  Full result from NutritionAPI
 *   riskLevel      {'safe'|'caution'|'danger'}
 *   riskMessage    {string}
 *   portionGrams   {number}
 *   onDismiss      {() => void}
 *   onPortionChange {(size: string) => void}
 */
export default function NutritionPanel({
  position,
  foodName       = 'Unknown Food',
  nutrition      = null,
  riskLevel      = 'safe',
  riskMessage    = '',
  portionGrams   = 150,
  onDismiss,
  onPortionChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const [visible,  setVisible]  = useState(true);

  const riskMaterial = riskLevel === 'danger' ? 'riskDanger'
    : riskLevel === 'caution' ? 'riskCaution'
    : 'riskSafe';

  const riskColor = riskLevel === 'danger' ? COLORS.red
    : riskLevel === 'caution' ? COLORS.amber
    : COLORS.green;

  const toggleExpanded = useCallback(() => setExpanded(e => !e), []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible || !nutrition) return null;

  const { summary, pairs } = nutrition;

  return (
    <ViroNode
      position={position}
      animation={{ name: 'panelAppear', run: true }}
      opacity={0}
      scale={[0.01, 0.01, 0.01]}
    >
      {/* ── Risk highlight glow on food surface ── */}
      <ViroBox
        position={[0, -0.18, 0]}
        scale={[0.28, 0.012, 0.28]}
        materials={[riskMaterial]}
        animation={riskLevel === 'danger' ? { name: 'pulseRed', run: true } : undefined}
      />

      {/* ── Main panel ── */}
      <ViroFlexView
        style={{
          flexDirection:  'column',
          width:           PANEL_WIDTH,
          backgroundColor: '#0A0A0AD0',
          padding:         PADDING,
        }}
        position={[0, 0, 0]}
      >
        {/* ─ Header row: food name + dismiss button ─ */}
        <ViroFlexView style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0.012 }}>
          <ViroText
            text={foodName.toUpperCase()}
            style={{ fontFamily: FONT, fontSize: 15, color: COLORS.header, fontWeight: 'bold' }}
            width={PANEL_WIDTH - 0.1}
            height={0.05}
          />
          <ViroText
            text="✕"
            style={{ fontFamily: FONT, fontSize: 14, color: COLORS.muted, textAlign: 'right' }}
            width={0.06}
            height={0.05}
            onClick={handleDismiss}
          />
        </ViroFlexView>

        {/* ─ Portion row ─ */}
        <ViroFlexView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0.01 }}>
          <ViroText
            text={`Portion: ${portionGrams}g`}
            style={{ fontFamily: FONT, fontSize: 12, color: COLORS.muted }}
            width={0.2}
            height={ROW_HEIGHT}
          />
          {['small', 'medium', 'large'].map(size => (
            <ViroText
              key={size}
              text={size}
              style={{ fontFamily: FONT, fontSize: 11, color: COLORS.blue, textAlign: 'center' }}
              width={0.08}
              height={ROW_HEIGHT}
              onClick={() => onPortionChange?.(size)}
            />
          ))}
        </ViroFlexView>

        {/* ─ Horizontal divider ─ */}
        <ViroBox scale={[PANEL_WIDTH - PADDING * 2, 0.002, 0.001]} materials={['divider']} />

        {/* ─ SUMMARY VIEW: 4 main macros ─ */}
        <ViroFlexView style={{ marginTop: 0.01 }}>
          {[
            { label: 'Calories',  value: `${summary.calories} kcal` },
            { label: 'Protein',   value: `${summary.protein} g`     },
            { label: 'Carbs',     value: `${summary.carbs} g`       },
            { label: 'Fat',       value: `${summary.fat} g`         },
          ].map(row => (
            <NutrientRow key={row.label} label={row.label} value={row.value} />
          ))}
        </ViroFlexView>

        {/* ─ EXPANDED VIEW: full <nutrition, measure> pair list ─ */}
        {expanded && (
          <ViroFlexView style={{ marginTop: 0.008 }}>
            {SECTION_ORDER.map(category => {
              const sectionPairs = pairs.filter(p => p.category === category);
              if (!sectionPairs.length) return null;
              return (
                <ViroFlexView key={category} style={{ marginTop: 0.01 }}>
                  {/* Section header */}
                  <ViroText
                    text={SECTION_LABELS[category]}
                    style={{
                      fontFamily: FONT, fontSize: 11,
                      color: COLORS.subheader,
                      fontWeight: 'bold',
                    }}
                    width={PANEL_WIDTH - PADDING * 2}
                    height={0.035}
                  />
                  {/* Nutrient pair rows */}
                  {sectionPairs.map(pair => (
                    <NutrientRow
                      key={pair.nutrient}
                      label={pair.nutrient}
                      value={`${pair.value} ${pair.unit}`}
                      small
                    />
                  ))}
                </ViroFlexView>
              );
            })}
          </ViroFlexView>
        )}

        {/* ─ Toggle button ─ */}
        <ViroBox
          scale={[PANEL_WIDTH - PADDING * 2, 0.002, 0.001]}
          materials={['divider']}
          style={{ marginTop: 0.01 }}
        />
        <ViroText
          text={expanded ? '▲ Show less' : '▼ Show all nutrients'}
          style={{
            fontFamily: FONT, fontSize: 12,
            color: COLORS.blue, textAlign: 'center',
          }}
          width={PANEL_WIDTH - PADDING * 2}
          height={0.04}
          onClick={toggleExpanded}
        />

        {/* ─ Risk badge ─ */}
        <ViroFlexView
          style={{
            marginTop:       0.01,
            backgroundColor: riskLevel === 'danger' ? '#FF444420'
              : riskLevel === 'caution' ? '#FFA50020'
              : '#44CC4420',
            padding: 0.01,
          }}
        >
          <ViroText
            text={`${riskLevel === 'safe' ? '✓' : '⚠'} ${riskMessage}`}
            style={{ fontFamily: FONT, fontSize: 12, color: riskColor, textAlign: 'center' }}
            width={PANEL_WIDTH - PADDING * 4}
            height={0.04}
          />
        </ViroFlexView>
      </ViroFlexView>

      {/* ── Leader line stem pointing down to food ── */}
      <ViroBox
        position={[0, -0.12, 0]}
        scale={[0.004, 0.12, 0.004]}
        materials={[riskMaterial]}
      />
    </ViroNode>
  );
}

// ─── Sub-component: single <nutrient, value> row ──────────────────────────────
function NutrientRow({ label, value, small = false }) {
  const fontSize = small ? 11 : 13;
  return (
    <ViroFlexView
      style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: ROW_GAP }}
    >
      <ViroText
        text={label}
        style={{ fontFamily: FONT, fontSize, color: COLORS.muted }}
        width={0.3}
        height={ROW_HEIGHT}
      />
      <ViroText
        text={value}
        style={{ fontFamily: FONT, fontSize, color: COLORS.white, textAlign: 'right', fontWeight: '500' }}
        width={0.18}
        height={ROW_HEIGHT}
      />
    </ViroFlexView>
  );
}
