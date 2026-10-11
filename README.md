# RouteView

Intelligent public-transportation platform for Rwanda (initial focus: Kigali).
Combines a passenger app, live fleet tracking, a trained ML arrival-time model,
an OpenRouter-powered assistant, digital ticketing, an operator dashboard and a
Virtual Press Locker.

## Stack
- Frontend: Next.js 14 (App Router) + React + TypeScript + Tailwind + Leaflet
- Backend: Node 20 + Express + MySQL (mysql2/promise) + JWT
- ML: Python 3.12, pandas/NumPy/scikit-learn/joblib, FastAPI inference
- AI: OpenRouter (server-side only), tool-calling, Kinyarwanda + English
- Hardware: ESP32 + GPS, Wokwi-compatible; local fleet simulator included

## Quickstart (Windows 10 / XAMPP)

1. Start Apache + MySQL in XAMPP.
2. `mysql -u root -e "CREATE DATABASE routeview CHARACTER SET utf8mb4;"`
3. Copy `.env.example` → `.env`, edit DB creds. (OpenRouter key optional.)
4. `cd backend && npm i && npm run db:init && npm run seed && npm run dev`
5. `cd ml && python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt`
   `python generate_dataset.py && python train.py && uvicorn service:app --port 8000`
6. `cd frontend && npm i && npm run dev`  → http://localhost:3000
7. `cd simulator && node fleet_sim.js`  (starts emitting vehicle positions)

Demo credentials (after `npm run seed`):
- passenger@routeview.rw / Password123!
- operator@routeview.rw  / Password123!
- admin@routeview.rw     / Password123!

## Data honesty
- All routes, stops, schedules, fares, and vehicle positions in the seeded
  database are **demonstration data**. Kigali is the geographic reference.
- Vehicle positions labelled `source = 'simulator'` are simulated.
  Positions labelled `source = 'gps'` come from hardware ingestion.
- The arrival-time model is trained on a **synthetic** dataset (see `ml/`),
  because verified historical bus data was not available. Metrics reported in
  `ml/artifacts/metrics.json` describe performance on synthetic data only.
- The payment step is a demonstration workflow; no real money moves.

See `docs/` for architecture, API contracts, model card and demo script.