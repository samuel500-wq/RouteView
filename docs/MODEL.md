# Arrival-time model card

## Version
1.0.0 (see `ml/artifacts/metrics.json` after training).

## Intended use
Estimate seconds until a vehicle reaches a target stop on the RouteView
demonstration network. Serves the passenger-facing arrival widget and the
`arrival_estimate` tool that the AI assistant can call.

## Out-of-scope use
- Do not use for safety-critical dispatch.
- Do not present estimates as real-world performance without validating
  against operator telemetry.

## Data

**Synthetic.** 60,000 rows produced by `ml/generate_dataset.py` from a
plausible Kigali speed/route model, with dwell penalties and Gaussian noise.

Columns:
- `route_id` (int, categorical)
- `hour_of_day` (0–23)
- `day_of_week` (0–6)
- `distance_remaining_m`
- `recent_speed_kmh`
- `remaining_stops`
- `delay_indicator` (0–1)
- `seconds_to_arrival` (target)

**Why synthetic.** Verified historical bus telemetry was not available at
the time of writing. The dataset is documented so that the model can be
retrained on real data by swapping `ml/artifacts/dataset.csv`.

## Training
`python train.py`

Compares:
- LinearRegression (baseline)
- GradientBoostingRegressor
- RandomForestRegressor

on an 80/20 split with fixed seed. The best model by MAE is saved as a
single sklearn `Pipeline` (preprocessing + estimator) to
`ml/artifacts/arrival_model.joblib`. All metrics are written to
`ml/artifacts/metrics.json`.

## Reported metrics
Metrics reflect **fit to the synthetic generator**, not real-world
accuracy. The JSON file records this in the `disclaimer` field.

## Serving
`uvicorn service:app --port 8000` exposes `POST /predict`.

The Node backend calls this endpoint from
`backend/src/services/arrival.js`. When the service is unreachable or the
artifact is missing, the backend falls back to a constant-speed estimate
and the response is labelled `source: 'fallback'`.

## Retraining
1. Replace `ml/artifacts/dataset.csv` with real telemetry matching the
   same columns.
2. Bump `model_version` in `train.py`.
3. `python train.py`
4. Restart the FastAPI service.

The Node backend distinguishes estimates from different model generations
via the `model_version` field it returns to the client.

## Limitations
- Trained on synthetic trajectories; distribution shift likely.
- Assumes no incident or road-closure multipliers.
- Single transfer maximum is enforced by the journey planner, not by
  this model.