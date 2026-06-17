import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { C } from './theme';

// Circular progress ring (SVG). progress is 0..1 (clamped, but can exceed visually capped at 1).
export function Ring({ size = 96, stroke = 10, progress = 0, color = C.blue, track = '#FFFFFF1A', children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - p)}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

// Small labeled macro ring (protein/carbs/fat).
export function MacroRing({ label, grams, goalGrams, color, size = 72 }) {
  const progress = goalGrams ? grams / goalGrams : 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <Ring size={size} stroke={7} progress={progress} color={color}>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>{Math.round(grams)}g</Text>
      </Ring>
      <Text style={{ color: C.textDim, fontSize: 11, marginTop: 4, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// Horizontal macro bar with label + value.
export function MacroBar({ label, value, max, color, unit = 'g' }) {
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: C.textDim, fontSize: 12, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>
          {Math.round(value)}{unit}{max ? <Text style={{ color: C.textFaint }}>{`  / ${Math.round(max)}${unit}`}</Text> : null}
        </Text>
      </View>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: '#FFFFFF14', overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}
