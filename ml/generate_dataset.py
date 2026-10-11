"""
Generate a synthetic arrival-time dataset for Kigali demonstration routes.

The dataset is SYNTHETIC. It encodes plausible physics (distance, speed,
time-of-day congestion) and stop dwell penalties. Performance metrics from
training on this dataset describe fit to the synthetic generator, NOT
real-world accuracy. Replace with operator telemetry when available.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# ------------------------------------------------------------------ config
SEED = 42
N = 60_000
ROUTES = np.arange(1, 9, dtype=np.int64)  # 8 demonstration routes
OUT = Path(__file__).resolve().parent / "artifacts" / "dataset.csv"

EXPECTED_COLUMNS = [
    "route_id",
    "hour_of_day",
    "day_of_week",
    "distance_remaining_m",
    "recent_speed_kmh",
    "remaining_stops",
    "delay_indicator",
    "seconds_to_arrival",
]


# ------------------------------------------------------------- generation
def generate(n: int = N, seed: int = SEED) -> pd.DataFrame:
    """Produce the synthetic dataset as a pandas DataFrame."""
    rng = np.random.default_rng(seed)

    route_id = rng.choice(ROUTES, size=n).astype(np.int64)
    hour_of_day = rng.integers(0, 24, size=n, dtype=np.int64)
    day_of_week = rng.integers(0, 7, size=n, dtype=np.int64)

    distance_remaining_m = rng.uniform(150.0, 12_000.0, size=n)

    # Time-of-day speed model:
    #   peak   07:00-09:59 and 17:00-19:59 -> ~15 km/h
    #   night  22:00-05:59                 -> ~30 km/h
    #   other                              -> ~24 km/h
    is_peak = ((hour_of_day >= 7) & (hour_of_day <= 9)) | \
              ((hour_of_day >= 17) & (hour_of_day <= 19))
    is_night = (hour_of_day >= 22) | (hour_of_day <= 5)

    mean_speed = np.where(is_peak, 15.0, np.where(is_night, 30.0, 24.0))
    std_speed = np.where(is_peak, 3.0, np.where(is_night, 4.0, 4.0))

    recent_speed_kmh = rng.normal(mean_speed, std_speed) + (route_id - 4.5) * 0.4
    recent_speed_kmh = np.maximum(6.0, recent_speed_kmh)

    remaining_stops = rng.integers(0, 12, size=n, dtype=np.int64)
    delay_indicator = rng.uniform(0.0, 1.0, size=n)

    # Ground-truth arrival time = travel time + dwell + noise.
    speed_mps = np.maximum(
        2.0, (recent_speed_kmh / 3.6) * (1.0 - 0.35 * delay_indicator)
    )
    travel_seconds = distance_remaining_m / speed_mps

    dwell_per_stop = rng.uniform(15.0, 45.0, size=n)
    dwell_seconds = remaining_stops * dwell_per_stop

    noise = rng.normal(0.0, 25.0, size=n)

    seconds_to_arrival = np.maximum(20.0, travel_seconds + dwell_seconds + noise)

    return pd.DataFrame(
        {
            "route_id": route_id,
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
            "distance_remaining_m": distance_remaining_m,
            "recent_speed_kmh": recent_speed_kmh,
            "remaining_stops": remaining_stops,
            "delay_indicator": delay_indicator,
            "seconds_to_arrival": seconds_to_arrival,
        }
    )


# ------------------------------------------------------------------- main
def main() -> int:
    print(f"[generate_dataset] seed={SEED} n={N}")
    print(f"[generate_dataset] output -> {OUT}")

    # 1. Prepare output directory
    try:
        OUT.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"[generate_dataset] ERROR: cannot create {OUT.parent}: {exc}",
              file=sys.stderr)
        return 1

    # 2. Generate
    try:
        df = generate()
    except Exception as exc:  # noqa: BLE001 - we want a clean message, not a traceback
        print(f"[generate_dataset] ERROR during generation: {exc}", file=sys.stderr)
        return 1

    # 3. Validate before writing
    if list(df.columns) != EXPECTED_COLUMNS:
        print(f"[generate_dataset] ERROR: unexpected columns {list(df.columns)}",
              file=sys.stderr)
        return 1
    if len(df) != N:
        print(f"[generate_dataset] ERROR: expected {N} rows, got {len(df)}",
              file=sys.stderr)
        return 1
    if df.isna().any().any():
        nan_cols = df.columns[df.isna().any()].tolist()
        print(f"[generate_dataset] ERROR: NaN values in columns {nan_cols}",
              file=sys.stderr)
        return 1

    # 4. Write
    try:
        df.to_csv(OUT, index=False)
    except OSError as exc:
        print(f"[generate_dataset] ERROR writing CSV: {exc}", file=sys.stderr)
        return 1

    # 5. Report
    print(f"[generate_dataset] wrote {len(df)} rows -> {OUT}")
    print()
    print(df.describe().T)
    print()
    print("[generate_dataset] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())