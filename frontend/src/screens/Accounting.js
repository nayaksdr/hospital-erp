import React, { useState } from 'react';
import { api } from '../api';
import { Async, Btn, Card, Chips, DateNav, Empty, Field, Grid, Header, Row, Sheet, Stack, Stat, T, money, notify, run, today, useLoad } from '../ui';

const CATS = ['Rent', 'Electricity', 'Water', 'Doctor Expense', 'Maintenance', 'Medical Supplies', 'Other'];

export default function Accounting() {
  const [month, setMonth] = useState(today().slice(0, 7)); const [add, setAdd] = useState(false); const [f, setF] = useState({ category: 'Electricity', mode: 'cash' });
  const sum = useLoad(() => api('/accounting/summary?month=' + month), [month]);
  const exp = useLoad(() => api('/accounting/expenses?month=' + month), [month]);
  const rec = useLoad(() => api('/accounting/recurring'));
  const docs = useLoad(() => api('/users/doctors'));
  const reload = () => { sum.reload(); exp.reload(); };
  return (<Stack>
    <Header title="Accounts" right={<Btn small title="Add expense" onPress={() => setAdd(true)} />} />
    <DateNav month value={month} onChange={setMonth} />
    <Async s={sum}>{(d) => (<>
      <Grid>
        <Stat label="Income" value={money(d.income.total)} sub={`Cash ${money(d.income.cash)} · Online ${money(d.income.online)}`} />
        <Stat label="Expenses" value={money(d.expenses.total)} />
        <Stat label={d.profit >= 0 ? 'Profit' : 'Loss'} value={money(Math.abs(d.profit))} tone={d.profit >= 0 ? 'good' : 'bad'} />
      </Grid>
      <Grid>
        <Card style={{ flexGrow: 1, flexBasis: 280 }}><T v="h2">Income by source</T>{Object.entries(d.income.by_source).length === 0 ? <Empty text="No income yet." /> : Object.entries(d.income.by_source).map(([k, v]) => <Row key={k} left={<T style={{ textTransform: 'capitalize' }}>{k}</T>} right={<T v="b">{money(v)}</T>} />)}</Card>
        <Card style={{ flexGrow: 1, flexBasis: 280 }}><T v="h2">Expenses by type</T>{Object.entries(d.expenses.by_category).length === 0 ? <Empty text="No expenses yet." /> : Object.entries(d.expenses.by_category).map(([k, v]) => <Row key={k} left={<T>{k}</T>} right={<T v="b">{money(v)}</T>} />)}</Card>
      </Grid></>)}</Async>
    <Card>
      <Row left={<T v="h2">Fixed monthly costs (rent, internet…)</T>} right={<Btn small kind="ghost" title={`Post for ${month}`} onPress={() => run(async () => { const r = await api('/accounting/recurring/generate?month=' + month, { method: 'POST' }); notify(r.created ? `${r.created} fixed costs added.` : 'Already posted for this month.'); }, reload)} />} />
      <Async s={rec}>{(list) => list.map((r) => <Row key={r.id} left={<><T v="b">{r.title}</T><T v="small">{r.category} · due on day {r.day_of_month}</T></>} right={<T v="b">{money(r.amount)}</T>} />)}</Async>
    </Card>
    <Card><T v="h2">Expense entries</T><Async s={exp}>{(list) => list.length === 0 ? <Empty text="No entries this month." /> : list.map((e) => (
      <Row key={e.id} left={<><T v="b">{e.category}</T><T v="small">{e.date} · {e.description || ''} · {e.mode}</T></>} right={<><T v="b">{money(e.amount)}</T><Btn small kind="ghost" title="Delete" onPress={() => run(() => api('/accounting/expenses/' + e.id, { method: 'DELETE' }), reload)} /></>} />))}</Async></Card>
    <Sheet visible={add} onClose={() => setAdd(false)} title="New expense">
      <Chips options={CATS} value={f.category} onChange={(v) => setF({ ...f, category: v })} />
      {f.category === 'Doctor Expense' && <Chips options={(docs.data || []).map((d) => ({ value: d.id, label: d.name }))} value={f.doctor_id} onChange={(v) => setF({ ...f, doctor_id: v })} />}
      <Field label="Amount" value={f.amount} onChangeText={(v) => setF({ ...f, amount: v })} keyboardType="numeric" />
      <Field label="Note" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} />
      <Chips options={['cash', 'online']} value={f.mode} onChange={(v) => setF({ ...f, mode: v })} />
      <Btn title="Save expense" onPress={() => run(() => api('/accounting/expenses', { method: 'POST', body: { category: f.category, description: f.description, amount: Number(f.amount), mode: f.mode, doctor_id: f.doctor_id || null, date: today() } }), () => { setAdd(false); setF({ category: 'Electricity', mode: 'cash' }); reload(); })} />
    </Sheet>
  </Stack>);
}
