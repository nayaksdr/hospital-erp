from datetime import datetime, date
from sqlalchemy import (Column, Integer, String, Date, DateTime, Boolean, ForeignKey,
                        Numeric, Text, Float, UniqueConstraint)
from sqlalchemy.orm import relationship
from .db import Base
from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB

Money = Numeric(12, 2, asdecimal=False)
ROLES = ["admin", "doctor", "nurse", "receptionist", "pharmacist", "lab", "accountant", "hr"]


class User(Base):  # every staff member, doctors included
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False, index=True)
    base_salary = Column(Money, default=0)
    joining_date = Column(Date, default=date.today)
    is_active = Column(Boolean, default=True)
    specialization = Column(String(120))          # doctors
    consultation_fee = Column(Money, default=0)   # doctors
    commission_pct = Column(Float, default=0)     # doctors: % of consultation fees


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    uhid = Column(String(20), unique=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    age = Column(Integer)
    gender = Column(String(10))
    phone = Column(String(20), index=True)
    address = Column(Text)
    blood_group = Column(String(5))
    allergies = Column(Text)
    emergency_contact = Column(String(120))
    created_at = Column(DateTime, default=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    time = Column(String(10))
    token = Column(Integer)
    status = Column(String(20), default="booked")  # booked/checked_in/consulted/cancelled
    reason = Column(Text)
    fee = Column(Money, default=0)
    patient = relationship("Patient")
    doctor = relationship("User")


class Consultation(Base):
    __tablename__ = "consultations"
    id = Column(Integer, primary_key=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), unique=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    disease = Column(String(160), index=True)
    notes = Column(Text)
    follow_up_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)


class Medicine(Base):
    __tablename__ = "medicines"
    id = Column(Integer, primary_key=True)
    name = Column(String(160), nullable=False, index=True)
    strength = Column(String(40))
    price = Column(Money, default=0)           # per tablet / unit
    stock = Column(Integer, default=0)
    reorder_level = Column(Integer, default=20)
    expiry_date = Column(Date)
    supplier = Column(String(120))


class DiseaseTemplate(Base):  # disease -> default medicines
    __tablename__ = "disease_templates"
    id = Column(Integer, primary_key=True)
    disease = Column(String(160), index=True, nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    times_per_day = Column(Integer, default=1)
    days = Column(Integer, default=1)
    medicine = relationship("Medicine")


class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), unique=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(15), default="pending", index=True)  # pending/dispensed
    created_at = Column(DateTime, default=datetime.utcnow)
    dispensed_at = Column(DateTime)
    dispensed_by = Column(Integer, ForeignKey("users.id"))
    items = relationship("PrescriptionItem", cascade="all, delete-orphan")
    patient = relationship("Patient")
    doctor = relationship("User", foreign_keys=[doctor_id])


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    id = Column(Integer, primary_key=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    times_per_day = Column(Integer, default=1)
    days = Column(Integer, default=1)
    quantity = Column(Integer, default=1)  # total tablets = times_per_day * days
    instructions = Column(String(200))
    medicine = relationship("Medicine")


class LabTest(Base):
    __tablename__ = "lab_tests"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    price = Column(Money, default=0)


class LabOrder(Base):
    __tablename__ = "lab_orders"    
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    test_id = Column(Integer, ForeignKey("lab_tests.id"))
    status = Column(String(15), default="ordered")  # ordered/done
    result = Column(Text)
    report_url = Column(String(300))
    created_at = Column(DateTime, default=datetime.utcnow)
    done_at = Column(DateTime)
    # Add inside your existing LabOrder class:
    report_type = Column(String(30), nullable=True, default="text")
    findings = Column(Text, nullable=True)
    impression = Column(Text, nullable=True)
    images = Column(JSONB, nullable=False, default=list)
    measurements = Column(JSONB, nullable=False, default=dict)
    ai_summary = Column(Text, nullable=True)
    test = relationship("LabTest")
    patient = relationship("Patient")


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), index=True)
    discount = Column(Money, default=0)
    total = Column(Money, default=0)
    paid = Column(Money, default=0)
    status = Column(String(10), default="unpaid", index=True)  # unpaid/partial/paid
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    items = relationship("InvoiceItem", cascade="all, delete-orphan")
    payments = relationship("Payment", cascade="all, delete-orphan")
    patient = relationship("Patient")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    category = Column(String(20))  # consultation/pharmacy/lab/room/procedure/other
    description = Column(String(200))
    amount = Column(Money, default=0)
    doctor_id = Column(Integer, ForeignKey("users.id"))


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), index=True)
    amount = Column(Money, nullable=False)
    mode = Column(String(10), nullable=False)  # cash / online
    category = Column(String(20), default="general")  # consultation/pharmacy/lab/general
    reference = Column(String(80))
    paid_at = Column(DateTime, default=datetime.utcnow, index=True)
    received_by = Column(Integer, ForeignKey("users.id"))


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    category = Column(String(60), index=True)  # Rent, Electricity, Medicine Purchase, Doctor Expense...
    description = Column(String(200))
    amount = Column(Money, nullable=False)
    date = Column(Date, default=date.today, index=True)
    mode = Column(String(10), default="cash")
    doctor_id = Column(Integer, ForeignKey("users.id"))
    recurring_id = Column(Integer, ForeignKey("recurring_expenses.id"))


class RecurringExpense(Base):  # building rent, internet, etc.
    __tablename__ = "recurring_expenses"
    id = Column(Integer, primary_key=True)
    title = Column(String(120))
    category = Column(String(60), default="Rent")
    amount = Column(Money)
    day_of_month = Column(Integer, default=1)
    active = Column(Boolean, default=True)


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("user_id", "date"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    date = Column(Date, index=True)
    status = Column(String(10), default="present")  # present/absent/half/leave
    check_in = Column(String(8))
    check_out = Column(String(8))
    overtime_hours = Column(Float, default=0)
    user = relationship("User")


class Payroll(Base):
    __tablename__ = "payroll"
    __table_args__ = (UniqueConstraint("user_id", "month"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    month = Column(String(7), index=True)  # YYYY-MM
    base_salary = Column(Money)
    working_days = Column(Integer)
    paid_days = Column(Float)
    overtime_hours = Column(Float, default=0)
    overtime_pay = Column(Money, default=0)
    commission = Column(Money, default=0)
    bonus = Column(Money, default=0)
    deductions = Column(Money, default=0)
    net_pay = Column(Money, default=0)
    status = Column(String(10), default="unpaid")  # unpaid/paid
    paid_mode = Column(String(10))
    paid_reference = Column(String(80))
    paid_on = Column(Date)
    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    action = Column(String(40))
    entity = Column(String(40))
    entity_id = Column(Integer)
    detail = Column(String(300))
    created_at = Column(DateTime, default=datetime.utcnow)
