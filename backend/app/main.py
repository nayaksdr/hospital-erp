from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine, SessionLocal
from .routers import auth, users, patients, appointments, consultations, pharmacy, lab, billing, accounting, hr, dashboard
from .seed import seed
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from . import assistant

load_dotenv()

@asynccontextmanager
async def lifespan(_):
    Base.metadata.create_all(engine)  # use Alembic migrations once you go to production
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Hospital ERP API", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
for r in (auth, users, patients, appointments, consultations, pharmacy, lab, billing, accounting, hr, dashboard, assistant):
    app.include_router(r.router)

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_ROOT)),
    name="uploads",
)

@app.get("/health")
def health():
    return {"ok": True}
