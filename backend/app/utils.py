from datetime import date, datetime, timedelta
from fastapi import HTTPException
from sqlalchemy import func
from .models import (AuditLog, Payment, Expense, Payroll, Invoice, InvoiceItem, User)

PAY_MODES = ("cash", "online")


def row(o, skip=()):
    return {c.name: getattr(o, c.name) for c in o.__table__.columns if c.name not in skip}


def user_out(u):
    return row(u, skip=("password_hash",))


def audit(db, user, action, entity, entity_id=None, detail=None):
    db.add(AuditLog(user_id=user.id if user else None, action=action, entity=entity,
                    entity_id=entity_id, detail=detail))


def month_range(m: str):
    try:
        y, mo = map(int, m.split("-"))
        start = date(y, mo, 1)
    except Exception:
        raise HTTPException(400, "Month must look like 2026-10")
    end = date(y + (mo == 12), 1 if mo == 12 else mo + 1, 1)
    return start, end


def recalc(inv: Invoice):
    inv.total = round(sum(i.amount for i in inv.items) - (inv.discount or 0), 2)
    inv.paid = round(sum(p.amount for p in inv.payments), 2)
    inv.status = "paid" if inv.total > 0 and inv.paid >= inv.total else ("partial" if inv.paid > 0 else "unpaid")


def add_payment(inv: Invoice, amount, mode, reference, category, user):
    if mode not in PAY_MODES:
        raise HTTPException(400, "Payment mode must be cash or online.")
    if amount <= 0:
        raise HTTPException(400, "Amount must be more than zero.")
    inv.payments.append(Payment(amount=amount, mode=mode, reference=reference,
                                category=category, received_by=user.id))
    recalc(inv)


def invoice_out(inv: Invoice):
    d = row(inv)
    d["patient_name"] = inv.patient.name if inv.patient else None
    d["uhid"] = inv.patient.uhid if inv.patient else None
    d["due"] = round(inv.total - inv.paid, 2)
    d["items"] = [row(i) for i in inv.items]
    d["payments"] = [row(p) for p in inv.payments]
    return d


def finance_summary(db, start: date, end: date):
    """Income (by mode and source) and expenses (incl. salaries paid) for [start, end)."""
    s, e = datetime.combine(start, datetime.min.time()), datetime.combine(end, datetime.min.time())
    income = {"cash": 0.0, "online": 0.0, "by_source": {}}
    for mode, cat, amt in (db.query(Payment.mode, Payment.category, func.sum(Payment.amount))
                           .filter(Payment.paid_at >= s, Payment.paid_at < e)
                           .group_by(Payment.mode, Payment.category)):
        income[mode] = round(income[mode] + amt, 2)
        income["by_source"][cat] = round(income["by_source"].get(cat, 0) + amt, 2)
    income["total"] = round(income["cash"] + income["online"], 2)

    exp = {}
    for cat, amt in (db.query(Expense.category, func.sum(Expense.amount))
                     .filter(Expense.date >= start, Expense.date < end).group_by(Expense.category)):
        exp[cat] = round(amt, 2)
    sal = db.query(func.sum(Payroll.net_pay)).filter(
        Payroll.status == "paid", Payroll.paid_on >= start, Payroll.paid_on < end).scalar() or 0
    if sal:
        exp["Salaries"] = round(sal, 2)
    total_exp = round(sum(exp.values()), 2)
    return {"income": income, "expenses": {"by_category": exp, "total": total_exp},
            "profit": round(income["total"] - total_exp, 2)}
