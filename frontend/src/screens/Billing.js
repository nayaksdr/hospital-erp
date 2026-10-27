import React, { useState } from 'react';
import { api } from '../api';
import { Async, Badge, Btn, Card, Chips, Empty, Field, Header, Row, Sheet, Stack, T, money, run, statusTone, useLoad } from '../ui';

export default function Billing({ me }) {
  const [status, setStatus] = useState('unpaid'); const [sel, setSel] = useState(null);
  const [pay, setPay] = useState({ mode: 'cash' }); const [item, setItem] = useState({}); const [disc, setDisc] = useState('');
  const s = useLoad(() => api('/billing/invoices' + (status ? '?status=' + status : '')), [status]);
  const refresh = (inv) => { setSel(inv); s.reload(); };
  const canDisc = ['admin', 'accountant'].includes(me.role);
  const canItem = ['admin', 'receptionist', 'nurse', 'accountant'].includes(me.role);
  return (<Stack>
    <Header title="Billing" />
    <Chips options={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Part paid' }, { value: 'paid', label: 'Paid' }, { value: '', label: 'All' }]} value={status} onChange={setStatus} />
    <Card><Async s={s}>{(list) => list.length === 0 ? <Empty text="No invoices here." /> : list.map((i) => (
      <Row key={i.id} onPress={() => setSel(i)} left={<><T v="b">#{i.id} · {i.patient_name}</T><T v="small">{i.created_at.slice(0, 10)} · {i.items.length} items</T></>}
        right={<><T v="b">{money(i.total)}</T><Badge text={i.status === 'unpaid' || i.status === 'partial' ? `${i.status} · due ${money(i.due)}` : i.status} tone={statusTone(i.status)} /></>} />
    ))}</Async></Card>
    <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel ? `Invoice #${sel.id} · ${sel.patient_name}` : ''}>
      {sel && (<>
        {sel.items.map((it) => <Row key={it.id} left={<T>{it.description}</T>} right={<T v="b">{money(it.amount)}</T>} />)}
        {sel.discount ? <Row left={<T>Discount</T>} right={<T v="b">−{money(sel.discount)}</T>} /> : null}
        <Row left={<T v="h2">Total</T>} right={<T v="h2">{money(sel.total)}</T>} />
        {sel.payments.map((p) => <Row key={p.id} left={<T v="small">Paid by {p.mode}{p.reference ? ` (${p.reference})` : ''} · {p.paid_at.slice(0, 16).replace('T', ' ')}</T>} right={<T v="b">{money(p.amount)}</T>} />)}
        <T v="h2" style={{ color: sel.due ? '#C9432F' : '#1F8A5B' }}>Balance due {money(sel.due)}</T>
        {sel.due > 0 && (<>
          <Field label="Amount received" value={pay.amount ?? String(sel.due)} onChangeText={(v) => setPay({ ...pay, amount: v })} keyboardType="numeric" />
          <Chips options={['cash', 'online']} value={pay.mode} onChange={(v) => setPay({ ...pay, mode: v })} />
          {pay.mode === 'online' && <Field label="Transaction reference" value={pay.reference} onChangeText={(v) => setPay({ ...pay, reference: v })} />}
          <Btn title="Record payment" onPress={() => run(async () => refresh(await api(`/billing/invoices/${sel.id}/payments`, { method: 'POST', body: { amount: Number(pay.amount ?? sel.due), mode: pay.mode, reference: pay.reference || null } })), () => setPay({ mode: 'cash' }))} />
        </>)}
        {canItem && (<>
          <T v="h2">Add a charge (room, procedure…)</T>
          <Field label="Description" value={item.description} onChangeText={(v) => setItem({ ...item, description: v })} />
          <Field label="Amount" value={item.amount} onChangeText={(v) => setItem({ ...item, amount: v })} keyboardType="numeric" />
          <Btn kind="ghost" title="Add charge" onPress={() => run(async () => refresh(await api(`/billing/invoices/${sel.id}/items`, { method: 'POST', body: { category: 'other', description: item.description, amount: Number(item.amount) } })), () => setItem({}))} />
        </>)}
        {canDisc && (<>
          <Field label="Discount amount" value={disc} onChangeText={setDisc} keyboardType="numeric" />
          <Btn kind="ghost" title="Apply discount" onPress={() => run(async () => refresh(await api(`/billing/invoices/${sel.id}/discount`, { method: 'POST', body: { discount: Number(disc || 0) } })))} />
        </>)}
      </>)}
    </Sheet>
  </Stack>);
}
