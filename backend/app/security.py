import os
from datetime import datetime, timedelta
import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .db import get_db
from .models import User

SECRET = os.getenv("SECRET_KEY", "change-me-in-production")
ALGO = "HS256"
bearer = HTTPBearer()


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def check_pw(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(uid: int, hours: int = 12) -> str:
    return jwt.encode({"sub": str(uid), "exp": datetime.utcnow() + timedelta(hours=hours)}, SECRET, ALGO)


def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    try:
        uid = int(jwt.decode(cred.credentials, SECRET, algorithms=[ALGO])["sub"])
    except Exception:
        raise HTTPException(401, "Session expired. Please sign in again.")
    u = db.get(User, uid)
    if not u or not u.is_active:
        raise HTTPException(401, "This account is inactive.")
    return u


def roles(*allowed):
    """Admin always passes; other users need one of the listed roles."""
    def dep(u: User = Depends(current_user)) -> User:
        if u.role != "admin" and u.role not in allowed:
            raise HTTPException(403, "Your role cannot do this.")
        return u
    return dep
