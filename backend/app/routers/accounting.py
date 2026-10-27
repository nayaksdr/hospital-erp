from datetime import date, datetime
from datetime import date as Date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Expense, RecurringExpense, User
from ..security import roles
from ..utils import row, month_range, finance_summary, audit

router = APIRouter(prefix="/accounting", tags=["accounting"])
acct = roles("accountant")


class ExpIn(BaseModel):
    category: str
    description: str | None = None
    amount: float
    date: Date | None = None
    mode: str = "cash"
    doctor_id: int | None = None   # use for any doctor-related expense


class RecIn(BaseModel):
    title: str
    category: str = "Rent"
    amount: float
    day_of_month: int = 1
    active: bool = True


@router.post("/expenses")
def add_expense(d: ExpIn, db: Session = Depends(get_db), me: User = Depends(acct)):
    e = Expense(**d.model_dump(exclude={"date"}), date=d.date or date.today())
    db.add(e); db.flush(); audit(db, me, "create", "expense", e.id); db.commit()
    return row(e)


@router.get("/expenses")
def expenses(month: str | None = None, db: Session = Depends(get_db), _: User = Depends(acct)):
    month = month or date.today().strftime("%Y-%m")
    s, e = month_range(month)
    q = db.query(Expense).filter(Expense.date >= s, Expense.date < e).order_by(Expense.date.desc())
    return [row(x) for x in q]


@router.delete("/expenses/{eid}")
def del_expense(eid: int, db: Session = Depends(get_db), me: User = Depends(acct)):
    e = db.get(Expense, eid)
    if not e:
        raise HTTPException(404, "Expense not found.")
    audit(db, me, "delete", "expense", e.id, f"{e.category}:{e.amount}")
    db.delete(e); db.commit()
    return {"deleted": True}


@router.get("/recurring")
def recurring(db: Session = Depends(get_db), _: User = Depends(acct)):
    return [row(r) for r in db.query(RecurringExpense).order_by(RecurringExpense.id)]


@router.post("/recurring")
def add_recurring(d: RecIn, db: Session = Depends(get_db), _: User = Depends(acct)):
    r = RecurringExpense(**d.model_dump()); db.add(r); db.commit()
    return row(r)


@router.patch("/recurring/{rid}")
def edit_recurring(rid: int, d: RecIn, db: Session = Depends(get_db), _: User = Depends(acct)):
    r = db.get(RecurringExpense, rid)
    if not r:
        raise HTTPException(404, "Not found.")
    for k, v in d.model_dump().items():
        setattr(r, k, v)
    db.commit()
    return row(r)


@router.post("/recurring/generate")
def generate(month: str, db: Session = Depends(get_db), me: User = Depends(acct)):
    """Post this month's rent and other fixed costs once (safe to run twice)."""
    s, e = month_range(month)
    made = 0
    for r in db.query(RecurringExpense).filter(RecurringExpense.active == True):  # noqa
        exists = db.query(Expense).filter(Expense.recurring_id == r.id, Expense.date >= s, Expense.date < e).first()
        if exists:
            continue
        day = min(r.day_of_month, 28)
        db.add(Expense(category=r.category, description=r.title, amount=r.amount,
                       date=date(s.year, s.month, day), recurring_id=r.id))
        made += 1
    audit(db, me, "generate", "recurring", None, f"{month}:{made}")
    db.commit()
    return {"created": made}


@router.get("/summary")
def summary(month: str | None = None, db: Session = Depends(get_db), _: User = Depends(acct)):
    month = month or date.today().strftime("%Y-%m")
    s, e = month_range(month)
    return {"month": month, **finance_summary(db, s, e)}
