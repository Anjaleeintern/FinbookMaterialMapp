# MaterialMApp — Daily Delivery Entry & Quarry Logistics System

A reverse-engineered, full-stack coded application built with **Python FastAPI**, **MongoDB**, **React Native (Expo)**, and **Tailwind CSS**.

---

## 🚀 Architecture Overview

1. **Backend**: Python 3.14 + FastAPI + Motor (Async MongoDB Driver)
   - Running at: `http://localhost:8000`
   - Interactive Swagger API Docs: `http://localhost:8000/docs`
   - Direct destination routing to 6 MongoDB collections:
     - `Royalty Sale` → `royalty_sale`
     - `Without Royalty` → `without_royalty`
     - `Credit Sale` → `credit_sale`
     - `Cash Sale` → `cash_sale`
     - `QR Sale` → `qr_sale`
     - `HR Loading` → `hr_loading`
   - Zero-staging architecture: No intermediate tables, direct save with transaction IDs.
   - Master records with case-insensitive uniqueness constraints.
   - Atomic Challan sequence generator (`CH-0001`, `CH-0002`...).
   - JWT authentication (Login/Logout).

2. **Frontend & Mobile App**: React Native (Expo) + Tailwind CSS
   - Running at: `http://localhost:8081` (Chrome Web)
   - Mobile Ready: Open in Expo Go on Android / iOS
   - Pixel-accurate reconstruction of the AppSheet **MaterialMApp** interface (Screenshots 1–5):
     - Dark teal header (`#134e4a`) with search, refresh, and profile dropdown (Logout).
     - Left sidebar with active highlights (`Dashboard`, `All Entries`, `Masters Sheet`, `About`).
     - Interactive All Entries data grid matching Screenshot 2.
     - Delivery Entries Form modal matching Screenshots 3–5 with stepper controls `[-] [+]`.
     - Masters Management view matching Screenshot 1 with unique addition & deduplication.
     - Zero hardcoded data: Everything is dynamically driven by the MongoDB database.

---

## 📋 Running the Application Locally

### 1. Start the FastAPI Backend
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Seed Initial Masters and Records (If needed)
```bash
cd backend
python seed.py
```

### 3. Run Backend Automated Tests
```bash
python -m pytest backend/tests/test_api.py -v
```

### 4. Start the React Native / Web Frontend
```bash
cd frontend
npx expo start --web --port 8081
```

---

## 🔑 Default Login Credentials

- **Email:** `admin@materialmapp.com`
- **Password:** `admin123`

---

## 📐 Formulas & Conditional Business Rules

| Rule / Formula | Implementation |
|---|---|
| **NET WT** | `max(0, G.WT - T.WT)` (Reactive + Backend verified) |
| **Amount** | `NET WT > 0 ? ((NET WT / 1000) * Rate) : (CUM * Rate)` |
| **GST Visibility** | `[Type/Mode] == "Royalty Sale" OR ([Type/Mode] == "HR Loading" AND [HR Loading Type] == "With Royalty")` |
| **GST Amount** | `(Amount * GST Rate) / 100` |
| **Total Amount** | `Amount + GST Amount` |
| **Payment Mode** | Visible only for `Cash Sale` (default `Cash`) and `QR Sale` (default `QR`) |
| **Master Uniqueness** | Strict deduplication on `VehicleNo`, `TransportName`, `MaterialName`, `PartyName` |
