"""Load the trained pipeline once and expose a predict() function."""
from pathlib import Path
import json
import joblib
import pandas as pd

ART = Path(__file__).parent / "artifacts"
MODEL = ART / "arrival_model.joblib"
META  = ART / "metrics.json"

_pipe = None
_meta = {}

def load():
    global _pipe, _meta
    if _pipe is None:
        if not MODEL.exists():
            raise FileNotFoundError(f"model not found at {MODEL}; run train.py")
        _pipe = joblib.load(MODEL)
        _meta = json.loads(META.read_text()) if META.exists() else {}
    return _pipe, _meta

def predict(features: dict) -> dict:
    pipe, meta = load()
    cols = meta.get("features") or list(features.keys())
    row = {c: features.get(c, 0) for c in cols}
    X = pd.DataFrame([row])
    y = float(pipe.predict(X)[0])
    return {
        "seconds": max(15.0, y),
        "model_version": meta.get("model_version", "unknown"),
        "chosen_model": meta.get("chosen"),
    }