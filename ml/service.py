from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from inference import predict, load   # absolute import when CWD is ml/

app = FastAPI(title="RouteView ML inference")

class Features(BaseModel):
    route_id: int = Field(ge=0)
    hour_of_day: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    distance_remaining_m: float = Field(ge=0)
    recent_speed_kmh: float = Field(ge=0)
    remaining_stops: int = Field(ge=0)
    delay_indicator: float = Field(ge=0, le=1)

@app.on_event("startup")
def warm():
    try:
        load()
    except Exception as e:
        print(f"[ml] warning: model not loaded at startup: {e}")

@app.get("/health")
def health():
    try:
        _, meta = load()
        return {
            "ok": True,
            "model_version": meta.get("model_version"),
            "chosen": meta.get("chosen"),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/predict")
def do_predict(f: Features):
    try:
        return predict(f.model_dump())
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))