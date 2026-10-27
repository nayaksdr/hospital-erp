import calendar
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Attendance, Invoice, InvoiceItem, Payroll, User
from ..security import roles, current_user
from ..utils import row, month_range, PAY_MODES, audit

router = APIRouter(prefix="/hr", tags=["hr"])
STATUS = ("present", "absent", "half", "leave")


class AttIn(BaseModel):
    user_id: int
    date: date
    status: str = "present"
    check_in: str | None = None
    check_out: str | None = None
    overtime_hours: float = 0


class AdjustIn(BaseModel):
    bonus: float | None = None
    deductions: float | None = None


class PayIn(BaseModel):
    mode: str
    reference: str | None = None


def _att_out(a):
    return {**row(a), "name": a.user.name, "role": a.user.role}


@router.post("/attendance")
def mark(items: list[AttIn], db: Session = Depends(get_db), me: User = Depends(roles("hr", "nurse"))):
    for d in items:
        if d.status not in STATUS:
            raise HTTPException(400, "Status must be present, absent, half or leave.")
        a = db.query(Attendance).filter_by(user_id=d.user_id, date=d.date).first() or Attendance(user_id=d.user_id, date=d.date)
        a.status, a.check_in, a.check_out, a.overtime_hours = d.status, d.check_in, d.check_out, d.overtime_hours
        db.add(a)
    audit(db, me, "mark", "attendance", None, f"{len(items)} rows")
    db.commit()
    return {"saved": len(items)}


@router.post("/check-in")
def check_in(db: Session = Depends(get_db), me: User = Depends(current_user)):
    now = datetime.now()
    a = db.query(Attendance).filter_by(user_id=me.id, date=now.date()).first() or Attendance(user_id=me.id, date=now.date())
    a.status, a.check_in = "present", a.check_in or now.strftime("%H:%M")
    db.add(a); db.commit()
    return _att_out(a)


@router.post("/check-out")
def check_out(db: Session = Depends(get_db), me: User = Depends(current_user)):
    now = datetime.now()
    a = db.query(Attendance).filter_by(user_id=me.id, date=now.date()).first()
    if not a:
        raise HTTPException(400, "Check in first.")
    a.check_out = now.strftime("%H:%M"); db.commit()
    return _att_out(a)


@router.get("/attendance")
def attendance(day: date | None = None, month: str | None = None, user_id: int | None = None,
               db: Session = Depends(get_db), me: User = Depends(current_user)):
    q = db.query(Attendance).order_by(Attendance.date.desc())
    if me.role not in ("admin", "hr", "nurse"):
        user_id = me.id  # others only see their own
    if user_id: q = q.filter(Attendance.user_id == user_id)
    if day: q = q.filter(Attendance.date == day)
    if month:
        s, e = month_range(month); q = q.filter(Attendance.date >= s, Attendance.date < e)
    return [_att_out(a) for a in q.limit(500)]


def calc_payroll(db: Session, u: User, month: str):
    """Salary = base / working days * paid days + overtime + doctor commission + bonus - deductions."""
    s, e = month_range(month)
    working = sum(1 for i in range((e - s).days) if (s + timedelta(i)).weekday() != 6)  # Sundays off
    recs = db.query(Attendance).filter(Attendance.user_id == u.id, Attendance.date >= s, Attendance.date < e).all()
    paid_days = min(working, sum({"present": 1, "leave": 1, "half": 0.5}.get(r.status, 0) for r in recs))
    ot = sum(r.overtime_hours or 0 for r in recs)
    per_day = (u.base_salary or 0) / working if working else 0
    commission = 0.0
    if u.role == "doctor" and u.commission_pct:
        fees = (db.query(func.sum(InvoiceItem.amount)).join(Invoice, Invoice.id == InvoiceItem.invoice_id)
                .filter(InvoiceItem.category == "consultation", InvoiceItem.doctor_id == u.id,
                        Invoice.created_at >= datetime.combine(s, datetime.min.time()),
                        Invoice.created_at < datetime.combine(e, datetime.min.time())).scalar() or 0)
        commission = round(fees * u.commission_pct / 100, 2)
    return {"base_salary": u.base_salary or 0, "working_days": working, "paid_days": paid_days,
            "overtime_hours": ot, "overtime_pay": round(ot * per_day / 8 * 1.5, 2),
            "commission": commission, "basic_earned": round(per_day * paid_days, 2)}


def _net(p: Payroll, basic):
    p.net_pay = round(basic + p.overtime_pay + p.commission + (p.bonus or 0) - (p.deductions or 0), 2)


@router.post("/payroll/generate")
def generate(month: str, db: Session = Depends(get_db), me: User = Depends(roles("hr"))):
    """Calculate (or recalculate unpaid) salaries for every active employee."""
    made = 0
    for u in db.query(User).filter(User.is_active == True):  # noqa
        p = db.query(Payroll).filter_by(user_id=u.id, month=month).first()
        if p and p.status == "paid":
            continue
        c = calc_payroll(db, u, month)
        p = p or Payroll(user_id=u.id, month=month)
        for k in ("base_salary", "working_days", "paid_days", "overtime_hours", "overtime_pay", "commission"):
            setattr(p, k, c[k])
        _net(p, c["basic_earned"]); db.add(p); made += 1
    audit(db, me, "generate", "payroll", None, month); db.commit()
    return {"calculated": made}


def _pay_out(p: Payroll):
    return {**row(p), "name": p.user.name, "role": p.user.role}


@router.get("/payroll")
def payroll(month: str, db: Session = Depends(get_db), me: User = Depends(current_user)):
    q = db.query(Payroll).filter(Payroll.month == month).order_by(Payroll.user_id)
    if me.role not in ("admin", "hr", "accountant"):
        q = q.filter(Payroll.user_id == me.id)
    return [_pay_out(p) for p in q]


@router.patch("/payroll/{pid}")
def adjust(pid: int, d: AdjustIn, db: Session = Depends(get_db), me: User = Depends(roles("hr"))):
    p = db.get(Payroll, pid)
    if not p or p.status == "paid":
        raise HTTPException(400, "Payroll not found or already paid.")
    if d.bonus is not None: p.bonus = d.bonus
    if d.deductions is not None: p.deductions = d.deductions
    c = calc_payroll(db, p.user, p.month); _net(p, c["basic_earned"])
    audit(db, me, "adjust", "payroll", p.id); db.commit()
    return _pay_out(p)


@router.post("/payroll/{pid}/pay")
def pay(pid: int, d: PayIn, db: Session = Depends(get_db), me: User = Depends(roles("accountant", "hr"))):
    p = db.get(Payroll, pid)
    if not p or p.status == "paid":
        raise HTTPException(400, "Payroll not found or already paid.")
    if d.mode not in PAY_MODES:
        raise HTTPException(400, "Payment mode must be cash or online.")
    p.status, p.paid_mode, p.paid_reference, p.paid_on = "paid", d.mode, d.reference, date.today()
    audit(db, me, "pay", "payroll", p.id, f"{p.net_pay}"); db.commit()
    return _pay_out(p)
