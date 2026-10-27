
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import LabOrder, LabTest, User
from ..security import roles, current_user
from ..utils import row, audit
import os
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile, File

router = APIRouter(prefix="/lab", tags=["lab"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "lab"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".webp": {"image/webp"},
    ".pdf": {"application/pdf"},
}

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB


@router.post("/upload")
async def upload_lab_file(
    file: UploadFile = File(...),
    _: User = Depends(roles("lab", "admin")),
):
    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload JPG, PNG, WebP, or PDF.",
        )

    if file.content_type not in ALLOWED_TYPES[extension]:
        raise HTTPException(
            status_code=400,
            detail="File extension and content type do not match.",
        )

    filename = f"{uuid4().hex}{extension}"
    destination = UPLOAD_DIR / filename
    size = 0

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                size += len(chunk)

                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File is too large. Maximum size is 15 MB.",
                    )

                output.write(chunk)

        return {
            "filename": filename,
            "url": f"/uploads/lab/{filename}",
            "content_type": file.content_type,
            "size": size,
        }

    except Exception:
        destination.unlink(missing_ok=True)
        raise

    finally:
        await file.close()
        
class TestIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    price: float = Field(default=0, ge=0)


class ResultIn(BaseModel):
    # Existing frontend can continue sending result and report_url.
    result: str = Field(min_length=1, max_length=20000)
    report_url: str | None = Field(default=None, max_length=2048)

    report_type: Literal[
        "text", "blood_test", "xray", "ct",
        "mri", "ultrasound", "other"
    ] = "text"

    findings: str | None = Field(default=None, max_length=20000)
    impression: str | None = Field(default=None, max_length=10000)
    images: list[str] = Field(default_factory=list, max_length=30)
    measurements: dict[str, Any] = Field(default_factory=dict)
    ai_summary: str | None = Field(default=None, max_length=10000)


def report_data(order: LabOrder) -> dict:
    data = row(order)

    data.update({
        "test": order.test.name,
        "patient_name": order.patient.name,
        "uhid": order.patient.uhid,
        "report_type": getattr(order, "report_type", None) or "text",
        "findings": getattr(order, "findings", None),
        "impression": getattr(order, "impression", None),
        "images": getattr(order, "images", None) or [],
        "measurements": getattr(order, "measurements", None) or {},
        "ai_summary": getattr(order, "ai_summary", None),
    })
    return data


@router.get("/tests")
def tests(
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
):
    return [
        row(test)
        for test in db.query(LabTest).order_by(LabTest.name).all()
    ]


@router.post("/tests")
def add_test(
    d: TestIn,
    db: Session = Depends(get_db),
    _: User = Depends(roles("lab")),
):
    test = LabTest(**d.model_dump())
    db.add(test)

    try:
        db.commit()
        db.refresh(test)
        return row(test)
    except Exception:
        db.rollback()
        raise


@router.get("/orders")
def orders(
    status: Literal["ordered", "done"] | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
):
    query = (
        db.query(LabOrder)
        .options(
            joinedload(LabOrder.test),
            joinedload(LabOrder.patient),
        )
        .order_by(LabOrder.id.desc())
    )

    if status:
        query = query.filter(LabOrder.status == status)

    return [report_data(order) for order in query.limit(100).all()]


@router.get("/orders/{oid}")
def get_order(
    oid: int,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
):
    order = (
        db.query(LabOrder)
        .options(
            joinedload(LabOrder.test),
            joinedload(LabOrder.patient),
        )
        .filter(LabOrder.id == oid)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found.")

    return report_data(order)


@router.post("/orders/{oid}/result")
def save_result(
    oid: int,
    d: ResultIn,
    db: Session = Depends(get_db),
    me: User = Depends(roles("lab")),
):
    order = db.get(LabOrder, oid)

    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found.")

    # Store only a reviewed, verified result as final.
    # AI summaries remain drafts and must not replace findings.
    order.result = d.result
    order.report_url = d.report_url
    order.status = "done"
    order.done_at = datetime.now(timezone.utc)

    # These assignments require matching SQLAlchemy model fields.
    order.report_type = d.report_type
    order.findings = d.findings
    order.impression = d.impression
    order.images = d.images
    order.measurements = d.measurements
    order.ai_summary = d.ai_summary

    try:
        audit(db, me, "result", "lab_order", order.id)
        db.commit()
        db.refresh(order)

        # Re-fetch relationships after the commit.
        saved = (
            db.query(LabOrder)
            .options(
                joinedload(LabOrder.test),
                joinedload(LabOrder.patient),
            )
            .filter(LabOrder.id == oid)
            .first()
        )
        return report_data(saved)

    except Exception:
        db.rollback()
        raise
