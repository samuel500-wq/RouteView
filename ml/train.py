"""
Train arrival-time regression models and persist the best.

Compares LinearRegression (baseline), GradientBoostingRegressor, and
RandomForestRegressor on an 80/20 split, chooses by MAE, and saves the
winning Pipeline (preprocessing + estimator) plus a metrics JSON.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ------------------------------------------------------------------ paths
ROOT = Path(__file__).resolve().parent
ART = ROOT / "artifacts"
DATA = ART / "dataset.csv"
MODEL_PATH = ART / "arrival_model.joblib"
METRICS_PATH = ART / "metrics.json"

TARGET = "seconds_to_arrival"
CATEGORICAL = ["route_id"]

MODEL_VERSION = "1.0.0"
RANDOM_STATE = 42


# ------------------------------------------------------------------ helpers
def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        print(
            f"[train] ERROR: dataset not found at {path}\n"
            f"[train] Run 'python generate_dataset.py' first.",
            file=sys.stderr,
        )
        sys.exit(1)

    df = pd.read_csv(path)

    if TARGET not in df.columns:
        print(
            f"[train] ERROR: '{TARGET}' column missing from {path}.\n"
            f"[train] Columns present: {list(df.columns)}",
            file=sys.stderr,
        )
        sys.exit(1)

    if df[TARGET].isna().any():
        n = int(df[TARGET].isna().sum())
        print(f"[train] ERROR: {n} NaN values in '{TARGET}'.", file=sys.stderr)
        sys.exit(1)

    if len(df) < 1000:
        print(
            f"[train] ERROR: only {len(df)} rows; need at least 1000.",
            file=sys.stderr,
        )
        sys.exit(1)

    return df


def build_preprocessor(numerical: list[str]) -> ColumnTransformer:
    return ColumnTransformer(
        [
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL,
            ),
            ("num", StandardScaler(), numerical),
        ]
    )


def build_candidates() -> dict[str, object]:
    return {
        "linear": LinearRegression(),
        "gbr": GradientBoostingRegressor(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            random_state=RANDOM_STATE,
        ),
        "rf": RandomForestRegressor(
            n_estimators=200,
            max_depth=12,
            n_jobs=-1,
            random_state=RANDOM_STATE,
        ),
    }


# ------------------------------------------------------------------ main
def main() -> int:
    ART.mkdir(parents=True, exist_ok=True)

    print(f"[train] loading dataset from {DATA}")
    df = load_dataset(DATA)
    print(f"[train] loaded {len(df)} rows, {len(df.columns)} columns")

    y = df[TARGET].to_numpy(dtype=np.float64)
    X = df.drop(columns=[TARGET])

    numerical = [c for c in X.columns if c not in CATEGORICAL]

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    print(f"[train] train={len(X_tr)}  test={len(X_te)}")
    print()

    results: dict[str, dict[str, float]] = {}
    best_name: str | None = None
    best_pipe: Pipeline | None = None
    best_mae = float("inf")

    for name, estimator in build_candidates().items():
        pipe = Pipeline(
            [("pre", build_preprocessor(numerical)), ("model", estimator)]
        )
        pipe.fit(X_tr, y_tr)
        pred = pipe.predict(X_te)

        mae = float(mean_absolute_error(y_te, pred))
        rmse = float(np.sqrt(mean_squared_error(y_te, pred)))

        results[name] = {"mae_seconds": mae, "rmse_seconds": rmse}

        marker = ""
        if mae < best_mae:
            best_mae, best_name, best_pipe = mae, name, pipe
            marker = "  *"

        print(
            f"[train] {name:>8s}  MAE={mae:7.1f}s ({mae/60:5.2f} min)  "
            f"RMSE={rmse:7.1f}s{marker}"
        )

    assert best_pipe is not None and best_name is not None

    print()
    print(f"[train] best model: {best_name} (MAE {best_mae:.1f}s)")

    joblib.dump(best_pipe, MODEL_PATH)
    print(f"[train] wrote model   -> {MODEL_PATH}")

    meta = {
        "model_version": MODEL_VERSION,
        "chosen": best_name,
        "features": list(X.columns),
        "categorical_features": CATEGORICAL,
        "numerical_features": numerical,
        "train_rows": int(len(X_tr)),
        "test_rows": int(len(X_te)),
        "results": results,
        "dataset": "synthetic",
        "dataset_rows": int(len(df)),
        "dataset_path": str(DATA),
        "random_state": RANDOM_STATE,
        "disclaimer": (
            "Trained on a synthetic dataset generated by ml/generate_dataset.py. "
            "Metrics describe fit to the synthetic generator, not real-world "
            "accuracy. Replace with operator telemetry before production use."
        ),
    }
    METRICS_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[train] wrote metrics -> {METRICS_PATH}")

    print()
    print(f"[train] OK  (model_version={MODEL_VERSION})")
    print("[train] Next: uvicorn service:app --port 8000")
    return 0


if __name__ == "__main__":
    sys.exit(main())