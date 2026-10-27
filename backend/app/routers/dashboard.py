from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import (Appointment, Attendance, Invoice, Medicine, Patient, RecurringExpense, User)
from ..security import roles
from ..utils import finance_summary, month_range

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), _: User = Depends(roles("accountant", "receptionist", "hr"))):
    today = date.today()
    ms, me_ = month_range(today.strftime("%Y-%m"))
    appts = dict(db.query(Appointment.status, func.count()).filter(Appointment.date == today)
                 .group_by(Appointment.status).all())
    new_patients = db.query(func.count(Patient.id)).filter(
        Patient.created_at >= datetime.combine(today, datetime.min.time())).scalar()
    due = db.query(func.sum(Invoice.total - Invoice.paid), func.count()).filter(Invoice.status != "paid").first()
    staff = dict(db.query(User.role, func.count()).filter(User.is_active == True).group_by(User.role).all())  # noqa
    present = db.query(func.count(Attendance.id)).filter(Attendance.date == today, Attendance.status.in_(("present", "half"))).scalar()
    rent = db.query(func.sum(RecurringExpense.amount)).filter(RecurringExpense.active == True, RecurringExpense.category == "Rent").scalar() or 0  # noqa
    low = db.query(func.count(Medicine.id)).filter(Medicine.stock <= Medicine.reorder_level).scalar()
    soon = db.query(func.count(Medicine.id)).filter(Medicine.expiry_date != None, Medicine.expiry_date <= today + timedelta(days=30)).scalar()  # noqa

    trend, y, m = [], today.year, today.month
    for k in range(5, -1, -1):  # last 6 months
        mm = m - k; yy = y + (mm - 1) // 12; mm = (mm - 1) % 12 + 1
        s, e = month_range(f"{yy}-{mm:02d}")
        f = finance_summary(db, s, e)
        trend.append({"month": f"{yy}-{mm:02d}", "income": f["income"]["total"], "expense": f["expenses"]["total"]})
    return {
        "today": {"appointments": appts, "appointments_total": sum(appts.values()), "new_patients": new_patients,
                  "collection": finance_summary(db, today, today + timedelta(days=1))["income"]},
        "month": finance_summary(db, ms, me_),
        "pending_bills": {"amount": round(due[0] or 0, 2), "count": due[1]},
        "monthly_rent": rent,
        "pharmacy": {"low_stock": low, "expiring_soon": soon},
        "staff": {"by_role": staff, "total": sum(staff.values()), "present_today": present},
        "trend": trend,
    }
