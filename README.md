# Hospital ERP — FastAPI + PostgreSQL + React Native (Android, iOS, Web)

## 1. Run the backend
```bash
docker compose up --build          # PostgreSQL + API on http://localhost:8000
# or without Docker:
cd backend && pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/hospital
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs  ·  Tables and demo data are created automatically on first start.
Smoke test of the whole flow (uses SQLite): `cd backend && python test_flow.py`

## 2. Run the app (Expo)
```bash
npx create-expo-app@latest hospital-app --template blank
cd hospital-app
npx expo install react-native-web react-dom @expo/metro-runtime @react-native-async-storage/async-storage
# copy this repo's frontend/App.js and frontend/src/ into hospital-app/ (replace App.js)
npx expo start          # press w = web, a = Android, i = iOS, or scan the QR with Expo Go
```
Phone on Wi-Fi: `EXPO_PUBLIC_API_URL=http://<your-computer-IP>:8000 npx expo start`

## 3. Demo logins
| Role | Email | Password |
|---|---|---|
| Admin | admin@hospital.com | admin123 |
| Doctor | doctor@hospital.com | password123 |
| Receptionist | reception@hospital.com | password123 |
| Pharmacist | pharmacy@hospital.com | password123 |
| Lab | lab@hospital.com | password123 |
| Accountant | accounts@hospital.com | password123 |
| HR | hr@hospital.com | password123 |
| Nurse | nurse@hospital.com | password123 |

Change all passwords and set SECRET_KEY before real use.

## Flow to try
Receptionist: add patient → book appointment (collect fee cash/online) →
Doctor: My patients → Consult → tap disease (medicines auto-fill) → Save →
Pharmacist: Prescription queue shows patient, tablets and total → Dispense (cash/online) →
Accountant: Billing / Accounts / Dashboard → HR: Attendance → Salary → Pay.
