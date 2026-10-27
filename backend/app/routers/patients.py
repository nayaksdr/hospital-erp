from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import (Patient, Appointment, Consultation, Prescription, LabOrder, Invoice, User)
from ..security import roles, current_user
from ..utils import row, invoice_out, audit

router = APIRouter(prefix="/patients", tags=["patients"])


class PatientIn(BaseModel):
    name: str
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    emergency_contact: str | None = None


@router.post("")
def create(d: PatientIn, db: Session = Depends(get_db), me: User = Depends(roles("receptionist", "nurse", "doctor"))):
    n = (db.query(func.max(Patient.id)).scalar() or 0) + 1
    p = Patient(**d.model_dump(), uhid=f"UH{n:06d}")
    db.add(p); db.flush()
    audit(db, me, "create", "patient", p.id)
    db.commit()
    return row(p)


@router.get("")
def search(q: str | None = None, limit: int = 50, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = db.query(Patient).order_by(Patient.id.desc())
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Patient.name.ilike(like), Patient.phone.ilike(like), Patient.uhid.ilike(like)))
    return [row(p) for p in query.limit(limit)]


@router.patch("/{pid}")
def update(pid: int, d: PatientIn, db: Session = Depends(get_db), me: User = Depends(roles("receptionist", "nurse", "doctor"))):
    p = db.get(Patient, pid)
    if not p:
        raise HTTPException(404, "Patient not found.")
    for k, v in d.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    audit(db, me, "update", "patient", p.id)
    db.commit()
    return row(p)


@router.get("/{pid}/overview")
def overview(pid: int, db: Session = Depends(get_db), me: User = Depends(current_user)):
    """Everything about one patient: visits, diagnosis, medicines, labs, bills."""
    p = db.get(Patient, pid)
    if not p:
        raise HTTPException(404, "Patient not found.")
    appts = db.query(Appointment).filter(Appointment.patient_id == pid).order_by(Appointment.date.desc()).all()
    consults = db.query(Consultation).filter(Consultation.patient_id == pid).order_by(Consultation.id.desc()).all()
    doctors = {u.id: u.name for u in db.query(User).filter(User.role == "doctor")}
    rx = db.query(Prescription).filter(Prescription.patient_id == pid).order_by(Prescription.id.desc()).all()
    labs = db.query(LabOrder).filter(LabOrder.patient_id == pid).order_by(LabOrder.id.desc()).all()
    invs = db.query(Invoice).filter(Invoice.patient_id == pid).order_by(Invoice.id.desc()).all()
    billed = sum(i.total for i in invs)
    paid = sum(i.paid for i in invs)
    return {
        "patient": row(p),
        "appointments": [{**row(a), "doctor": doctors.get(a.doctor_id)} for a in appts],
        "consultations": [{**row(c), "doctor": doctors.get(c.doctor_id)} for c in consults],
        "prescriptions": [{**row(r), "doctor": doctors.get(r.doctor_id),
                           "items": [{"medicine": i.medicine.name, "strength": i.medicine.strength,
                                      "times_per_day": i.times_per_day, "days": i.days,
                                      "tablets": i.quantity, "instructions": i.instructions}
                                     for i in r.items]} for r in rx],
        "lab_orders": [{**row(l), "test": l.test.name} for l in labs],
        "invoices": [invoice_out(i) for i in invs],
        "totals": {"billed": round(billed, 2), "paid": round(paid, 2), "due": round(billed - paid, 2)},
    }
