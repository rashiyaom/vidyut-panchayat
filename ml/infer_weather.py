"""Forecast three Lisbon weather hours from saved models and past ERA5 readings."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import xgboost as xgb

from weather_features import ROOT, DATA, features, load

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--date", required=True, help="Electricity replay date in Portugal, YYYY-MM-DD")
parser.add_argument("--activate", action="store_true", help="Bundle this weather report into the browser replay")
args = parser.parse_args()
try:
    local_origin = datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=ZoneInfo("Europe/Lisbon"))
except ValueError as error:
    parser.error(str(error))
utc_origin = local_origin.astimezone(timezone.utc).replace(tzinfo=None)
frame, values = load()
matches = np.flatnonzero(frame.time_utc.to_numpy() == np.datetime64(utc_origin))
if len(matches) != 1:
    parser.error("Origin is outside the weather dataset")
origin = int(matches[0])
evaluation = json.loads((ROOT / "experiments/ml/weather_model_evaluation.json").read_text())
test_start = int(len(values) - len(values) * .2)
if origin < test_start or origin + 2 >= len(values):
    parser.error("Date must have three complete hours in the held-out weather test period")
matrix = features(frame, values, [origin])
weather = {}
for label, column in (("wind_speed_10m", 2), ("precipitation", 1)):
    artifact = ROOT / f"artifacts/weather/{label}_3h.json"
    expected_hash = evaluation["targets"][label]["model_sha256"]
    actual_hash = hashlib.sha256(artifact.read_bytes()).hexdigest()
    if actual_hash != expected_hash:
        raise ValueError(f"Saved {label} model differs from evaluated weights")
    model = xgb.XGBRegressor()
    model.load_model(artifact)
    xgboost = np.maximum(0, model.predict(matrix))
    rows = []
    for h in range(3):
        method = evaluation["targets"][label]["selected_method_by_horizon"][h]
        options = {"xgboost": float(xgboost[h]), "persistence": float(values[origin - 1, column]),
                   "previous_day": float(values[origin + h - 24, column]), "zero_rain": 0.0}
        when_utc = frame.time_utc.iloc[origin + h].to_pydatetime().replace(tzinfo=timezone.utc)
        rows.append({
            "hourAhead": h + 1,
            "validTimeUtc": when_utc.isoformat(),
            "validTimePortugal": when_utc.astimezone(ZoneInfo("Europe/Lisbon")).isoformat(),
            "method": method,
            "forecast": round(options[method], 3),
            "xgboostForecast": round(options["xgboost"], 3),
            "persistenceForecast": round(options["persistence"], 3),
            "actualReanalysis": round(float(values[origin + h, column]), 3),
        })
    weather[label] = {"unit": evaluation["targets"][label]["unit"],
                      "modelSha256": actual_hash, "rows": rows}
manifest = json.loads((ROOT / "data/processed/weather/manifest.json").read_text())
if hashlib.sha256(DATA.read_bytes()).hexdigest() != evaluation["processed_data_sha256"]:
    raise ValueError("Processed weather data differ from evaluated data")
report = {
    "version": 1,
    "originPortugal": local_origin.isoformat(),
    "originUtc": utc_origin.replace(tzinfo=timezone.utc).isoformat(),
    "source": manifest["documentation"],
    "sourceSha256": manifest["source_sha256"],
    "processedDataSha256": evaluation["processed_data_sha256"],
    "gridCell": manifest["returned_grid_cell"],
    "weather": weather,
    "limitations": "ERA5 reanalysis is a historical reference, not a live sensor or archived forecast. The rainfall model underperformed simple baselines; the validation-selected forecast uses persistence/zero rain. No outage risk is inferred.",
}
out = ROOT / f"experiments/ml/weather_inference_{args.date}.json"
out.write_text(json.dumps(report, indent=2) + "\n")
if args.activate:
    (ROOT / "data/ml/weather_browser_replay_v1.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"report": str(out.relative_to(ROOT)), "browserActivated": args.activate,
                  "windMethods": [row["method"] for row in weather["wind_speed_10m"]["rows"]],
                  "rainMethods": [row["method"] for row in weather["precipitation"]["rows"]]}, indent=2))
