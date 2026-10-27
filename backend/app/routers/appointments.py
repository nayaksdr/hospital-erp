from datetime import date as Date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Appointment, Invoice, InvoiceItem, Patient, User
from ..security import roles, current_user
from ..utils import row, recalc, add_payment, audit

router = APIRouter(prefix="/appointments", tags=["appointments"])
STATUSES = ("booked", "checked_in", "consulted", "cancelled")


class ApptIn(BaseModel):
    patient_id: int
    doctor_id: int
    date: Date
    time: str | None = None
    reason: str | None = None
    pay_mode: str | None = None       # collect the OPD fee now: cash / online
    pay_amount: float | None = None   # defaults to the full fee
    pay_reference: str | None = None


@router.post("")
def book(d: ApptIn, db: Session = Depends(get_db), me: User = Depends(roles("receptionist"))):
    doc = db.get(User, d.doctor_id)
    if not doc or doc.role != "doctor" or not doc.is_active:
        raise HTTPException(400, "Choose an active doctor.")
    if not db.get(Patient, d.patient_id):
        raise HTTPException(404, "Patient not found.")
    token = (db.query(func.count(Appointment.id))
             .filter(Appointment.doctor_id == doc.id, Appointment.date == d.date).scalar() or 0) + 1
    ap = Appointment(patient_id=d.patient_id, doctor_id=doc.id, date=d.date, time=d.time,
                     reason=d.reason, token=token, fee=doc.consultation_fee or 0)
    db.add(ap); db.flush()
    inv = Invoice(patient_id=d.patient_id, appointment_id=ap.id)
    inv.items.append(InvoiceItem(category="consultation", description=f"Consultation - Dr. {doc.name}",
                                 amount=ap.fee, doctor_id=doc.id))
    recalc(inv)
    if d.pay_mode:
        add_payment(inv, d.pay_amount if d.pay_amount is not None else inv.total,
                    d.pay_mode, d.pay_reference, "consultation", me)
    db.add(inv)
    audit(db, me, "book", "appointment", ap.id)
    db.commit()
    return {**row(ap), "invoice_id": inv.id, "invoice_status": inv.status}


@router.get("")
def list_appts(date: Date | None = None, doctor_id: int | None = None, status: str | None = None,
               patient_id: int | None = None, db: Session = Depends(get_db), me: User = Depends(current_user)):
    q = db.query(Appointment).order_by(Appointment.date.desc(), Appointment.token)
    if me.role == "doctor":
        doctor_id = me.id  # doctors only see their own list
    if date: q = q.filter(Appointment.date == date)
    if doctor_id: q = q.filter(Appointment.doctor_id == doctor_id)
    if status: q = q.filter(Appointment.status == status)
    if patient_id: q = q.filter(Appointment.patient_id == patient_id)
    out = []
    for a in q.limit(200):
        inv = db.query(Invoice).filter(Invoice.appointment_id == a.id).first()
        out.append({**row(a), "patient_name": a.patient.name, "uhid": a.patient.uhid,
                    "doctor_name": a.doctor.name, "invoice_id": inv.id if inv else None,
                    "invoice_status": inv.status if inv else None})
    return out


class StatusIn(BaseModel):
    status: str


@router.patch("/{aid}/status")
def set_status(aid: int, d: StatusIn, db: Session = Depends(get_db),
               me: User = Depends(roles("receptionist", "nurse", "doctor"))):
    ap = db.get(Appointment, aid)
    if not ap:
        raise HTTPException(404, "Appointment not found.")
    if d.status not in STATUSES:
        raise HTTPException(400, "Unknown status.")
    ap.status = d.status
    audit(db, me, f"status:{d.status}", "appointment", ap.id)
    db.commit()
    return row(ap)
