// ─────────────────────────────────────────────────────────────────────────────
// FoodAlternatives.js  –  Goal 2
// Maps risk flag types to healthier food alternative suggestions.
// Displayed in the AR panel when a food item is flagged as risky.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FOOD_ALTERNATIVES
 * Keys match the `type` field on RiskEngine FoodFlag objects.
 * Each entry is an Alternative:
 *   { name, reason, improvementPct }
 */
export const FOOD_ALTERNATIVES = {

  saturatedFat: [
    { name: 'Grilled chicken breast', reason: 'Removes skin — 70% less sat. fat',        improvementPct: 70 },
    { name: 'Baked salmon',           reason: 'Omega-3 rich, low saturated fat',          improvementPct: 55 },
    { name: 'Turkey breast',          reason: 'Lean white meat, 65% less sat. fat',       improvementPct: 65 },
    { name: 'Tofu stir-fry',          reason: 'Plant protein, almost zero sat. fat',      improvementPct: 90 },
    { name: 'Egg whites',             reason: 'High protein, negligible sat. fat',        improvementPct: 80 },
  ],

  sodium: [
    { name: 'Herbs and spices',       reason: 'Replace salt with flavour, 100% less Na', improvementPct: 100 },
    { name: 'Fresh salad (no dressing)', reason: 'Naturally low sodium',                  improvementPct: 85 },
    { name: 'Homemade grilled veg',   reason: 'No added salt — full flavour',             improvementPct: 90 },
    { name: 'Brown rice (plain)',     reason: 'Unsalted, high fibre, low Na',             improvementPct: 80 },
  ],

  sugar: [
    { name: 'Mixed berries',          reason: 'Natural sugar, high antioxidants, low GI', improvementPct: 60 },
    { name: 'Greek yogurt (plain)',   reason: 'No added sugar, high protein',             improvementPct: 70 },
    { name: 'Apple slices',           reason: 'Fructose + fibre = lower glycaemic spike', improvementPct: 55 },
    { name: 'Dark chocolate (>70%)',  reason: 'Lower sugar, rich in magnesium',           improvementPct: 45 },
  ],

  refinedCarbs: [
    { name: 'Brown rice',             reason: 'Whole grain — slower glucose release',     improvementPct: 40 },
    { name: 'Quinoa',                 reason: 'Complete protein, low glycaemic index',    improvementPct: 50 },
    { name: 'Sweet potato',           reason: 'High fibre, vitamins, moderate GI',        improvementPct: 35 },
    { name: 'Lentils',                reason: 'High fibre + protein, very low GI',        improvementPct: 60 },
    { name: 'Oats',                   reason: 'Beta-glucan fibre lowers blood glucose',   improvementPct: 45 },
  ],

  generalRisk: [
    { name: 'Mixed green salad',      reason: 'Low calorie, high micronutrients',         improvementPct: 75 },
    { name: 'Steamed vegetables',     reason: 'Low fat, high fibre and vitamins',         improvementPct: 80 },
    { name: 'Grilled fish',           reason: 'Lean protein, heart-healthy omega-3',      improvementPct: 65 },
  ],
};

/**
 * getAlternativesForFoodItem
 * Returns a list of suggested alternatives for a specific food label
 * based on its detected risk flags.
 *
 * @param {string}   foodLabel  – e.g. "beef burger"
 * @param {string[]} flagTypes  – e.g. ["saturatedFat", "sodium"]
 * @param {number}   maxResults
 * @returns {Alternative[]}
 */
export function getAlternativesForFoodItem(foodLabel, flagTypes = [], maxResults = 3) {
  if (!flagTypes.length) return [];

  const seen = new Set();
  const results = [];

  for (const type of flagTypes) {
    const list = FOOD_ALTERNATIVES[type] ?? [];
    for (const alt of list) {
      if (!seen.has(alt.name) && alt.name.toLowerCase() !== foodLabel.toLowerCase()) {
        seen.add(alt.name);
        results.push({ ...alt, flagType: type });
        if (results.length >= maxResults) return results;
      }
    }
  }

  return results;
}

/**
 * AlternativeSuggestionPanel (AR component)
 * Renders a compact "Try instead:" panel in AR space below the risk badge.
 * Imported by NutritionPanel when riskLevel is 'caution' or 'danger'.
 */
import React from 'react';
import { ViroFlexView, ViroText } from '@reactvision/react-viro';

export function AlternativeSuggestionPanel({ alternatives, panelWidth = 0.52 }) {
  if (!alternatives?.length) return null;

  return (
    <ViroFlexView
      style={{
        flexDirection:   'column',
        width:            panelWidth,
        backgroundColor: '#001A0E',
        padding:          0.014,
        marginTop:        0.008,
      }}
    >
      <ViroText
        text="Try instead:"
        style={{ fontFamily: 'Arial', fontSize: 12, color: '#44CC44',
                 fontWeight: 'bold' }}
        width={panelWidth - 0.03}
        height={0.036}
      />
      {alternatives.slice(0, 3).map((alt, i) => (
        <ViroFlexView key={i}
          style={{ flexDirection: 'column', marginTop: 0.007,
                   borderLeftWidth: 0.003, borderLeftColor: '#44CC4466',
                   paddingLeft: 0.01 }}
        >
          <ViroText
            text={`• ${alt.name}`}
            style={{ fontFamily: 'Arial', fontSize: 12, color: '#DDFFDD',
                     fontWeight: '500' }}
            width={panelWidth - 0.06}
            height={0.036}
          />
          <ViroText
            text={alt.reason}
            style={{ fontFamily: 'Arial', fontSize: 10, color: '#88AA88' }}
            width={panelWidth - 0.06}
            height={0.030}
          />
        </ViroFlexView>
      ))}
    </ViroFlexView>
  );
}
