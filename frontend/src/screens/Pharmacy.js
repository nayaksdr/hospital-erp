import React, { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { C } from '../theme';
import { Async, Badge, Btn, Card, Chips, Empty, Field, Grid, Header, Row, Sheet, Stack, Stat, T, money, run, today, useLoad } from '../ui';

function QueueCard({ rx, me, reload }) {
  const [mode, setMode] = useState('cash'); const [ref, setRef] = useState('');
  const bad = rx.items.some((i) => !i.enough_stock);
  return (
    <Card>
      <Row left={<><T v="h2">{rx.patient_name} · {rx.uhid}</T><T v="small">Dr. {rx.doctor} · {rx.disease}</T></>} right={<Badge text={`${rx.total_tablets} tablets`} />} />
      {rx.items.map((i) => (
        <Row key={i.item_id} left={<><T v="b">{i.medicine} {i.strength}</T><T v="small">{i.times_per_day}×/day for {i.days} days · {i.tablets} tablets × {money(i.price)}</T></>}
          right={<View style={{ alignItems: 'flex-end' }}><T v="b">{money(i.line_total)}</T>{!i.enough_stock && <Badge tone="danger" text={`only ${i.stock} in stock`} />}</View>} />
      ))}
      <T v="h2">Total {money(rx.total)}</T>
      {me.role !== 'pharmacist' && me.role !== 'admin' ? null : (<>
        <Chips options={[{ value: 'cash', label: 'Paid in cash' }, { value: 'online', label: 'Paid online' }, { value: '', label: 'Pay later' }]} value={mode} onChange={setMode} />
        {mode === 'online' && <Field label="Transaction reference" value={ref} onChangeText={setRef} />}
        <Btn title={bad ? 'Restock to dispense' : 'Dispense medicines'} kind={bad ? 'ghost' : 'primary'}
          onPress={() => !bad && run(() => api(`/pharmacy/dispense/${rx.prescription_id}`, { method: 'POST', body: { mode: mode || null, reference: ref || null } }), reload)} />
      </>)}
    </Card>
  );
}

function Queue({ me }) {
  const s = useLoad(() => api('/pharmacy/queue'));
  return <Async s={s}>{(list) => list.length === 0 ? <Empty text="No prescriptions waiting. New ones appear here as soon as a doctor saves a consultation." /> : list.map((r) => <QueueCard key={r.prescription_id} rx={r} me={me} reload={s.reload} />)}</Async>;
}

function Stock({ me }) {
  const [q, setQ] = useState(''); const [add, setAdd] = useState(false); const [rs, setRs] = useState(null); const [f, setF] = useState({}); const [r, setR] = useState({ mode: 'cash' });
  const s = useLoad(() => api('/pharmacy/medicines?q=' + encodeURIComponent(q)), [q]);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const can = ['admin', 'pharmacist'].includes(me.role);
  return (<Stack>
    <View style={{ flexDirection: 'row', gap: 8 }}><Field style={{ flex: 1 }} value={q} onChangeText={setQ} placeholder="Search medicine" />{can && <Btn small title="Add medicine" onPress={() => setAdd(true)} />}</View>
    <Card><Async s={s}>{(list) => list.map((m) => (
      <Row key={m.id} left={<><T v="b">{m.name} {m.strength}</T><T v="small">{money(m.price)} per tablet · expires {m.expiry_date || '-'}</T></>}
        right={<><Badge text={`${m.stock} in stock`} tone={m.stock <= m.reorder_level ? 'danger' : 'ok'} />{can && <Btn small kind="ghost" title="Restock" onPress={() => setRs(m)} />}</>} />))}</Async></Card>
    <Sheet visible={add} onClose={() => setAdd(false)} title="New medicine">
      <Field label="Name" value={f.name} onChangeText={set('name')} /><Field label="Strength" value={f.strength} onChangeText={set('strength')} />
      <Field label="Price per tablet" value={f.price} onChangeText={set('price')} keyboardType="numeric" /><Field label="Opening stock" value={f.stock} onChangeText={set('stock')} keyboardType="numeric" />
      <Field label="Expiry (YYYY-MM-DD)" value={f.expiry_date} onChangeText={set('expiry_date')} />
      <Btn title="Save medicine" onPress={() => run(() => api('/pharmacy/medicines', { method: 'POST', body: { name: f.name, strength: f.strength, price: Number(f.price || 0), stock: Number(f.stock || 0), expiry_date: f.expiry_date || null } }), () => { setAdd(false); setF({}); s.reload(); })} />
    </Sheet>
    <Sheet visible={!!rs} onClose={() => setRs(null)} title={`Restock ${rs?.name || ''}`}>
      <Field label="Tablets received" value={r.quantity} onChangeText={(v) => setR({ ...r, quantity: v })} keyboardType="numeric" />
      <Field label="Total purchase cost (goes to expenses)" value={r.cost} onChangeText={(v) => setR({ ...r, cost: v })} keyboardType="numeric" />
      <Chips options={['cash', 'online']} value={r.mode} onChange={(v) => setR({ ...r, mode: v })} />
      <Btn title="Add stock" onPress={() => run(() => api(`/pharmacy/medicines/${rs.id}/restock`, { method: 'POST', body: { quantity: Number(r.quantity), total_cost: Number(r.cost || 0), mode: r.mode } }), () => { setRs(null); setR({ mode: 'cash' }); s.reload(); })} />
    </Sheet>
  </Stack>);
}

function Report() {
  const s = useLoad(() => api(`/pharmacy/report?start=${today()}&end=${today()}`));
  return <Async s={s}>{(d) => (<Stack>
    <Grid><Stat label="Tablets dispensed today" value={d.total_tablets} /><Stat label="Received in cash" value={money(d.paid_by_mode.cash)} /><Stat label="Received online" value={money(d.paid_by_mode.online)} /></Grid>
    <Card><T v="h2">By medicine</T>{d.tablets.length === 0 ? <Empty text="Nothing dispensed yet today." /> : d.tablets.map((t) => <Row key={t.medicine} left={<T>{t.medicine}</T>} right={<T v="b">{t.tablets} tablets</T>} />)}</Card>
  </Stack>)}</Async>;
}

export default function Pharmacy({ me }) {
  const [tab, setTab] = useState('queue');
  return (<Stack>
    <Header title="Pharmacy" />
    <Chips options={[{ value: 'queue', label: 'Prescription queue' }, { value: 'stock', label: 'Stock' }, { value: 'report', label: 'Today' }]} value={tab} onChange={setTab} />
    {tab === 'queue' ? <Queue me={me} /> : tab === 'stock' ? <Stock me={me} /> : <Report />}
  </Stack>);
}
