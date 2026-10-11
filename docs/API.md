# RouteView API

Base URL: `http://localhost:4000`

All request and response bodies are JSON unless noted. Authentication is
Bearer JWT: `Authorization: Bearer <token>`.

Consistent error shape: `{ "error": "code" }`, optionally with
`"details"` in development.

## Health

| Method | Path      | Auth | Notes                                |
|--------|-----------|------|--------------------------------------|
| GET    | `/health` | no   | Returns `{ ok, db, env, ai_configured, ml_url }`. |

## Auth

| Method | Path                    | Auth | Notes                                     |
|--------|-------------------------|------|-------------------------------------------|
| POST   | `/api/auth/register`    | no   | Body: email, password, full_name, phone?, preferred_lang? |
| POST   | `/api/auth/login`       | no   | Body: email, password → `{ token, user }` |

## Transport (public)

| Method | Path                        | Notes                                       |
|--------|-----------------------------|---------------------------------------------|
| GET    | `/api/routes?q=`            | Search routes by code/name.                 |
| GET    | `/api/routes/:id`           | Full detail: route, stops, schedules.       |
| GET    | `/api/stops?q=`             | Search stops.                               |
| GET    | `/api/stops/:id`            | Stop detail + routes serving it.            |
| GET    | `/api/stops/near?lat&lng&limit` | Nearest stops by haversine distance.    |
| POST   | `/api/journeys/plan`        | Body: `{ fromStopId, toStopId }` → options. |

## Live tracking (public)

| Method | Path                                   | Notes                              |
|--------|----------------------------------------|------------------------------------|
| GET    | `/api/vehicles`                        | Latest position per vehicle.       |
| GET    | `/api/vehicles/:id/arrival?stop_id=`   | ML arrival estimate (or fallback). |
| POST   | `/api/vehicles/ingest`                 | Operator/admin. GPS or simulator.  |
| GET    | `/api/alerts`                          | Active service alerts.             |

## Bookings (passenger)

| Method | Path                                | Auth | Notes                          |
|--------|-------------------------------------|------|--------------------------------|
| POST   | `/api/bookings`                     | yes  | Create a booking.              |
| POST   | `/api/bookings/:id/pay-demo`        | yes  | Demonstration payment.         |
| GET    | `/api/bookings`                     | yes  | List my bookings.              |
| GET    | `/api/bookings/:id/ticket`          | yes  | Ticket + QR data URL.          |

## Tickets (operator)

| Method | Path                    | Auth              | Notes                                     |
|--------|-------------------------|-------------------|-------------------------------------------|
| POST   | `/api/tickets/redeem`   | operator / admin  | Body: `{ code }`. Duplicate-safe.         |

## AI

| Method | Path              | Auth | Notes                                          |
|--------|-------------------|------|------------------------------------------------|
| GET    | `/api/ai/status`  | no   | `{ configured: boolean }`                      |
| POST   | `/api/ai/chat`    | opt  | Body: `{ sessionKey?, message, lang, history }` |

## Press (public)

| Method | Path                              | Notes                                  |
|--------|-----------------------------------|----------------------------------------|
| GET    | `/api/press`                      | Published resources only.              |
| GET    | `/api/press/:slug/download`       | Download; published resources only.    |

## Admin (operator or admin)

| Method | Path                              | Notes                       |
|--------|-----------------------------------|-----------------------------|
| GET    | `/api/admin/overview`             | Counters for the dashboard. |
| GET    | `/api/admin/bookings?page&status` | Paginated.                  |
| GET    | `/api/admin/routes`               | With `stop_count`.          |
| POST   | `/api/admin/routes`               | Create.                     |
| PUT    | `/api/admin/routes/:id`           | Update.                     |
| DELETE | `/api/admin/routes/:id`           | Admin only.                 |
| POST   | `/api/admin/stops`                | Create.                     |
| PUT    | `/api/admin/stops/:id`            | Update.                     |
| DELETE | `/api/admin/stops/:id`            | Admin only.                 |
| GET    | `/api/admin/vehicles`             | With `last_seen`.           |
| POST   | `/api/admin/vehicles`             | Create.                     |
| PUT    | `/api/admin/vehicles/:id`         | Update.                     |
| DELETE | `/api/admin/vehicles/:id`         | Admin only.                 |
| GET    | `/api/admin/alerts`               | All alerts.                 |
| POST   | `/api/admin/alerts`               | Create.                     |
| PUT    | `/api/admin/alerts/:id`           | Update.                     |
| DELETE | `/api/admin/alerts/:id`           | Admin only.                 |
| GET    | `/api/admin/users`                | Admin only.                 |
| GET    | `/api/admin/press`                | Includes unpublished.       |
| POST   | `/api/admin/press`                | Multipart upload.           |
| PUT    | `/api/admin/press/:id/publish`    | Toggle publication.         |
| DELETE | `/api/admin/press/:id`            | Admin only.                 |
| GET    | `/api/admin/reports/summary`      | Last-30-day aggregates.     |
| GET    | `/api/admin/status`               | Runtime status.             |

## ML service (FastAPI)

| Method | Path        | Notes                                              |
|--------|-------------|----------------------------------------------------|
| GET    | `/health`   | `{ ok, model_version, chosen }`                    |
| POST   | `/predict`  | Body has features; returns `{ seconds, model_version }` |