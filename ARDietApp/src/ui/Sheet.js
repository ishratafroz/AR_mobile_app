import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { C } from './theme';

// Bottom-sheet modal shell shared by all panels.
export function Sheet({ visible, onClose, title, subtitle, accent = C.blue, children, maxHeight = '88%' }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.bg}>
        <View style={[s.card, { maxHeight }]}>
          <View style={s.grabber} />
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: accent }]}>{title}</Text>
              {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card:     { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10, borderTopWidth: 1, borderColor: C.line },
  grabber:  { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 },
  header:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  title:    { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { color: C.textDim, fontSize: 12, marginTop: 2 },
  close:    { color: C.textDim, fontSize: 20, paddingHorizontal: 6 },
});
