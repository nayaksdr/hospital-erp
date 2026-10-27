import React, { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { C } from '../theme';
import { Async, Badge, Btn, Card, Chips, Empty, Field, Header, Row, Sheet, Stack, Step, T, notify, run, statusTone, today, useLoad } from '../ui';

function ConsultForm({ appt, close, done }) {
  const [disease, setDisease] = useState(''); const [notes, setNotes] = useState(''); const [follow, setFollow] = useState('');
  const [meds, setMeds] = useState([]); const [labs, setLabs] = useState([]); const [q, setQ] = useState('');
  const diseases = useLoad(() => api('/consultations/diseases'));
  const tests = useLoad(() => api('/lab/tests'));
  const found = useLoad(() => (q.length >= 2 ? api('/pharmacy/medicines?q=' + encodeURIComponent(q)) : Promise.resolve([])), [q]);
  const pick = async (d) => { // choosing a disease auto-fills its usual medicines (editable)
    setDisease(d);
    try { const t = await api('/consultations/templates?disease=' + encodeURIComponent(d)); setMeds(t.map((x) => ({ medicine_id: x.medicine_id, name: `${x.name} ${x.strength || ''}`, times_per_day: x.times_per_day, days: x.days }))); } catch (e) { notify(e.message); }
  };
  const upd = (i, k, v) => setMeds(meds.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const save = () => run(() => api('/consultations', { method: 'POST', body: {
    appointment_id: appt.id, disease, notes, follow_up_date: follow || null, lab_test_ids: labs,
    medicines: meds.map(({ medicine_id, times_per_day, days }) => ({ medicine_id, times_per_day, days })) } }), done);
  return (
    <Sheet visible onClose={close} title={`Consultation · ${appt.patient_name}`}>
      <T v="small">Diagnosis (tap a common one or type)</T>
      <Chips options={diseases.data || []} value={disease} onChange={pick} />
      <Field value={disease} onChangeText={setDisease} placeholder="Disease / diagnosis" />
      <T v="h2">Medicines {meds.length ? `· ${meds.reduce((a, m) => a + m.times_per_day * m.days, 0)} tablets total` : ''}</T>
      {meds.map((m, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8 }}>
          <View style={{ flex: 1 }}><T v="b">{m.name}</T><T v="small">{m.times_per_day * m.days} tablets</T></View>
          <Step label="per day" value={m.times_per_day} onChange={(v) => upd(i, 'times_per_day', v)} />
          <Step label="days" value={m.days} onChange={(v) => upd(i, 'days', v)} />
          <Btn small kind="ghost" title="✕" onPress={() => setMeds(meds.filter((_, j) => j !== i))} />
        </View>))}
      <Field label="Add another medicine" value={q} onChangeText={setQ} placeholder="Search medicine" />
      {(found.data || []).slice(0, 5).map((m) => <Row key={m.id} onPress={() => { setMeds([...meds, { medicine_id: m.id, name: `${m.name} ${m.strength || ''}`, times_per_day: 1, days: 3 }]); setQ(''); }} left={<T>{m.name} {m.strength} · stock {m.stock}</T>} />)}
      <T v="h2">Lab tests</T>
      <Chips multi options={(tests.data || []).map((t) => ({ value: t.id, label: t.name }))} value={labs} onChange={setLabs} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Field label="Follow-up date (YYYY-MM-DD)" value={follow} onChangeText={setFollow} />
      <Btn title="Save and send to pharmacy" onPress={save} />
    </Sheet>
  );
}

export default function Consult({ me }) {
  const s = useLoad(() => api('/appointments?date=' + today())); const [sel, setSel] = useState(null);
  return (
    <Stack>
      <Header title="My patients today" right={<Btn small kind="ghost" title="Refresh" onPress={s.reload} />} />
      <Card><Async s={s}>{(list) => list.length === 0 ? <Empty text="No appointments today." /> : list.map((a) => (
        <Row key={a.id} left={<><T v="b">Token {a.token} · {a.patient_name}</T><T v="small">{a.uhid}{a.reason ? ' · ' + a.reason : ''}</T></>}
          right={<>{<Badge text={a.status} tone={statusTone(a.status)} />}{['booked', 'checked_in'].includes(a.status) && <Btn small title="Consult" onPress={() => setSel(a)} />}</>} />
      ))}</Async></Card>
      {sel && <ConsultForm appt={sel} close={() => setSel(null)} done={() => { setSel(null); s.reload(); }} />}
    </Stack>
  );
}
