import os
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
from datetime import date
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as c:
    def login(email, pw="password123"):
        r = c.post("/auth/login", json={"email": email, "password": pw}); assert r.status_code == 200, r.text
        return {"Authorization": "Bearer " + r.json()["token"]}
    rec, doc, ph, acc, hr = (login("reception@hospital.com"), login("doctor@hospital.com"), login("pharmacy@hospital.com"),
                             login("accounts@hospital.com"), login("hr@hospital.com"))
    adm = login("admin@hospital.com", "admin123")

    p = c.post("/patients", headers=rec, json={"name": "Ramesh Pawar", "age": 45, "gender": "M", "phone": "9999999999"}).json()
    doctors = c.get("/users/doctors", headers=rec).json()
    a = c.post("/appointments", headers=rec, json={"patient_id": p["id"], "doctor_id": doctors[0]["id"], "date": str(date.today()),
                                                   "pay_mode": "cash"}).json()
    print("appointment", a["token"], a["invoice_status"])
    r = c.post("/consultations", headers=doc, json={"appointment_id": a["id"], "disease": "Fever", "use_template": True, "lab_test_ids": [1]})
    print("consult", r.json())
    q = c.get("/pharmacy/queue", headers=ph).json()
    print("queue", q[0]["patient_name"], q[0]["total_tablets"], q[0]["total"])
    r = c.post(f"/pharmacy/dispense/{q[0]['prescription_id']}", headers=ph, json={"mode": "online", "reference": "UPI123"}); print("dispense", r.status_code, r.json()["pharmacy_total"])
    ov = c.get(f"/patients/{p['id']}/overview", headers=doc).json(); print("totals", ov["totals"], len(ov["prescriptions"]), len(ov["lab_orders"]))
    inv = ov["invoices"][0]
    r = c.post(f"/billing/invoices/{inv['id']}/payments", headers=rec, json={"amount": inv["due"], "mode": "cash"}); print("pay", r.json()["status"])
    print("pharmacy report", c.get(f"/pharmacy/report?start={date.today()}&end={date.today()}", headers=ph).json())

    m = date.today().strftime("%Y-%m")
    users = c.get("/users", headers=hr).json()
    c.post("/hr/attendance", headers=hr, json=[{"user_id": u["id"], "date": str(date.today()), "status": "present", "overtime_hours": 2} for u in users])
    print("gen rent", c.post(f"/accounting/recurring/generate?month={m}", headers=acc).json(), c.post(f"/accounting/recurring/generate?month={m}", headers=acc).json())
    print("payroll", c.post(f"/hr/payroll/generate?month={m}", headers=hr).json())
    pr = c.get(f"/hr/payroll?month={m}", headers=hr).json(); d = [x for x in pr if x["role"] == "doctor"][0]; print("doctor payroll", d["name"], d["paid_days"], d["commission"], d["net_pay"])
    print("paid", c.post(f"/hr/payroll/{d['id']}/pay", headers=acc, json={"mode": "online", "reference": "NEFT1"}).json()["status"])
    dash = c.get("/dashboard", headers=acc).json(); print("dash", dash["today"]["appointments"], dash["month"]["income"]["total"], dash["month"]["expenses"], dash["pending_bills"], dash["staff"]["present_today"])
    print("403 test", c.get("/accounting/summary", headers=rec).status_code)
