from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, ROLES
from ..security import roles, current_user, hash_pw
from ..utils import user_out, audit

router = APIRouter(prefix="/users", tags=["staff"])


class UserIn(BaseModel):
    name: str
    email: str
    password: str
    role: str
    phone: str | None = None
    base_salary: float = 0
    joining_date: date | None = None
    specialization: str | None = None
    consultation_fee: float = 0
    commission_pct: float = 0


class UserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    password: str | None = None
    role: str | None = None
    base_salary: float | None = None
    is_active: bool | None = None
    specialization: str | None = None
    consultation_fee: float | None = None
    commission_pct: float | None = None


@router.get("/doctors")
def doctors(db: Session = Depends(get_db), _: User = Depends(current_user)):
    q = db.query(User).filter(User.role == "doctor", User.is_active == True).order_by(User.name)  # noqa
    return [user_out(u) for u in q]


@router.get("")
def list_users(role: str | None = None, db: Session = Depends(get_db), _: User = Depends(roles("hr", "accountant"))):
    q = db.query(User).order_by(User.role, User.name)
    if role:
        q = q.filter(User.role == role)
    return [user_out(u) for u in q]


@router.post("")
def create(d: UserIn, db: Session = Depends(get_db), me: User = Depends(roles("hr"))):
    if d.role not in ROLES:
        raise HTTPException(400, f"Role must be one of: {', '.join(ROLES)}")
    email = d.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "This email is already registered.")
    u = User(**d.model_dump(exclude={"password", "email", "joining_date"}), email=email,
             password_hash=hash_pw(d.password), joining_date=d.joining_date or date.today())
    db.add(u); db.flush()
    audit(db, me, "create", "user", u.id, f"{u.role}:{u.email}")
    db.commit()
    return user_out(u)


@router.patch("/{uid}")
def update(uid: int, d: UserUpdate, db: Session = Depends(get_db), me: User = Depends(roles("hr"))):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "Staff member not found.")
    data = d.model_dump(exclude_unset=True)
    if "role" in data and data["role"] not in ROLES:
        raise HTTPException(400, "Unknown role.")
    if data.get("password"):
        u.password_hash = hash_pw(data.pop("password"))
    data.pop("password", None)
    for k, v in data.items():
        setattr(u, k, v)
    audit(db, me, "update", "user", u.id)
    db.commit()
    return user_out(u)
