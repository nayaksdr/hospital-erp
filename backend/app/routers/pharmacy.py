from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import (Consultation, Expense, Invoice, InvoiceItem, Medicine, Payment, Prescription,
                      PrescriptionItem, User)
from ..security import roles, current_user
from ..utils import row, recalc, add_payment, invoice_out, audit

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])


class MedIn(BaseModel):
    name: str
    strength: str | None = None
    price: float = 0
    stock: int = 0
    reorder_level: int = 20
    expiry_date: date | None = None
    supplier: str | None = None


class MedUpdate(BaseModel):
    name: str | None = None
    strength: str | None = None
    price: float | None = None
    reorder_level: int | None = None
    expiry_date: date | None = None
    supplier: str | None = None


class Restock(BaseModel):
    quantity: int
    total_cost: float = 0
    mode: str = "cash"
    expiry_date: date | None = None


class Dispense(BaseModel):
    mode: str | None = None          # cash / online -> records payment
    amount_paid: float | None = None  # defaults to the pharmacy total
    reference: str | None = None


@router.get("/medicines")
def medicines(q: str | None = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = db.query(Medicine).order_by(Medicine.name)
    if q:
        query = query.filter(Medicine.name.ilike(f"%{q}%"))
    return [row(m) for m in query.limit(300)]


@router.post("/medicines")
def add_med(d: MedIn, db: Session = Depends(get_db), me: User = Depends(roles("pharmacist"))):
    m = Medicine(**d.model_dump()); db.add(m); db.flush()
    audit(db, me, "create", "medicine", m.id); db.commit()
    return row(m)


@router.patch("/medicines/{mid}")
def edit_med(mid: int, d: MedUpdate, db: Session = Depends(get_db), me: User = Depends(roles("pharmacist"))):
    m = db.get(Medicine, mid)
    if not m:
        raise HTTPException(404, "Medicine not found.")
    for k, v in d.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    return row(m)


@router.post("/medicines/{mid}/restock")
def restock(mid: int, d: Restock, db: Session = Depends(get_db), me: User = Depends(roles("pharmacist"))):
    m = db.get(Medicine, mid)
    if not m or d.quantity <= 0:
        raise HTTPException(400, "Choose a medicine and a quantity above zero.")
    m.stock += d.quantity
    if d.expiry_date:
        m.expiry_date = d.expiry_date
    if d.total_cost > 0:  # purchase flows straight into accounting
        db.add(Expense(category="Medicine Purchase", description=f"{m.name} x{d.quantity}",
                       amount=d.total_cost, mode=d.mode))
    audit(db, me, "restock", "medicine", m.id, str(d.quantity))
    db.commit()
    return row(m)


@router.get("/low-stock")
def low_stock(db: Session = Depends(get_db), _: User = Depends(current_user)):
    soon = date.today() + timedelta(days=30)
    low = db.query(Medicine).filter(Medicine.stock <= Medicine.reorder_level).order_by(Medicine.stock).all()
    expiring = db.query(Medicine).filter(Medicine.expiry_date != None, Medicine.expiry_date <= soon).all()  # noqa
    return {"low_stock": [row(m) for m in low], "expiring_soon": [row(m) for m in expiring]}


def _rx_out(rx: Prescription, db: Session):
    c = db.get(Consultation, rx.consultation_id)
    items, total, tablets = [], 0.0, 0
    for i in rx.items:
        line = round(i.quantity * i.medicine.price, 2)
        total += line; tablets += i.quantity
        items.append({"item_id": i.id, "medicine": i.medicine.name, "strength": i.medicine.strength,
                      "times_per_day": i.times_per_day, "days": i.days, "tablets": i.quantity,
                      "price": i.medicine.price, "line_total": line, "stock": i.medicine.stock,
                      "enough_stock": i.medicine.stock >= i.quantity})
    return {"prescription_id": rx.id, "status": rx.status, "created_at": rx.created_at,
            "patient_id": rx.patient_id, "patient_name": rx.patient.name, "uhid": rx.patient.uhid,
            "doctor": rx.doctor.name, "disease": c.disease if c else None,
            "items": items, "total_tablets": tablets, "total": round(total, 2)}


@router.get("/queue")
def queue(status: str = "pending", db: Session = Depends(get_db), _: User = Depends(roles("pharmacist", "nurse", "doctor"))):
    q = db.query(Prescription).filter(Prescription.status == status).order_by(Prescription.id)
    return [_rx_out(r, db) for r in q.limit(100)]


@router.post("/dispense/{rx_id}")
def dispense(rx_id: int, d: Dispense, db: Session = Depends(get_db), me: User = Depends(roles("pharmacist"))):
    rx = db.get(Prescription, rx_id)
    if not rx or rx.status != "pending":
        raise HTTPException(400, "This prescription is not waiting in the pharmacy.")
    short = [i.medicine.name for i in rx.items if i.medicine.stock < i.quantity]
    if short:
        raise HTTPException(400, f"Not enough stock for: {', '.join(short)}")
    c = db.get(Consultation, rx.consultation_id)
    inv = db.query(Invoice).filter(Invoice.appointment_id == c.appointment_id).first() if c else None
    if not inv:
        inv = Invoice(patient_id=rx.patient_id); db.add(inv)
    total = 0.0
    for i in rx.items:
        i.medicine.stock -= i.quantity
        line = round(i.quantity * i.medicine.price, 2); total += line
        inv.items.append(InvoiceItem(category="pharmacy", description=f"{i.medicine.name} x{i.quantity}", amount=line))
    recalc(inv)
    if d.mode:
        add_payment(inv, d.amount_paid if d.amount_paid is not None else total, d.mode, d.reference, "pharmacy", me)
    rx.status, rx.dispensed_at, rx.dispensed_by = "dispensed", datetime.utcnow(), me.id
    audit(db, me, "dispense", "prescription", rx.id)
    db.commit()
    return {"pharmacy_total": round(total, 2), "invoice": invoice_out(inv)}


@router.get("/report")
def report(start: date, end: date, db: Session = Depends(get_db), _: User = Depends(roles("pharmacist", "accountant"))):
    """Medicines dispensed (tablet counts) and pharmacy money split by cash / online."""
    s = datetime.combine(start, datetime.min.time()); e = datetime.combine(end + timedelta(days=1), datetime.min.time())
    meds = (db.query(Medicine.name, func.sum(PrescriptionItem.quantity))
            .join(PrescriptionItem, PrescriptionItem.medicine_id == Medicine.id)
            .join(Prescription, Prescription.id == PrescriptionItem.prescription_id)
            .filter(Prescription.status == "dispensed", Prescription.dispensed_at >= s, Prescription.dispensed_at < e)
            .group_by(Medicine.name).all())
    pay = (db.query(Payment.mode, func.sum(Payment.amount))
           .filter(Payment.category == "pharmacy", Payment.paid_at >= s, Payment.paid_at < e)
           .group_by(Payment.mode).all())
    by_mode = {"cash": 0.0, "online": 0.0, **{m: round(a, 2) for m, a in pay}}
    return {"tablets": [{"medicine": n, "tablets": int(q)} for n, q in meds],
            "total_tablets": int(sum(q for _, q in meds)), "paid_by_mode": by_mode,
            "total_paid": round(sum(by_mode.values()), 2)}
