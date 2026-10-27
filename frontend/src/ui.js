import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, ActivityIndicator, Alert, Platform, useWindowDimensions } from 'react-native';
import { C, R } from './theme';
import { api } from './api';

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd();
export const shiftDay = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
export const shiftMonth = (s, n) => { const [y, m] = s.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const notify = (m) => (Platform.OS === 'web' ? window.alert(m) : Alert.alert(m));
export const useWide = () => useWindowDimensions().width >= 900;

export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState(null);
  const run = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setErr(null); } catch (e) { setErr(e.message); }
    setLoading(false);
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, loading, err, reload: run };
}

export const T = ({ v = 'body', style, children, ...p }) => {
  const s = { h1: { fontSize: 24, fontWeight: '700' }, h2: { fontSize: 17, fontWeight: '700' }, body: { fontSize: 15 },
    small: { fontSize: 13, color: C.muted }, b: { fontSize: 15, fontWeight: '600' }, big: { fontSize: 26, fontWeight: '700' } }[v];
  return <Text {...p} style={[{ color: C.ink }, s, style]}>{children}</Text>;
};

export const Card = ({ children, style }) => (
  <View style={[{ backgroundColor: C.card, borderRadius: R.md, padding: 16, borderWidth: 1, borderColor: C.line, gap: 8 }, style]}>{children}</View>
);

export const Btn = ({ title, onPress, kind = 'primary', small, busy, style }) => {
  const bg = { primary: C.primary, ghost: C.tint, danger: C.danger }[kind]; const fg = kind === 'ghost' ? C.primary : '#fff';
  return (
    <Pressable onPress={busy ? undefined : onPress} style={({ pressed }) => [{ backgroundColor: bg, opacity: pressed || busy ? 0.7 : 1, borderRadius: R.sm,
      paddingVertical: small ? 8 : 12, paddingHorizontal: small ? 12 : 18, alignItems: 'center' }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 15 }}>{title}</Text>}
    </Pressable>
  );
};

export const Field = ({ label, style, ...p }) => (
  <View style={[{ gap: 4 }, style]}>
    {label ? <T v="small">{label}</T> : null}
    <TextInput placeholderTextColor="#9AACAA" {...p}
      style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink, backgroundColor: '#fff' }} />
  </View>
);

export const Chips = ({ options, value, onChange, multi }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {options.map((o) => {
      const v = o.value ?? o; const label = o.label ?? o;
      const on = multi ? value.includes(v) : value === v;
      return (
        <Pressable key={String(v)} onPress={() => onChange(multi ? (on ? value.filter((x) => x !== v) : [...value, v]) : v)}
          style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: on ? C.primary : C.line, backgroundColor: on ? C.primary : '#fff' }}>
          <Text style={{ color: on ? '#fff' : C.ink, fontSize: 14, textTransform: 'capitalize' }}>{label}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const Badge = ({ text, tone = 'neutral' }) => {
  const m = { ok: [C.okTint, C.ok], warn: [C.warnTint, C.warn], danger: [C.dangerTint, C.danger], neutral: [C.tint, C.primary] }[tone];
  return <View style={{ backgroundColor: m[0], borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}><Text style={{ color: m[1], fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{String(text).replace('_', ' ')}</Text></View>;
};
export const statusTone = (s) => ({ paid: 'ok', done: 'ok', dispensed: 'ok', consulted: 'ok', present: 'ok', partial: 'warn', checked_in: 'warn', half: 'warn', unpaid: 'danger', cancelled: 'danger', absent: 'danger' }[s] || 'neutral');

export const Stat = ({ label, value, tone, sub }) => (
  <Card style={{ flexGrow: 1, flexBasis: 200, gap: 2 }}>
    <T v="small">{label}</T>
    <T v="big" style={{ color: tone === 'bad' ? C.danger : tone === 'good' ? C.ok : C.ink }}>{value}</T>
    {sub ? <T v="small">{sub}</T> : null}
  </Card>
);

export const Row = ({ left, right, onPress }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
    <View style={{ flex: 1 }}>{left}</View>{right}
  </Pressable>
);

export const Header = ({ title, right }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
    <T v="h1">{title}</T><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{right}</View>
  </View>
);

export const Empty = ({ text }) => <T v="small" style={{ paddingVertical: 12 }}>{text}</T>;
export const Grid = ({ children }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;
export const Stack = ({ children, gap = 14 }) => <View style={{ gap }}>{children}</View>;

export const Async = ({ s, children }) => {
  if (s.loading && !s.data) return <ActivityIndicator color={C.primary} style={{ margin: 24 }} />;
  if (s.err) return <Card style={{ backgroundColor: C.dangerTint }}><T style={{ color: C.danger }}>{s.err}</T><Btn small kind="ghost" title="Try again" onPress={s.reload} /></Card>;
  return children(s.data);
};

export const Sheet = ({ visible, onClose, title, children }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,47,45,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <Pressable style={{ width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 16 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="h2">{title}</T><Pressable onPress={onClose}><T v="b" style={{ color: C.muted }}>Close</T></Pressable></View>
          {children}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
);

export const Step = ({ label, value, onChange, min = 1 }) => (
  <View style={{ alignItems: 'center', gap: 2 }}>
    <T v="small">{label}</T>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))}><T v="h2" style={{ color: C.primary }}>−</T></Pressable>
      <T v="b">{value}</T>
      <Pressable onPress={() => onChange(value + 1)}><T v="h2" style={{ color: C.primary }}>+</T></Pressable>
    </View>
  </View>
);

export const PatientPicker = ({ value, onChange }) => {
  const [q, setQ] = useState('');
  const { data } = useLoad(() => (q.length >= 2 ? api('/patients?limit=6&q=' + encodeURIComponent(q)) : Promise.resolve([])), [q]);
  if (value) return <Row left={<T v="b">{value.name} · {value.uhid}</T>} right={<Btn small kind="ghost" title="Change" onPress={() => onChange(null)} />} />;
  return (
    <View style={{ gap: 6 }}>
      <Field label="Patient (name, phone or UHID)" value={q} onChangeText={setQ} placeholder="Type at least 2 letters" />
      {(data || []).map((p) => <Row key={p.id} onPress={() => onChange(p)} left={<T>{p.name} · {p.uhid} · {p.phone}</T>} />)}
    </View>
  );
};

export const DateNav = ({ value, onChange, month }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Btn small kind="ghost" title="‹" onPress={() => onChange(month ? shiftMonth(value, -1) : shiftDay(value, -1))} />
    <T v="b">{value}</T>
    <Btn small kind="ghost" title="›" onPress={() => onChange(month ? shiftMonth(value, 1) : shiftDay(value, 1))} />
  </View>
);

export const run = async (fn, ok) => { try { await fn(); ok && ok(); } catch (e) { notify(e.message); } };
