# RouteView — 8-minute live demonstration

## Pre-flight
1. MySQL running (XAMPP). `npm run db:init && npm run seed` in `backend/`.
2. `npm run dev` in `backend/` and in `frontend/`.
3. `uvicorn service:app --port 8000` in `ml/` (after training).
4. `node fleet_sim.js` in `simulator/`.
5. Browser at http://localhost:3000.

## Script

### 1. Landing (30s)
- Highlight the two feeds (real vs simulated) in the top strip.
- Mention the demonstration-network disclaimer.

### 2. Plan a journey (90s)
- Nyabugogo → Kimironko.
- Point out: direct route R1, distance, ~minutes, demonstration fare.
- If a transfer appears, show the two-leg instruction list.

### 3. Route detail and map (60s)
- Open R1. Show ordered stops, schedules, and the coloured polyline.

### 4. Live map (60s)
- Point out orange (simulated) vs blue (GPS) markers.
- Click a vehicle, pick a stop, click “Estimate arrival”.
- Read out the response: `source: model` with a version, or
  `source: fallback` if the ML service is off.

### 5. AI assistant (90s)
- Open the dock in Kinyarwanda.
- Ask: “Nifasha kugera Kimironko nte?”
- The assistant calls `find_stops`, `plan_journey`, `fare_between` before
  answering. Point out that every fact came from a tool call, not the
  model’s memory.

### 6. Booking and ticket (60s)
- Sign in as `passenger@routeview.rw` / `Password123!`.
- Create a booking on R1. Pay (demo). Show the QR ticket.

### 7. Operator validation (60s)
- Sign in as `operator@routeview.rw` / `Password123!`.
- Open `/admin/validate`. Enter or scan the ticket.
- Attempt to redeem again. Show the duplicate-redemption rejection.

### 8. Press locker and admin (60s)
- Open `/press`. Download a published resource.
- Sign in as `operator@routeview.rw`, upload a new resource, publish it.
- Return to `/press` to show it live.

### 9. Status (30s)
- Open `/admin/status`. Point out DB, ML, AI indicators.
- Mention fallback behaviour if any component is unavailable.

## Always state
- Vehicle positions labelled “simulated” come from the local simulator.
- Fares use a documented demonstration formula.
- Payments are demonstration only.
- The arrival model is trained on synthetic data; metrics describe fit
  to that dataset, not real-world accuracy.