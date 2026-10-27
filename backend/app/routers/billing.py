from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Invoice, InvoiceItem, User
from ..security import roles, current_user
from ..utils import invoice_out, recalc, add_payment, audit

router = APIRouter(prefix="/billing", tags=["billing"])


class ItemIn(BaseModel):
    category: str = "other"   # room / procedure / other ...
    description: str
    amount: float


class PayIn(BaseModel):
    amount: float
    mode: str                  # cash / online
    reference: str | None = None


class DiscountIn(BaseModel):
    discount: float


@router.get("/invoices")
def invoices(status: str | None = None, patient_id: int | None = None, day: date | None = None,
             db: Session = Depends(get_db), _: User = Depends(roles("receptionist", "accountant", "pharmacist"))):
    q = db.query(Invoice).order_by(Invoice.id.desc())
    if status: q = q.filter(Invoice.status == status)
    if patient_id: q = q.filter(Invoice.patient_id == patient_id)
    if day:
        q = q.filter(Invoice.created_at >= datetime.combine(day, datetime.min.time()),
                     Invoice.created_at < datetime.combine(day + timedelta(days=1), datetime.min.time()))
    return [invoice_out(i) for i in q.limit(100)]


@router.get("/invoices/{iid}")
def one(iid: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    inv = db.get(Invoice, iid)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    return invoice_out(inv)


@router.post("/invoices/{iid}/items")
def add_item(iid: int, d: ItemIn, db: Session = Depends(get_db), me: User = Depends(roles("receptionist", "nurse", "accountant"))):
    inv = db.get(Invoice, iid)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    inv.items.append(InvoiceItem(**d.model_dump())); recalc(inv)
    audit(db, me, "add_item", "invoice", inv.id, d.description); db.commit()
    return invoice_out(inv)


@router.post("/invoices/{iid}/payments")
def pay(iid: int, d: PayIn, db: Session = Depends(get_db), me: User = Depends(roles("receptionist", "accountant", "pharmacist"))):
    inv = db.get(Invoice, iid)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    if d.amount > round(inv.total - inv.paid, 2) + 0.001:
        raise HTTPException(400, "Amount is more than the balance due.")
    add_payment(inv, d.amount, d.mode, d.reference, "general", me)
    audit(db, me, "payment", "invoice", inv.id, f"{d.mode}:{d.amount}"); db.commit()
    return invoice_out(inv)


@router.post("/invoices/{iid}/discount")
def discount(iid: int, d: DiscountIn, db: Session = Depends(get_db), me: User = Depends(roles("accountant"))):
    inv = db.get(Invoice, iid)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    inv.discount = d.discount; recalc(inv)
    audit(db, me, "discount", "invoice", inv.id, str(d.discount)); db.commit()
    return invoice_out(inv)
