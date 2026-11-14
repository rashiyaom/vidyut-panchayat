"""Generate frozen-date replay episodes from saved XGBoost weights, without training."""
import hashlib
import json
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--revision", action="store_true", help="Use the frozen second-audit policy and dates")
args = parser.parse_args()
prefix = "revision" if args.revision else "fresh"
protocol_path = ROOT / f"experiments/ml/{'revision_audit' if args.revision else 'fresh_policy_audit'}_protocol.json"
protocol_bytes = protocol_path.read_bytes()
protocol = json.loads(protocol_bytes)
data_path = ROOT / "data/processed/electricity/ecl_10_hourly.csv"
model_path = ROOT / "artifacts/xgboost/electricity_10_meter_3h.json"
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
if sha(data_path) != protocol["processedDataSha256"] or sha(model_path) != protocol["savedModelSha256"]:
    raise ValueError("Frozen dataset or model checksum changed")
if sha(ROOT / protocol.get("policySourceFile", "experiments/ml/policy_selected.json")) != protocol["frozenPolicySha256"]:
    raise ValueError("Frozen policy changed")
for source in protocol["priorSources"]:
    if sha(ROOT / source["file"]) != source["sha256"]:
        raise ValueError(f"Previously used date source changed: {source['file']}")

df = pd.read_csv(data_path, parse_dates=["date"])
y = df.iloc[:, 1:].to_numpy(dtype=np.float32)
train_end = int(len(y) * .7)
test_start = len(y) - int(len(y) * .2)
mean = y[:train_end].mean(axis=0)
std = y[:train_end].std(axis=0)
if np.any(std == 0):
    raise ValueError("Training meter has zero variance")
z = (y - mean) / std
timestamp_index = {str(timestamp): i for i, timestamp in enumerate(df.date)}
origin_indices = [timestamp_index[date] for date in protocol["dates"]]
if len(set(origin_indices)) != 30 or any(i < test_start or i + 2 >= len(y) for i in origin_indices):
    raise ValueError("Frozen dates are not 30 distinct complete test windows")
features = []
for t in origin_indices:
    for h in range(3):
        target_time = df.date.iloc[t + h]
        for m in range(y.shape[1]):
            features.append([
                m, h + 1, target_time.hour, target_time.day_of_week,
                z[t - 1, m], z[t - 2, m], z[t - 3, m],
                z[t - 24, m], z[t - 48, m], z[t - 168, m],
                z[t - 24:t, m].mean(),
            ])
model = xgb.XGBRegressor()
model.load_model(model_path)
prediction = model.predict(np.asarray(features, dtype=np.float32)).reshape(30, 3, y.shape[1]) * std + mean
actual = np.stack([y[t:t + 3] for t in origin_indices])
previous_day = np.stack([y[t - 24:t - 21] for t in origin_indices])
buffer = json.loads((model_path.parent / "demand_buffer.json").read_text())
meters = list(df.columns[1:])
if meters != buffer["meter_order"] or meters != json.loads((data_path.parent / "manifest.json").read_text())["selected_meters"]:
    raise ValueError("Meter order differs from training artifacts")
upper = np.asarray(buffer["buffer_kw_by_horizon"])
profiles = json.loads((ROOT / "data/agents/profiles.json").read_text())["agents"]
if len(profiles) != y.shape[1] or upper.shape != (3, y.shape[1]):
    raise ValueError("Profile or residual-buffer shape changed")

episodes = []
for row, t in enumerate(origin_indices):
    series = {name: {} for name in ("actualDemand", "xgboostForecast", "calibratedForecast", "previousDayForecast")}
    for h in range(3):
        for tick in range(h * 6, (h + 1) * 6):
            key = str(tick)
            for values in series.values():
                values[key] = {}
            for m, profile in enumerate(profiles):
                scale = profile["demand"] / float(mean[m])
                for name, kw in (
                    ("actualDemand", actual[row, h, m]),
                    ("xgboostForecast", prediction[row, h, m]),
                    ("calibratedForecast", prediction[row, h, m] + upper[h, m]),
                    ("previousDayForecast", previous_day[row, h, m]),
                ):
                    series[name][key][profile["id"]] = round(max(0, float(kw) * scale), 2)
    episodes.append({"origin": protocol["dates"][row], **series})

replay = {
    "source": "UCI ElectricityLoadDiagrams20112014",
    "mapping": "10 anonymous meters mapped illustratively to 10 utilities; kW scaled by training mean to profile PU",
    "selection": "Frozen fresh policy-audit protocol; no allocation outcomes used to select dates",
    "protocolSha256": hashlib.sha256(protocol_bytes).hexdigest(),
    "episodes": episodes,
}
out = ROOT / f"experiments/ml/replay_{prefix}_audit.json"
out.write_text(json.dumps(replay, indent=2) + "\n")
forecast_metrics = [{
    "hourAhead": h + 1,
    "xgboostMaeKw": round(float(np.abs(prediction[:, h] - actual[:, h]).mean()), 4),
    "previousDayMaeKw": round(float(np.abs(previous_day[:, h] - actual[:, h]).mean()), 4),
} for h in range(3)]
(ROOT / f"experiments/ml/{prefix}_audit_forecast_metrics.json").write_text(json.dumps({
    "episodeCount": 30, "meterCount": len(meters), "unit": "kW", "perHorizon": forecast_metrics,
}, indent=2) + "\n")
print(json.dumps({"episodes": len(episodes), "first": episodes[0]["origin"], "last": episodes[-1]["origin"],
                  "forecastMetrics": forecast_metrics}, indent=2))
