import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Modal, Animated, Dimensions, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { C } from './theme';

const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_W = Math.min(380, Math.round(SCREEN_W * 0.86));
const MAX_TURNS = 8; // history turns passed to respond()

// Generic slide-in chat sidebar. Side ('left'|'right') sets which edge it docks to.
// `respond(question, priorTurns)` returns { text, source } and decides the backend:
//   - right panel → rule-based engine (engine/Assistant.answer), unchanged & offline
//   - left panel  → local Llama 3 (services/LlamaChat), grounded on app data
// `checkAvailable` (optional async) drives the header status dot.
export function ChatPanel({
  visible, onClose, side = 'right', title, accent = C.blue,
  greeting, suggestions = [], respond, checkAvailable, statusReady, statusBusy, statusDown,
}) {
  const GREETING = { from: 'bot', text: greeting };
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(null); // null=unknown/checking
  const hidden = side === 'left' ? -PANEL_W : PANEL_W;
  const slide = useRef(new Animated.Value(hidden)).current;
  const scrollRef = useRef(null);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : hidden,
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (visible && checkAvailable) {
      setReady(null);
      checkAvailable().then(setReady).catch(() => setReady(false));
    }
  }, [visible, slide, hidden, checkAvailable]);

  function historyTurns(list) {
    return list
      .filter(m => m !== messages[0] && m.text)
      .slice(-MAX_TURNS)
      .map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
  }

  async function send(text) {
    const q = (text != null ? text : input).trim();
    if (!q || busy) return;
    setInput('');
    const priorTurns = historyTurns(messages);
    setMessages(prev => [...prev, { from: 'user', text: q }]);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    let out;
    try {
      out = await respond(q, priorTurns);
      if (checkAvailable) setReady(out?.source ? !/unavailable|offline/i.test(out.source) : true);
    } catch (e) {
      out = { text: 'Something went wrong answering that.', source: 'error' };
    }

    setMessages(prev => [...prev, { from: 'bot', text: out.text, source: out.source }]);
    setBusy(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }

  const statusLabel = !checkAvailable ? (statusReady || '')
    : ready === true ? (statusReady || '🟢 ready')
    : ready === false ? (statusDown || '⚪ unavailable')
    : (statusBusy || '… connecting');

  const isLeft = side === 'left';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.backdrop, { flexDirection: isLeft ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={s.backdropTap} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[
          s.panel,
          isLeft ? s.panelLeft : s.panelRight,
          { transform: [{ translateX: slide }] },
        ]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.header}>
              <View>
                <Text style={[s.title, { color: accent }]}>{title}</Text>
                {statusLabel ? <Text style={s.subtitle}>{statusLabel}</Text> : null}
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={s.close}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 12 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((m, i) => (
                <View key={i} style={[s.bubbleRow, m.from === 'user' ? s.rowRight : s.rowLeft]}>
                  <View style={[s.bubble, m.from === 'user' ? [s.userBubble, { backgroundColor: accent }] : s.botBubble]}>
                    <Text style={[s.bubbleText, m.from === 'user' && { color: '#fff' }]}>{m.text}</Text>
                    {m.source ? <Text style={s.srcTag}>{m.source}</Text> : null}
                  </View>
                </View>
              ))}
              {busy && (
                <View style={[s.bubbleRow, s.rowLeft]}>
                  <View style={[s.bubble, s.botBubble, { flexDirection: 'row', alignItems: 'center' }]}>
                    <ActivityIndicator size="small" color={accent} />
                    <Text style={[s.bubbleText, { marginLeft: 8, color: C.textDim }]}>thinking…</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
              {suggestions.map((sug) => (
                <TouchableOpacity key={sug} style={s.chip} onPress={() => send(sug)} disabled={busy}>
                  <Text style={s.chipText}>{sug}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.inputRow}>
              <TextInput
                style={s.input} value={input} onChangeText={setInput}
                placeholder="Ask about your diet…" placeholderTextColor={C.textFaint}
                returnKeyType="send" editable={!busy} onSubmitEditing={() => send()}
              />
              <TouchableOpacity style={[s.sendBtn, { backgroundColor: accent }, busy && { opacity: 0.5 }]} onPress={() => send()} disabled={busy}>
                <Text style={s.sendText}>➤</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTap: { flex: 1 },
  panel:       { width: PANEL_W, backgroundColor: C.bg, paddingTop: 44, paddingHorizontal: 14, paddingBottom: 10 },
  panelRight:  { borderLeftWidth: 1, borderColor: C.line },
  panelLeft:   { borderRightWidth: 1, borderColor: C.line },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderColor: C.line },
  title:    { fontSize: 17, fontWeight: '800' },
  subtitle: { color: C.textDim, fontSize: 11, marginTop: 2, fontWeight: '600' },
  close:    { color: C.textDim, fontSize: 20 },

  bubbleRow:  { width: '100%', marginBottom: 8 },
  rowLeft:    { alignItems: 'flex-start' },
  rowRight:   { alignItems: 'flex-end' },
  bubble:     { maxWidth: '88%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  botBubble:  { backgroundColor: C.surface, borderTopLeftRadius: 4 },
  userBubble: { borderTopRightRadius: 4 },
  bubbleText: { color: C.text, fontSize: 14, lineHeight: 20 },
  srcTag:     { color: C.textFaint, fontSize: 10, marginTop: 5, fontStyle: 'italic' },

  chips:    { paddingVertical: 8 },
  chip:     { backgroundColor: C.surface2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  chipText: { color: C.textDim, fontSize: 12, fontWeight: '600' },

  inputRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 6 },
  input:    { flex: 1, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: C.text, fontSize: 14, borderWidth: 1, borderColor: C.line },
  sendBtn:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sendText: { color: '#fff', fontSize: 16 },
});
