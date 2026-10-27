import React, { useState } from 'react';
import { api } from '../api';
import { Async, Badge, Btn, Card, Chips, Field, Header, Row, Sheet, Stack, T, money, run, useLoad } from '../ui';

const ROLES = ['doctor', 'nurse', 'receptionist', 'pharmacist', 'lab', 'accountant', 'hr', 'admin'];

export default function Staff() {
  const [add, setAdd] = useState(false); const [f, setF] = useState({ role: 'nurse' });
  const s = useLoad(() => api('/users'));
  const set = (k) => (v) => setF({ ...f, [k]: v });
  return (<Stack>
    <Header title="Staff" right={<Btn small title="Add staff" onPress={() => setAdd(true)} />} />
    <Card><Async s={s}>{(list) => list.map((u) => (
      <Row key={u.id} left={<><T v="b">{u.name}</T><T v="small">{u.email} · base {money(u.base_salary)}{u.role === 'doctor' ? ` · fee ${money(u.consultation_fee)} · ${u.commission_pct}%` : ''}</T></>}
        right={<><Badge text={u.role} />{<Btn small kind={u.is_active ? 'ghost' : 'primary'} title={u.is_active ? 'Deactivate' : 'Activate'} onPress={() => run(() => api('/users/' + u.id, { method: 'PATCH', body: { is_active: !u.is_active } }), s.reload)} />}</>} />))}</Async></Card>
    <Sheet visible={add} onClose={() => setAdd(false)} title="New staff member">
      <Chips options={ROLES} value={f.role} onChange={set('role')} />
      <Field label="Full name" value={f.name} onChangeText={set('name')} />
      <Field label="Email (login)" value={f.email} onChangeText={set('email')} autoCapitalize="none" />
      <Field label="Password" value={f.password} onChangeText={set('password')} secureTextEntry />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Monthly salary" value={f.base_salary} onChangeText={set('base_salary')} keyboardType="numeric" />
      {f.role === 'doctor' && (<>
        <Field label="Specialization" value={f.specialization} onChangeText={set('specialization')} />
        <Field label="Consultation fee" value={f.consultation_fee} onChangeText={set('consultation_fee')} keyboardType="numeric" />
        <Field label="Commission % on consultation fees" value={f.commission_pct} onChangeText={set('commission_pct')} keyboardType="numeric" />
      </>)}
      <Btn title="Create account" onPress={() => run(() => api('/users', { method: 'POST', body: { ...f, base_salary: Number(f.base_salary || 0), consultation_fee: Number(f.consultation_fee || 0), commission_pct: Number(f.commission_pct || 0) } }), () => { setAdd(false); setF({ role: 'nurse' }); s.reload(); })} />
    </Sheet>
  </Stack>);
}
