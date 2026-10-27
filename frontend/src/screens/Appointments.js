import React, { useState } from 'react';
import { api } from '../api';
import { Async, Badge, Btn, Card, Chips, DateNav, Empty, Field, Header, PatientPicker, Row, Sheet, Stack, T, money, run, statusTone, today, useLoad } from '../ui';

export default function Appointments({ me }) {
  const [day, setDay] = useState(today()); const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState(null); const [doctor, setDoctor] = useState(null);
  const [reason, setReason] = useState(''); const [mode, setMode] = useState('later');
  const s = useLoad(() => api('/appointments?date=' + day), [day]);
  const docs = useLoad(() => api('/users/doctors'));
  const canBook = ['admin', 'receptionist'].includes(me.role);
  const book = () => run(() => api('/appointments', { method: 'POST', body: { patient_id: patient?.id, doctor_id: doctor, date: day, reason, pay_mode: mode === 'later' ? null : mode } }),
    () => { setOpen(false); setPatient(null); setReason(''); s.reload(); });
  const setStatus = (id, status) => run(() => api(`/appointments/${id}/status`, { method: 'PATCH', body: { status } }), s.reload);
  return (
    <Stack>
      <Header title="Appointments" right={canBook && <Btn small title="Book appointment" onPress={() => setOpen(true)} />} />
      <DateNav value={day} onChange={setDay} />
      <Card>
        <Async s={s}>{(list) => list.length === 0 ? <Empty text="No appointments on this day." /> : list.map((a) => (
          <Row key={a.id} left={<>
            <T v="b">Token {a.token} · {a.patient_name}</T>
            <T v="small">Dr. {a.doctor_name} · {a.uhid}{a.reason ? ' · ' + a.reason : ''}</T>
            <T v="small">Fee {money(a.fee)} <Badge text={a.invoice_status || '-'} tone={statusTone(a.invoice_status)} /></T>
          </>} right={<>
            <Badge text={a.status} tone={statusTone(a.status)} />
            {a.status === 'booked' && <Btn small kind="ghost" title="Check in" onPress={() => setStatus(a.id, 'checked_in')} />}
            {['booked', 'checked_in'].includes(a.status) && canBook && <Btn small kind="danger" title="Cancel" onPress={() => setStatus(a.id, 'cancelled')} />}
          </>} />
        ))}</Async>
      </Card>
      <Sheet visible={open} onClose={() => setOpen(false)} title={`Book for ${day}`}>
        <PatientPicker value={patient} onChange={setPatient} />
        <T v="small">Doctor</T>
        <Chips options={(docs.data || []).map((d) => ({ value: d.id, label: `${d.name} · ${money(d.consultation_fee)}` }))} value={doctor} onChange={setDoctor} />
        <Field label="Reason (optional)" value={reason} onChangeText={setReason} />
        <T v="small">Consultation fee</T>
        <Chips options={[{ value: 'later', label: 'Pay later' }, { value: 'cash', label: 'Paid cash' }, { value: 'online', label: 'Paid online' }]} value={mode} onChange={setMode} />
        <Btn title="Book appointment" onPress={book} />
      </Sheet>
    </Stack>
  );
}
