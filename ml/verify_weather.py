"""Re-evaluate saved weather models and check that features exclude future readings."""
import hashlib
import json

import numpy as np
import xgboost as xgb

from weather_features import DATA, HORIZON, ROOT, features, load, unpack

frame, values = load()
report = json.loads((ROOT / "experiments/ml/weather_model_evaluation.json").read_text())
manifest = json.loads((DATA.parent / "manifest.json").read_text())
raw = ROOT / "data/raw/weather/lisbon_era5_2013_2014.json"
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
if sha(raw) != manifest["source_sha256"] or sha(DATA) != report["processed_data_sha256"]:
    raise ValueError("Weather source or processed data checksum changed")

origin = len(values) - 100
before = features(frame, values, [origin])
changed = values.copy()
changed[origin:] += 1000
if not np.array_equal(before, features(frame, changed, [origin])):
    raise ValueError("Weather forecast features read future weather measurements")

test_start = len(values) - int(len(values) * .2)
origins = np.arange(test_start, len(values) - HORIZON + 1)
if len(origins) != report["split"]["test"]["windows"]:
    raise ValueError("Weather test split changed")
matrix = features(frame, values, origins)
for label, column in (("wind_speed_10m", 2), ("precipitation", 1)):
    artifact = ROOT / f"artifacts/weather/{label}_3h.json"
    if sha(artifact) != report["targets"][label]["model_sha256"]:
        raise ValueError(f"Saved {label} model changed")
    model = xgb.XGBRegressor()
    model.load_model(artifact)
    prediction = np.maximum(0, unpack(model.predict(matrix), len(origins)))
    actual = np.stack([values[origins + h, column] for h in range(HORIZON)], axis=1)
    for h in range(HORIZON):
        mae = round(float(np.abs(prediction[:, h] - actual[:, h]).mean()), 4)
        expected = report["targets"][label]["per_horizon"][h]["xgboost_mae"]
        if abs(mae - expected) > 0.0001:
            raise ValueError(f"{label} {h + 1}h test MAE changed: {mae} versus {expected}")
print(f"Saved wind/rain models reproduce all {len(origins)} held-out windows; future-data leakage check passed.")
