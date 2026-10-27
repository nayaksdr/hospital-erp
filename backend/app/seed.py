from datetime import date, timedelta
from .models import (User, Medicine, DiseaseTemplate, LabTest, RecurringExpense)
from .security import hash_pw


def seed(db):
    if db.query(User).first():
        return
    staff = [
        ("Admin", "admin@hospital.com", "admin", 0, {}),
        ("Dr. Anita Joshi", "doctor@hospital.com", "doctor", 90000, dict(specialization="General Medicine", consultation_fee=500, commission_pct=20)),
        ("Dr. Rahul Patil", "doctor2@hospital.com", "doctor", 80000, dict(specialization="Pediatrics", consultation_fee=400, commission_pct=15)),
        ("Sneha Kulkarni", "reception@hospital.com", "receptionist", 18000, {}),
        ("Pooja Shinde", "nurse@hospital.com", "nurse", 22000, {}),
        ("Amit Deshmukh", "pharmacy@hospital.com", "pharmacist", 25000, {}),
        ("Kiran More", "lab@hospital.com", "lab", 24000, {}),
        ("Meera Pawar", "accounts@hospital.com", "accountant", 35000, {}),
        ("Vijay Jadhav", "hr@hospital.com", "hr", 30000, {}),
    ]
    for name, email, role, sal, extra in staff:
        db.add(User(name=name, email=email, role=role, base_salary=sal, password_hash=hash_pw("password123" if role != "admin" else "admin123"),
                    joining_date=date.today() - timedelta(days=200), **extra))
    meds = [("Paracetamol", "500mg", 1.5, 500), ("Cetirizine", "10mg", 2, 300), ("Amoxicillin", "500mg", 8, 200),
            ("Metformin", "500mg", 2.5, 400), ("Amlodipine", "5mg", 3, 300), ("Pantoprazole", "40mg", 6, 250),
            ("ORS Sachet", "", 12, 100), ("Vitamin D3", "60k IU", 20, 80)]
    ids = {}
    for n, s, p, st in meds:
        m = Medicine(name=n, strength=s, price=p, stock=st, reorder_level=40, expiry_date=date.today() + timedelta(days=500)); db.add(m); db.flush(); ids[n] = m.id
    for dis, items in {"Fever": [("Paracetamol", 3, 3)], "Cold & Cough": [("Cetirizine", 1, 5), ("Paracetamol", 2, 3)],
                       "Diabetes": [("Metformin", 2, 30)], "Hypertension": [("Amlodipine", 1, 30)],
                       "Gastritis": [("Pantoprazole", 1, 7)], "Infection": [("Amoxicillin", 3, 5), ("Paracetamol", 3, 3)]}.items():
        for n, t, d in items:
            db.add(DiseaseTemplate(disease=dis, medicine_id=ids[n], times_per_day=t, days=d))
    for n, p in [("CBC", 300), ("Blood Sugar (Fasting)", 100), ("Lipid Profile", 600), ("X-Ray Chest", 500)]:
        db.add(LabTest(name=n, price=p))
    db.add(RecurringExpense(title="Building rent", category="Rent", amount=50000, day_of_month=1))
    db.add(RecurringExpense(title="Internet & phone", category="Utilities", amount=3000, day_of_month=5))
    db.commit()
