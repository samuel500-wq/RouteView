# RouteView architecture

## High-level

    ┌───────────────┐        ┌──────────────────┐        ┌──────────────┐
    │  Next.js      │  HTTP  │  Node / Express  │  SQL   │  MySQL       │
    │  (browser)    │◄──────►│  API             │◄──────►│  (XAMPP)     │
    └──────┬────────┘        └───────┬──────────┘        └──────────────┘
           │                         │
           │                         ├──► FastAPI  /predict  ──► Python model
           │                         │                            (joblib)
           │                         │
           │                         └──► OpenRouter  chat/completions
           │                              (with tool calling)
           │
    ┌──────┴────────┐
    │  Leaflet map  │
    └───────────────┘

    ┌───────────────┐        ┌──────────────────┐
    │ ESP32 / GPS   │  POST  │  /api/vehicles/  │
    │ or simulator  │───────►│  ingest          │
    └───────────────┘        └────────┬─────────┘
                                      │
                                      ▼
                              vehicle_positions table
                              (source = gps | simulator)

## Process boundaries

- **Frontend (Next.js 14)** — passenger experience and admin dashboard.
  Talks only to the Node API. Never sees secrets.
- **Node/Express API** — auth, transport data, bookings, tickets,
  AI orchestration, admin CRUD, file uploads.
- **Python ML service (FastAPI)** — pure numerical arrival-time
  prediction. Stateless, no DB access.
- **OpenRouter** — natural-language understanding and conversation.
  Invoked only from the Node backend, using server-side secrets.
- **MySQL** — single source of truth for transport data, users, bookings,
  tickets, alerts, and press resources.
- **Simulator / ESP32** — both publish to the same ingestion endpoint,
  distinguishing themselves via the `source` field.

## Responsibility split — model vs LLM

| Concern                                   | Handled by      |
|-------------------------------------------|-----------------|
| Natural-language understanding            | OpenRouter LLM  |
| Conversational reply generation           | OpenRouter LLM  |
| Tool selection / orchestration            | OpenRouter LLM  |
| Actual numeric arrival-time prediction    | Python model    |
| Authoritative transport facts (routes,    | MySQL + Node    |
| fares, vehicle positions, alerts)         |                 |

The LLM is never trusted to invent bus positions, routes, or fares.
Those values come from tool calls that hit the Node backend.

## Data provenance

Every vehicle position row carries a `source`:

- `simulator` — produced by `simulator/fleet_sim.js`.
- `gps`       — produced by an ESP32 or other GPS device.
- `manual`    — inserted by an operator.

The UI uses `source` to label markers. Positions labelled `simulator`
are visually distinct (amber) and never presented as verified GPS.

The arrival-time model is trained on synthetic data
(`ml/generate_dataset.py`). Metrics reported by `ml/train.py` describe
fit to the synthetic generator, not real-world accuracy. This is stated
in `ml/artifacts/metrics.json` and in the model card (`docs/MODEL.md`).

## Extensibility

- **Replacing the ML model** — retrain with real telemetry, bump
  `model_version`, restart the ML service. The Node backend picks it up
  automatically because it only speaks to `/predict` over HTTP.
- **Replacing the LLM provider** — set `OPENROUTER_BASE_URL` and
  `OPENROUTER_MODEL` to any OpenAI-compatible endpoint. The tool-calling
  loop in `backend/src/ai/openrouter.js` uses the OpenAI chat-completions
  contract.
- **Adding a real GPS fleet** — provision one operator account per
  device, add HMAC signing at the ingestion endpoint, disable the
  simulator in production.
- **Adding a payment provider** — replace the `confirmDemoPayment`
  body in `backend/src/services/tickets.js` with a provider-specific
  handler; the rest of the ticketing flow is unchanged.