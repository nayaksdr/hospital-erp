import React, { useState } from 'react';
import { api } from '../api';
import { Async, Badge, Btn, Card, Chips, Field, Grid, Header, Row, Sheet, Stack, Stat, T, money, run, statusTone, useLoad } from '../ui';

export function PatientDetail({ id, back }) {
  const s = useLoad(() => api(`/patients/${id}/overview`), [id]);
  return (
    <Stack>
      <Header title="Patient record" right={<Btn small kind="ghost" title="‹ Back" onPress={back} />} />
      <Async s={s}>{(d) => (<>
        <Card>
          <T v="h2">{d.patient.name} · {d.patient.uhid}</T>
          <T v="small">{[d.patient.age && `${d.patient.age} yrs`, d.patient.gender, d.patient.blood_group, d.patient.phone].filter(Boolean).join(' · ')}</T>
          {d.patient.allergies ? <Badge tone="danger" text={`Allergies: ${d.patient.allergies}`} /> : null}
          {d.patient.address ? <T v="small">{d.patient.address}</T> : null}
        </Card>
        <Grid>
          <Stat label="Total billed" value={money(d.totals.billed)} />
          <Stat label="Paid" value={money(d.totals.paid)} tone="good" />
          <Stat label="Balance due" value={money(d.totals.due)} tone={d.totals.due ? 'bad' : undefined} />
        </Grid>
        <Card><T v="h2">Visits and diagnosis</T>
          {d.appointments.length === 0 && <T v="small">No visits yet.</T>}
          {d.appointments.map((a) => {
            const c = d.consultations.find((x) => x.appointment_id === a.id);
            return <Row key={a.id} left={<><T v="b">{a.date} · Dr. {a.doctor}</T><T v="small">{c ? `${c.disease}${c.notes ? ' — ' + c.notes : ''}` : a.reason || 'No consultation yet'}</T></>} right={<Badge text={a.status} tone={statusTone(a.status)} />} />;
          })}
        </Card>
        <Card><T v="h2">Medicines prescribed</T>
          {d.prescriptions.length === 0 && <T v="small">None.</T>}
          {d.prescriptions.map((r) => (
            <Row key={r.id} left={<>
              <T v="b">{r.created_at.slice(0, 10)} · Dr. {r.doctor}</T>
              {r.items.map((i, k) => <T key={k} v="small">{i.medicine} {i.strength} — {i.times_per_day}×/day for {i.days} days ({i.tablets} tablets)</T>)}
            </>} right={<Badge text={r.status} tone={statusTone(r.status)} />} />
          ))}
        </Card>
        <Card><T v="h2">Lab reports</T>
          {d.lab_orders.length === 0 && <T v="small">None.</T>}
          {d.lab_orders.map((l) => <Row key={l.id} left={<><T v="b">{l.test}</T><T v="small">{l.result || 'Result pending'}</T></>} right={<Badge text={l.status} tone={statusTone(l.status)} />} />)}
        </Card>
        <Card><T v="h2">Bills and payments</T>
          {d.invoices.map((i) => (
            <Row key={i.id} left={<>
              <T v="b">Invoice #{i.id} · {i.created_at.slice(0, 10)}</T>
              {i.items.map((it) => <T key={it.id} v="small">{it.description} — {money(it.amount)}</T>)}
              {i.payments.map((p) => <T key={p.id} v="small">Paid {money(p.amount)} by {p.mode}{p.reference ? ` (${p.reference})` : ''}</T>)}
            </>} right={<><T v="b">{money(i.total)}</T><Badge text={i.status} tone={statusTone(i.status)} /></>} />
          ))}
        </Card>
      </>)}</Async>
    </Stack>
  );
}

export default function Patients({ me }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState(null); const [add, setAdd] = useState(false);
  const [f, setF] = useState({ gender: 'M' });
  const s = useLoad(() => api('/patients?q=' + encodeURIComponent(q)), [q]);
  if (sel) return <PatientDetail id={sel} back={() => setSel(null)} />;
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const canAdd = ['admin', 'receptionist', 'nurse', 'doctor'].includes(me.role);
  return (
    <Stack>
      <Header title="Patients" right={canAdd && <Btn small title="Add patient" onPress={() => setAdd(true)} />} />
      <Field value={q} onChangeText={setQ} placeholder="Search by name, phone or UHID" />
      <Card>
        <Async s={s}>{(list) => list.length === 0 ? <T v="small">No patients found. Add the first one.</T> :
          list.map((p) => <Row key={p.id} onPress={() => setSel(p.id)} left={<><T v="b">{p.name}</T><T v="small">{p.uhid} · {p.phone || 'no phone'} · {p.age ? p.age + ' yrs' : ''}</T></>} right={<T v="b">›</T>} />)}
        </Async>
      </Card>
      <Sheet visible={add} onClose={() => setAdd(false)} title="New patient">
        <Field label="Full name" value={f.name} onChangeText={set('name')} />
        <Field label="Age" value={f.age} onChangeText={set('age')} keyboardType="numeric" />
        <Chips options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }]} value={f.gender} onChange={set('gender')} />
        <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="Blood group" value={f.blood_group} onChangeText={set('blood_group')} />
        <Field label="Allergies" value={f.allergies} onChangeText={set('allergies')} />
        <Field label="Address" value={f.address} onChangeText={set('address')} />
        <Btn title="Save patient" onPress={() => run(() => api('/patients', { method: 'POST', body: { ...f, age: f.age ? Number(f.age) : null } }), () => { setAdd(false); setF({ gender: 'M' }); s.reload(); })} />
      </Sheet>
    </Stack>
  );
}
