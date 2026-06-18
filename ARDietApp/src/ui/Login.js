import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { C } from './theme';
import { signIn, signUp } from '../services/Accounts';

// Full-screen gate shown until a user is signed in. Accounts are stored on-device
// only (see services/Accounts.js) — nothing is sent anywhere.
export function Login({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isSignup = mode === 'signup';

  async function submit() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = isSignup
        ? await signUp(username, password)
        : await signIn(username, password);
      if (!res.ok) { setError(res.error || 'Something went wrong.'); return; }
      onAuthed(res.username, res.user, isSignup);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.center}>
        <Text style={s.logo}>🍎 AR Diet</Text>
        <Text style={s.tagline}>Personalized, private diet monitoring</Text>

        <View style={s.card}>
          <View style={s.tabs}>
            <Tab label="Log in"  active={!isSignup} onPress={() => { setMode('login'); setError(null); }} />
            <Tab label="Sign up" active={isSignup}  onPress={() => { setMode('signup'); setError(null); }} />
          </View>

          <Text style={s.lbl}>Username</Text>
          <TextInput
            style={s.input} value={username} onChangeText={setUsername}
            autoCapitalize="none" autoCorrect={false}
            placeholder="e.g. ishrat" placeholderTextColor={C.textFaint}
          />

          <Text style={s.lbl}>Password</Text>
          <TextInput
            style={s.input} value={password} onChangeText={setPassword}
            secureTextEntry autoCapitalize="none"
            placeholder="at least 4 characters" placeholderTextColor={C.textFaint}
          />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{isSignup ? 'Create account' : 'Log in'}</Text>}
          </TouchableOpacity>

          <Text style={s.note}>
            🔒 Your account and health data are stored only on this phone — never uploaded.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[s.tab, active && s.tabActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo:      { color: C.text, fontSize: 34, fontWeight: '900', textAlign: 'center' },
  tagline:   { color: C.textDim, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  card:      { backgroundColor: C.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.line },
  tabs:      { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 12, padding: 4, marginBottom: 18 },
  tab:       { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: C.blue },
  tabText:   { color: C.textDim, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  lbl:       { color: C.textDim, fontSize: 12, marginBottom: 6, marginTop: 10, fontWeight: '600' },
  input:     { backgroundColor: C.surface2, color: C.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: C.line },
  error:     { color: C.red, fontSize: 13, marginTop: 12, fontWeight: '600' },
  btn:       { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  note:      { color: C.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
