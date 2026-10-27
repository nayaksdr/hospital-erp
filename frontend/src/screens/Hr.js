import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { Async, Badge, Btn, Card, Chips, DateNav, Empty, Field, Header, Row, Sheet, Stack, T, money, run, statusTone, today, useLoad } from '../ui';

function Attendance() {
  const [day, setDay] = useState(today()); const [map, setMap] = useState({});
  const users = useLoad(() => api('/users'));
  const att = useLoad(() => api('/hr/attendance?day=' + day), [day]);
  useEffect(() => { const m = {}; (att.data || []).forEach((a) => { m[a.user_id] = { status: a.status, ot: String(a.overtime_hours || 0) }; }); setMap(m); }, [att.data]);
  const save = () => run(() => api('/hr/attendance', { method: 'POST', body: (users.data || []).filter((u) => map[u.id]).map((u) => ({ user_id: u.id, date: day, status: map[u.id].status, overtime_hours: Number(map[u.id].ot || 0) })) }), () => att.reload());
  return (<Stack>
    <DateNav value={day} onChange={setDay} />
    <Card><Async s={users}>{(list) => list.filter((u) => u.is_active).map((u) => (
      <View key={u.id} style={{ gap: 6, paddingVertical: 6 }}>
        <T v="b">{u.name} <T v="small">· {u.role}</T></T>
        <Chips options={['present', 'half', 'leave', 'absent']} value={map[u.id]?.status} onChange={(v) => setMap({ ...map, [u.id]: { ot: '0', ...map[u.id], status: v } })} />
        {map[u.id] && <Field label="Overtime hours" value={map[u.id].ot} onChangeText={(v) => setMap({ ...map, [u.id]: { ...map[u.id], ot: v } })} keyboardType="numeric" style={{ maxWidth: 160 }} />}
      </View>))}</Async></Card>
    <Btn title="Save attendance" onPress={save} />
  </Stack>);
}

function Payroll() {
  const [month, setMonth] = useState(today().slice(0, 7)); const [adj, setAdj] = useState(null); const [pay, setPay] = useState(null); const [f, setF] = useState({ mode: 'cash' });
  const s = useLoad(() => api('/hr/payroll?month=' + month), [month]);
  return (<Stack>
    <DateNav month value={month} onChange={setMonth} />
    <Btn kind="ghost" title="Calculate salaries from attendance" onPress={() => run(() => api('/hr/payroll/generate?month=' + month, { method: 'POST' }), s.reload)} />
    <Card><Async s={s}>{(list) => list.length === 0 ? <Empty text="No salary sheet yet. Tap Calculate to create it." /> : list.map((p) => (
      <Row key={p.id} left={<>
        <T v="b">{p.name} · {p.role}</T>
        <T v="small">Base {money(p.base_salary)} · worked {p.paid_days}/{p.working_days} days</T>
        <T v="small">Overtime {money(p.overtime_pay)} · Commission {money(p.commission)} · Bonus {money(p.bonus)} · Deductions {money(p.deductions)}</T>
        {p.status === 'paid' && <T v="small">Paid {p.paid_on} by {p.paid_mode}{p.paid_reference ? ` (${p.paid_reference})` : ''}</T>}
      </>} right={<View style={{ alignItems: 'flex-end', gap: 4 }}><T v="h2">{money(p.net_pay)}</T><Badge text={p.status} tone={statusTone(p.status)} />
        {p.status === 'unpaid' && <View style={{ flexDirection: 'row', gap: 6 }}><Btn small kind="ghost" title="Adjust" onPress={() => { setAdj(p); setF({ bonus: String(p.bonus || 0), deductions: String(p.deductions || 0) }); }} /><Btn small title="Pay" onPress={() => { setPay(p); setF({ mode: 'cash' }); }} /></View>}
      </View>} />))}</Async></Card>
    <Sheet visible={!!adj} onClose={() => setAdj(null)} title={`Adjust · ${adj?.name || ''}`}>
      <Field label="Bonus" value={f.bonus} onChangeText={(v) => setF({ ...f, bonus: v })} keyboardType="numeric" />
      <Field label="Deductions (advance, penalty…)" value={f.deductions} onChangeText={(v) => setF({ ...f, deductions: v })} keyboardType="numeric" />
      <Btn title="Update salary" onPress={() => run(() => api(`/hr/payroll/${adj.id}`, { method: 'PATCH', body: { bonus: Number(f.bonus || 0), deductions: Number(f.deductions || 0) } }), () => { setAdj(null); s.reload(); })} />
    </Sheet>
    <Sheet visible={!!pay} onClose={() => setPay(null)} title={`Pay ${pay?.name || ''} · ${money(pay?.net_pay)}`}>
      <Chips options={['cash', 'online']} value={f.mode} onChange={(v) => setF({ ...f, mode: v })} />
      {f.mode === 'online' && <Field label="Transaction reference" value={f.reference} onChangeText={(v) => setF({ ...f, reference: v })} />}
      <Btn title="Mark as paid" onPress={() => run(() => api(`/hr/payroll/${pay.id}/pay`, { method: 'POST', body: { mode: f.mode, reference: f.reference || null } }), () => { setPay(null); s.reload(); })} />
    </Sheet>
  </Stack>);
}

export default function Hr() {
  const [tab, setTab] = useState('att');
  return (<Stack><Header title="Attendance and salary" />
    <Chips options={[{ value: 'att', label: 'Attendance' }, { value: 'pay', label: 'Salary' }]} value={tab} onChange={setTab} />
    {tab === 'att' ? <Attendance /> : <Payroll />}</Stack>);
}
