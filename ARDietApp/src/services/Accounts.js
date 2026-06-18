// Local, on-device accounts — NO server, so health data never leaves the phone
// (consistent with the app's privacy-first design and Goal 3 human-subjects use).
//
// Each account = { username, pass, user } where `user` is the health profile and
// `pass` is a lightly-hashed password. NOTE: this hash is obfuscation for a local
// research prototype, NOT real credential security — there is no backend to
// protect against, and the data is already only on this device. Do not reuse this
// for anything that leaves the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_USER } from '../ui/HealthIntake';

const ACCOUNTS_KEY = 'ARDIET_ACCOUNTS_V1';
const SESSION_KEY  = 'ARDIET_SESSION_V1';

// Cheap string hash (djb2). Salted only so the stored value isn't the raw
// password. Again: local prototype, not a security boundary.
function hashPass(s) {
  const salt = 'ardiet::';
  let h = 5381;
  const str = salt + String(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function normUser(u) {
  return String(u || '').trim().toLowerCase();
}

async function loadAccounts() {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

async function saveAccounts(map) {
  try { await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map)); } catch (_) {}
}

/** Create an account. Returns { ok, error?, username? }. */
export async function signUp(username, password) {
  const key = normUser(username);
  if (key.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
  if (String(password).length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
  const accounts = await loadAccounts();
  if (accounts[key]) return { ok: false, error: 'That username is already taken.' };
  accounts[key] = {
    username: key,
    pass: hashPass(password),
    user: { ...EMPTY_USER, name: String(username).trim() },
  };
  await saveAccounts(accounts);
  await AsyncStorage.setItem(SESSION_KEY, key);
  return { ok: true, username: key, user: accounts[key].user };
}

/** Verify credentials. Returns { ok, error?, username?, user? }. */
export async function signIn(username, password) {
  const key = normUser(username);
  const accounts = await loadAccounts();
  const acc = accounts[key];
  if (!acc) return { ok: false, error: 'No account with that username.' };
  if (acc.pass !== hashPass(password)) return { ok: false, error: 'Incorrect password.' };
  await AsyncStorage.setItem(SESSION_KEY, key);
  return { ok: true, username: key, user: acc.user };
}

/** Currently-signed-in username, or null. */
export async function getSession() {
  try { return await AsyncStorage.getItem(SESSION_KEY); } catch (_) { return null; }
}

export async function getAccountUser(username) {
  const accounts = await loadAccounts();
  return accounts[normUser(username)]?.user || null;
}

/** Persist an updated health profile for a user. */
export async function updateAccountUser(username, user) {
  const key = normUser(username);
  const accounts = await loadAccounts();
  if (!accounts[key]) return;
  accounts[key].user = user;
  await saveAccounts(accounts);
}

export async function signOut() {
  try { await AsyncStorage.removeItem(SESSION_KEY); } catch (_) {}
}

// Per-user food-log key so each account keeps its own daily log.
export function logKeyFor(username) {
  return `ARDIET_LOG_V1::${normUser(username)}`;
}
