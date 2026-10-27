from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User
from ..security import check_pw, make_token, current_user
from ..utils import user_out

router = APIRouter(prefix="/auth", tags=["auth"])


class Login(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(d: Login, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == d.email.strip().lower()).first()
    if not u or not u.is_active or not check_pw(d.password, u.password_hash):
        raise HTTPException(401, "Wrong email or password.")
    return {"token": make_token(u.id), "user": user_out(u)}


@router.get("/me")
def me(u: User = Depends(current_user)):
    return user_out(u)
