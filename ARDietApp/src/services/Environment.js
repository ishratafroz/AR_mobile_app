// Environment & location context (Goal 2/3 — diet decisions in real-world context).
//
// Given the user's ZIP code we resolve a location and pull:
//   • current WEATHER + temperature  (Open-Meteo forecast API)
//   • AIR QUALITY  (US AQI, PM2.5, PM10, ozone — Open-Meteo air-quality API)
//   • a WATER-SAFETY advisory for the area  (heuristic + EWG Tap Water deep link)
//
// All three are FREE and need no API key, so nothing about the user's account is
// sent to a paid service. We send only the ZIP/coords to the public weather APIs.
//
// ZIP geocoding uses Zippopotam.us (free, US/■). GPS is intentionally NOT used —
// it needs a native module + rebuild; the user told us "zip code matters", and a
// ZIP is enough to resolve weather/air/water for the area.

const GEO_URL  = (zip, country = 'us') => `https://api.zippopotam.us/${country}/${encodeURIComponent(zip)}`;
const WX_URL   = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
  `&temperature_unit=fahrenheit&wind_speed_unit=mph`;
const AQ_URL   = (lat, lon) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
  `&current=us_aqi,pm2_5,pm10,ozone`;

// EWG Tap Water Database — the user can open their ZIP's real contaminant report.
export const ewgWaterUrl = (zip) => `https://www.ewg.org/tapwater/search-results.php?zip5=${encodeURIComponent(zip)}`;

// WMO weather-code → short description + emoji.
const WX = {
  0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫'], 48: ['Rime fog', '🌫'],
  51: ['Light drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy drizzle', '🌧'],
  61: ['Light rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy rain', '🌧'],
  71: ['Light snow', '🌨'], 73: ['Snow', '🌨'], 75: ['Heavy snow', '❄️'],
  80: ['Rain showers', '🌦'], 81: ['Rain showers', '🌧'], 82: ['Violent showers', '⛈'],
  95: ['Thunderstorm', '⛈'], 96: ['Thunderstorm + hail', '⛈'], 99: ['Severe storm', '⛈'],
};

export function aqiCategory(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50)  return { label: 'Good',          tone: 'good', color: '#36D399' };
  if (aqi <= 100) return { label: 'Moderate',      tone: 'ok',   color: '#FBBD23' };
  if (aqi <= 150) return { label: 'Unhealthy (sensitive)', tone: 'low', color: '#FB923C' };
  if (aqi <= 200) return { label: 'Unhealthy',     tone: 'poor', color: '#F8617A' };
  if (aqi <= 300) return { label: 'Very unhealthy',tone: 'poor', color: '#A78BFA' };
  return { label: 'Hazardous', tone: 'poor', color: '#E11D48' };
}

// Indicative tap-water advisory. There is no free, no-key nationwide real-time
// contamination feed, so this is a HEURISTIC (clearly labelled): elevated local
// particulate pollution often co-occurs with watershed stress, so we nudge the
// user to the EWG report for their ZIP, which carries the real measured data.
export function waterAdvisory(zip, aqi) {
  const high = aqi != null && aqi > 100;
  return {
    indicative: true,
    level: high ? 'check' : 'ok',
    note: high
      ? 'Local air pollution is elevated, which can correlate with watershed contamination. Check your ZIP’s measured tap-water report before relying on tap water.'
      : 'No elevated environmental pollution detected for your area. Still, review your ZIP’s measured tap-water report for any local contaminants.',
    url: zip ? ewgWaterUrl(zip) : null,
  };
}

let _cache = null; // { zip, ts, data }
const TTL = 15 * 60 * 1000; // 15 min

