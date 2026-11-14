"""Run the saved XGBoost model on one midnight origin in the held-out test period."""
import argparse
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--date", required=True, help="Held-out origin, YYYY-MM-DD")
parser.add_argument("--activate", action="store_true", help="Replace the browser's bundled replay with this report")
args = parser.parse_args()
try:
    origin_date = datetime.strptime(args.date, "%Y-%m-%d")
except ValueError as exc:
    parser.error(str(exc))

data_path = ROOT / "data/processed/electricity/ecl_10_hourly.csv"
model_path = ROOT / "artifacts/xgboost/electricity_10_meter_3h.json"
manifest = json.loads((data_path.parent / "manifest.json").read_text())
buffer = json.loads((model_path.parent / "demand_buffer.json").read_text())
revision_audit = json.loads((ROOT / "experiments/ml/revision_audit_summary.json").read_text())
if not revision_audit["passAllCriteria"]:
    raise ValueError("Revised policy did not pass its frozen audit")
selected_policy = json.loads((ROOT / "experiments/ml/policy_revision_selected.json").read_text())["selected"]
if any(selected_policy[key] != revision_audit["frozenPolicy"][key]
       for key in ("supplyFraction", "fillFraction", "bufferMultiplier", "priorityBlend")):
    raise ValueError("Revised policy differs from audited settings")
df = pd.read_csv(data_path, parse_dates=["date"])
meter_names = list(df.columns[1:])
if meter_names != manifest["selected_meters"] or meter_names != buffer["meter_order"]:
    raise ValueError("Meter order differs between dataset, manifest, and buffer")
matches = np.flatnonzero(df.date.to_numpy() == np.datetime64(origin_date))
if len(matches) != 1:
    parser.error("Date must be a present midnight in the processed dataset")
t = int(matches[0])
y = df.iloc[:, 1:].to_numpy(dtype=np.float32)
train_end = int(len(y) * .7)
test_start = len(y) - int(len(y) * .2)
if t < test_start or t + 2 >= len(y):
    parser.error(f"Date must start within the held-out test period ({df.date.iloc[test_start].date()} through {df.date.iloc[-3].date()})")
mean = y[:train_end].mean(axis=0)
std = y[:train_end].std(axis=0)
if np.any(std == 0):
    raise ValueError("Training meter has zero variance")
z = (y - mean) / std
features = []
for h in range(3):
    for m in range(len(meter_names)):
        target_time = df.date.iloc[t + h]
        features.append([
            m, h + 1, target_time.hour, target_time.day_of_week,
            z[t - 1, m], z[t - 2, m], z[t - 3, m],
            z[t - 24, m], z[t - 48, m], z[t - 168, m],
            z[t - 24:t, m].mean(),
        ])
model = xgb.XGBRegressor()
model.load_model(model_path)
prediction = model.predict(np.asarray(features, dtype=np.float32)).reshape(3, len(meter_names)) * std + mean
actual = y[t:t + 3]
previous_day = y[t - 24:t - 21]
upper_buffer = np.asarray(buffer["buffer_kw_by_horizon"])
effective_buffer = upper_buffer * selected_policy["bufferMultiplier"]
profiles = json.loads((ROOT / "data/agents/profiles.json").read_text())["agents"]
if len(profiles) != len(meter_names) or effective_buffer.shape != prediction.shape:
    raise ValueError("Profile or buffer dimensions do not match the model")
actual_demand, forecast_demand = {}, {}
for h in range(3):
    for tick in range(h * 6, (h + 1) * 6):
        actual_demand[str(tick)] = {}
        forecast_demand[str(tick)] = {}
        for m, profile in enumerate(profiles):
            scale = profile["demand"] / float(mean[m])
            actual_demand[str(tick)][profile["id"]] = round(max(0, float(actual[h, m]) * scale), 2)
            raw_pu = round(max(0, float(prediction[h, m]) * scale), 2)
            base_buffered_pu = round(max(0, float(prediction[h, m] + upper_buffer[h, m]) * scale), 2)
            forecast_demand[str(tick)][profile["id"]] = math.floor(
                max(0, raw_pu + (base_buffered_pu - raw_pu) * selected_policy["bufferMultiplier"]) * 100 + 0.5
            ) / 100

rows = []
for h in range(3):
    for m, meter in enumerate(meter_names):
        rows.append({
            "hourAhead": h + 1, "meter": meter,
            "actualKw": round(float(actual[h, m]), 3),
            "predictedKw": round(float(prediction[h, m]), 3),
            "bufferedKw": round(float(prediction[h, m] + effective_buffer[h, m]), 3),
            "previousDayKw": round(float(previous_day[h, m]), 3),
        })
metrics = [{
    "hourAhead": h + 1,
    "xgboostMaeKw": round(float(np.mean(np.abs(prediction[h] - actual[h]))), 4),
    "previousDayMaeKw": round(float(np.mean(np.abs(previous_day[h] - actual[h]))), 4),
} for h in range(3)]
report = {
    "version": 1,
    "origin": str(df.date.iloc[t]),
    "modelSha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
    "dataSha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
    "sourceSha256": manifest["source_sha256"],
    "selection": "User-selected held-out test date; saved XGBoost inference",
    "policy": {key: selected_policy[key] for key in ("name", "sha256", "supplyFraction", "fillFraction", "bufferMultiplier", "priorityBlend")},
    "meterIds": meter_names,
    "metrics": metrics,
    "meterReadings": rows,
    "actualDemand": actual_demand,
    "forecastDemand": forecast_demand,
    "supplyFraction": 1,
    "limitations": "Anonymous customer meters are mapped illustratively to utilities; cyclone supply and service impacts are simulated.",
}
out = ROOT / f"experiments/ml/inference_{args.date}.json"
out.write_text(json.dumps(report, indent=2) + "\n")
if args.activate:
    (ROOT / "data/ml/browser_replay_v1.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"report": str(out.relative_to(ROOT)), "browserActivated": args.activate,
                  "origin": report["origin"], "modelSha256": report["modelSha256"], "metrics": metrics}, indent=2))
