import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, TextInput } from 'react-native';
import { Sheet } from './Sheet';
import { C } from './theme';
import { getEnvironment, detectDeviceLocation, ewgWaterUrl } from '../services/Environment';

// Goal 2/3 — local environment context for health-conscious eating.
// Resolves the user's ZIP into weather + air quality + a tap-water advisory, and
// offers a "find this food nearby" Maps link. All from free, no-key public APIs.
export function EnvironmentPanel({ visible, onClose, user, food, onSaveZip }) {
  const [env, setEnv] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [zip, setZip] = useState(user?.zip || '');

  useEffect(() => {
    if (!visible) return;
    setZip(user?.zip || '');
    if (user?.zip) load(user.zip);
    else detect();           // no ZIP yet → auto-detect from the device location
  }, [visible]); // eslint-disable-line

  async function load(z, force = false) {
    if (!z) return;
    setLoading(true);
    try { setEnv(await getEnvironment(z, { force })); } finally { setLoading(false); }
  }

  // Auto-detect the device's ZIP (IP-based, city-level) and save it.
  async function detect() {
    setDetecting(true);
    try {
      const loc = await detectDeviceLocation();
      if (loc?.zip) {
        setZip(loc.zip);
        if (onSaveZip) onSaveZip(loc.zip);
        await load(loc.zip, true);
      }
    } finally { setDetecting(false); }
  }

  function applyZip() {
    const z = String(zip || '').replace(/[^0-9]/g, '').slice(0, 5);
    if (onSaveZip) onSaveZip(z);
    load(z, true);
  }

  // "Where can I get this nearby" — opens Maps searching the food around the
  // user's resolved place / ZIP. No Places API key needed.
  function findNearby() {
    const name = food?.queryName || food?.name;
    if (!name) return;
    const where = env?.place ? `${env.place} ${env.state || ''}` : (user?.zip || '');
    const query = encodeURIComponent(`${name} restaurant near ${where}`.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {});
  }

  const aqiCat = env?.aqiCat;

  return (
    <Sheet visible={visible} onClose={onClose} title="Environment & Location" accent={C.teal}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* ZIP input */}
        <Text style={s.lbl}>ZIP code</Text>
        <View style={s.zipRow}>
          <TextInput
            style={s.zipInput} value={String(zip)}
            onChangeText={(t) => setZip(t.replace(/[^0-9]/g, '').slice(0, 5))}
            keyboardType="number-pad" placeholder="e.g. 76203" placeholderTextColor={C.textFaint}
          />
          <TouchableOpacity style={s.zipBtn} onPress={applyZip} activeOpacity={0.85}>
            <Text style={s.zipBtnText}>{loading ? '…' : 'Update'}</Text>
          </TouchableOpacity>
        </View>

        {/* Auto-detect location from the device (IP-based, no GPS rebuild needed) */}
        <TouchableOpacity style={s.detectBtn} onPress={detect} disabled={detecting} activeOpacity={0.85}>
          {detecting
            ? <ActivityIndicator color={C.teal} />
            : <Text style={s.detectText}>📍 Detect my location automatically</Text>}
        </TouchableOpacity>

        {!user?.zip && !env && !detecting && (
          <Text style={s.empty}>Enter your ZIP — or tap “Detect my location” — to see local weather, air quality and a tap-water advisory.</Text>
        )}

        {loading && !env && <ActivityIndicator color={C.teal} style={{ marginTop: 18 }} />}

        {env && (
          <>
            <Text style={s.place}>📍 {env.place || '—'}{env.state ? `, ${env.state}` : ''} · {env.zip}</Text>

            {/* weather */}
            <Text style={s.section}>Weather</Text>
            <View style={s.grid}>
              <Tile icon={env.weatherIcon} value={env.tempF != null ? `${env.tempF}°F` : '—'} label={env.weather} />
              <Tile icon="🌡" value={env.feelsF != null ? `${env.feelsF}°F` : '—'} label="Feels like" />
              <Tile icon="💧" value={env.humidity != null ? `${env.humidity}%` : '—'} label="Humidity" />
              <Tile icon="💨" value={env.wind != null ? `${env.wind} mph` : '—'} label="Wind" />
            </View>

            {/* air quality */}
            <Text style={s.section}>Air quality</Text>
            <View style={[s.aqiBox, aqiCat && { borderColor: aqiCat.color, backgroundColor: aqiCat.color + '14' }]}>
              <Text style={[s.aqiVal, aqiCat && { color: aqiCat.color }]}>{env.aqi ?? '—'}</Text>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[s.aqiLabel, aqiCat && { color: aqiCat.color }]}>{aqiCat?.label || 'US AQI'}</Text>
                <Text style={s.aqiSub}>PM2.5 {env.pm25 ?? '—'} · PM10 {env.pm10 ?? '—'} · O₃ {env.ozone ?? '—'}</Text>
              </View>
            </View>

            {/* water advisory */}
            <Text style={s.section}>Water safety</Text>
            <View style={[s.waterBox, env.water?.level === 'check' && { borderColor: C.amber }]}>
              <Text style={s.waterNote}>{env.water?.note}</Text>
              {env.water?.url && (
                <TouchableOpacity onPress={() => Linking.openURL(env.water.url).catch(() => {})} activeOpacity={0.85}>
                  <Text style={s.link}>Open tap-water report for {env.zip} ↗</Text>
                </TouchableOpacity>
              )}
              <Text style={s.indicative}>Indicative advisory — confirm with your local water utility.</Text>
            </View>

            {/* find nearby */}
            {food && (food.queryName || food.name) && (
              <TouchableOpacity style={s.nearbyBtn} onPress={findNearby} activeOpacity={0.85}>
                <Text style={s.nearbyText}>🍴 Find “{food.queryName || food.name}” near {env.place || 'you'} ↗</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.refresh} onPress={() => load(env.zip, true)} activeOpacity={0.85}>
              <Text style={s.refreshText}>↻ Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function Tile({ icon, value, label }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileIcon}>{icon}</Text>
      <Text style={s.tileVal}>{value}</Text>
      <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  lbl:     { color: C.textDim, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  zipRow:  { flexDirection: 'row', alignItems: 'center' },
  zipInput:{ flex: 1, backgroundColor: C.surface2, color: C.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, borderWidth: 1, borderColor: C.line },
  zipBtn:  { marginLeft: 10, backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  zipBtnText:{ color: '#06281f', fontSize: 14, fontWeight: '900' },
  detectBtn: { borderWidth: 1, borderColor: C.teal, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10, backgroundColor: C.teal + '14' },
  detectText:{ color: C.teal, fontSize: 14, fontWeight: '800' },
  empty:   { color: C.textFaint, fontSize: 13, fontStyle: 'italic', marginTop: 14 },
  place:   { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 16 },
  section: { color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile:    { width: '48%', backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  tileIcon:{ fontSize: 20, marginBottom: 6 },
  tileVal: { color: C.text, fontSize: 18, fontWeight: '800' },
  tileLabel:{ color: C.textDim, fontSize: 12, marginTop: 2 },
  aqiBox:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, backgroundColor: C.surface },
  aqiVal:  { color: C.text, fontSize: 34, fontWeight: '900' },
  aqiLabel:{ color: C.text, fontSize: 15, fontWeight: '800' },
  aqiSub:  { color: C.textDim, fontSize: 12, marginTop: 3 },
  waterBox:{ borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, backgroundColor: C.surface },
  waterNote:{ color: C.textDim, fontSize: 13, lineHeight: 19 },
  link:    { color: C.teal, fontSize: 13, fontWeight: '700', marginTop: 10 },
  indicative:{ color: C.textFaint, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  nearbyBtn:{ borderWidth: 1, borderColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18, backgroundColor: C.blue + '14' },
  nearbyText:{ color: C.blue, fontSize: 14, fontWeight: '800' },
  refresh: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  refreshText:{ color: C.textDim, fontSize: 14, fontWeight: '700' },
});