async function jget(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Resolve a ZIP into a full environment snapshot. Returns null on any failure
 * (offline / bad ZIP) so callers can degrade gracefully.
 * Shape:
 *   { zip, place, state, lat, lon, tempF, feelsF, humidity, wind, weather, weatherIcon,
 *     aqi, aqiCat, pm25, pm10, ozone, water }
 */
export async function getEnvironment(zip, { force = false } = {}) {
  const z = String(zip || '').trim();
  if (!z) return null;
  if (!force && _cache && _cache.zip === z && Date.now() - _cache.ts < TTL) return _cache.data;

  try {
    const geo = await jget(GEO_URL(z));
    const place = geo?.places?.[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lon = parseFloat(place.longitude);

    // Weather + air quality in parallel; tolerate either failing.
    const [wx, aq] = await Promise.all([
      jget(WX_URL(lat, lon)).catch(() => null),
      jget(AQ_URL(lat, lon)).catch(() => null),
    ]);

    const code = wx?.current?.weather_code;
    const [wdesc, wicon] = WX[code] || ['—', '🌡'];
    const aqi = aq?.current?.us_aqi != null ? Math.round(aq.current.us_aqi) : null;

    const data = {
      zip: z,
      place: place['place name'] || null,
      state: place['state abbreviation'] || place.state || null,
      lat, lon,
      tempF: wx?.current?.temperature_2m != null ? Math.round(wx.current.temperature_2m) : null,
      feelsF: wx?.current?.apparent_temperature != null ? Math.round(wx.current.apparent_temperature) : null,
      humidity: wx?.current?.relative_humidity_2m ?? null,
      wind: wx?.current?.wind_speed_10m != null ? Math.round(wx.current.wind_speed_10m) : null,
      weather: wdesc,
      weatherIcon: wicon,
      aqi,
      aqiCat: aqiCategory(aqi),
      pm25: aq?.current?.pm2_5 != null ? Math.round(aq.current.pm2_5) : null,
      pm10: aq?.current?.pm10 != null ? Math.round(aq.current.pm10) : null,
      ozone: aq?.current?.ozone != null ? Math.round(aq.current.ozone) : null,
      water: waterAdvisory(z, aqi),
    };
    _cache = { zip: z, ts: Date.now(), data };
    return data;
  } catch (_) {
    return null;
  }
}

// Auto-detect the device's approximate location WITHOUT a native GPS module
// (which would force an Android rebuild on this RN 0.72 setup). We resolve the
// phone's public IP to a city-level location — good enough for ZIP-area weather,
// air quality and the water advisory. Two free, no-key providers, tried in order.
// Returns { zip, city, region, country, lat, lon } or null.
export async function detectDeviceLocation() {
  // Provider 1: ipwho.is (free, no key, returns `postal`).
  try {
    const d = await jget('https://ipwho.is/');
    if (d && d.success !== false) {
      const zip = String(d.postal || '').replace(/[^0-9]/g, '').slice(0, 5);
      return {
        zip: zip || null,
        city: d.city || null,
        region: d.region || null,
        country: d.country_code || null,
        lat: d.latitude ?? null,
        lon: d.longitude ?? null,
      };
    }
  } catch (_) {}

  // Provider 2: ipapi.co fallback.
  try {
    const d = await jget('https://ipapi.co/json/');
    if (d && !d.error) {
      const zip = String(d.postal || '').replace(/[^0-9]/g, '').slice(0, 5);
      return {
        zip: zip || null,
        city: d.city || null,
        region: d.region || null,
        country: d.country_code || null,
        lat: d.latitude ?? null,
        lon: d.longitude ?? null,
      };
    }
  } catch (_) {}

  return null;
}

// A short, health-conscious note that ties the food decision to the current
// environment (hot day → hydration/lighter meals; poor air → antioxidant foods).
export function environmentFoodNote(env, nutrition) {
  if (!env) return null;
  const parts = [];

  if (env.tempF != null && env.tempF >= 90) {
    parts.push(`It’s ${env.tempF}°F near ${env.place || 'you'} — hydrate and favour lighter, water-rich foods.`);
    if (nutrition && nutrition.sodium >= 500) parts.push('This salty item will increase thirst in the heat.');
  } else if (env.tempF != null && env.tempF <= 40) {
    parts.push(`It’s a cold ${env.tempF}°F — warm, protein-rich meals help.`);
  }

  if (env.aqiCat && (env.aqiCat.tone === 'poor' || env.aqiCat.tone === 'low')) {
    parts.push(`Air quality is "${env.aqiCat.label}" (AQI ${env.aqi}) — antioxidant-rich foods (fruit, leafy greens) help counter pollution stress; limit outdoor exertion.`);
  }

  if (env.water && env.water.level === 'check') {
    parts.push('Local water advisory: verify tap-water safety for your ZIP (see Environment panel).');
  }
  return parts.length ? parts.join(' ') : null;
}
