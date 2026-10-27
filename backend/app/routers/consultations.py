from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import (Appointment, Consultation, DiseaseTemplate, Invoice, InvoiceItem, LabOrder,
                      LabTest, Medicine, Prescription, PrescriptionItem, User)
from ..security import roles, current_user
from ..utils import row, recalc, audit

router = APIRouter(prefix="/consultations", tags=["consultation"])


class RxItem(BaseModel):
    medicine_id: int
    times_per_day: int = 1
    days: int = 1
    instructions: str | None = None


class ConsultIn(BaseModel):
    appointment_id: int
    disease: str
    notes: str | None = None
    follow_up_date: date | None = None
    use_template: bool = False       # fill medicines from the disease template
    medicines: list[RxItem] = []
    lab_test_ids: list[int] = []


class TemplateIn(BaseModel):
    disease: str
    medicine_id: int
    times_per_day: int = 1
    days: int = 1


@router.get("/diseases")
def diseases(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return [d for (d,) in db.query(DiseaseTemplate.disease).distinct().order_by(DiseaseTemplate.disease)]


@router.get("/templates")
def templates(disease: str, db: Session = Depends(get_db), _: User = Depends(current_user)):
    q = db.query(DiseaseTemplate).filter(func.lower(DiseaseTemplate.disease) == disease.strip().lower())
    return [{"medicine_id": t.medicine_id, "name": t.medicine.name, "strength": t.medicine.strength,
             "times_per_day": t.times_per_day, "days": t.days} for t in q]


@router.post("/templates")
def add_template(d: TemplateIn, db: Session = Depends(get_db), _: User = Depends(roles("doctor"))):
    t = DiseaseTemplate(disease=d.disease.strip(), medicine_id=d.medicine_id,
                        times_per_day=d.times_per_day, days=d.days)
    db.add(t); db.commit()
    return row(t)


@router.post("")
def create(d: ConsultIn, db: Session = Depends(get_db), me: User = Depends(roles("doctor"))):
    ap = db.get(Appointment, d.appointment_id)
    if not ap:
        raise HTTPException(404, "Appointment not found.")
    if me.role != "admin" and ap.doctor_id != me.id:
        raise HTTPException(403, "This appointment belongs to another doctor.")
    if ap.status == "cancelled" or db.query(Consultation).filter_by(appointment_id=ap.id).first():
        raise HTTPException(400, "This appointment is cancelled or already consulted.")

    items = list(d.medicines)
    if d.use_template and not items:
        for t in db.query(DiseaseTemplate).filter(func.lower(DiseaseTemplate.disease) == d.disease.strip().lower()):
            items.append(RxItem(medicine_id=t.medicine_id, times_per_day=t.times_per_day, days=t.days))

    c = Consultation(appointment_id=ap.id, patient_id=ap.patient_id, doctor_id=ap.doctor_id,
                     disease=d.disease.strip(), notes=d.notes, follow_up_date=d.follow_up_date)
    db.add(c); db.flush()

    rx = None
    if items:  # this prescription appears in the pharmacy queue automatically
        rx = Prescription(consultation_id=c.id, patient_id=ap.patient_id, doctor_id=ap.doctor_id)
        for i in items:
            if not db.get(Medicine, i.medicine_id):
                raise HTTPException(400, f"Medicine {i.medicine_id} does not exist.")
            rx.items.append(PrescriptionItem(medicine_id=i.medicine_id, times_per_day=i.times_per_day,
                                             days=i.days, quantity=i.times_per_day * i.days,
                                             instructions=i.instructions))
        db.add(rx)

    inv = db.query(Invoice).filter(Invoice.appointment_id == ap.id).first()
    for tid in d.lab_test_ids:
        test = db.get(LabTest, tid)
        if not test:
            raise HTTPException(400, f"Lab test {tid} does not exist.")
        db.add(LabOrder(patient_id=ap.patient_id, doctor_id=ap.doctor_id, test_id=tid))
        if inv:
            inv.items.append(InvoiceItem(category="lab", description=test.name, amount=test.price))
    if inv:
        recalc(inv)

    ap.status = "consulted"
    audit(db, me, "create", "consultation", c.id, d.disease)
    db.commit()
    return {"consultation_id": c.id, "prescription_id": rx.id if rx else None}
