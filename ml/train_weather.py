"""Train three-hour wind and precipitation forecasts on past-only Lisbon ERA5 data."""
import hashlib
import json
from pathlib import Path

import numpy as np
import xgboost as xgb

from weather_features import DATA, FEATURES, HORIZON, ROOT, features, load, targets, unpack

frame, values = load()
length = len(values)
train_end = int(length * 0.7)
validation_end = length - int(length * 0.2)
splits = {
    "train": np.arange(168, train_end - HORIZON + 1),
    "validation": np.arange(train_end, validation_end - HORIZON + 1),
    "test": np.arange(validation_end, length - HORIZON + 1),
}
x_train = features(frame, values, splits["train"])
x_val = features(frame, values, splits["validation"])
x_test = features(frame, values, splits["test"])
out = ROOT / "artifacts/weather"
out.mkdir(parents=True, exist_ok=True)
reports = {}
for label, column in (("wind_speed_10m", 2), ("precipitation", 1)):
    model = xgb.XGBRegressor(
        n_estimators=350, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.9, tree_method="hist",
        n_jobs=4, random_state=42, objective="reg:squarederror",
        early_stopping_rounds=25,
    )
    model.fit(x_train, targets(values, splits["train"], column),
              eval_set=[(x_val, targets(values, splits["validation"], column))], verbose=False)
    artifact = out / f"{label}_3h.json"
    model.save_model(artifact)
    val_prediction = np.maximum(0, unpack(model.predict(x_val), len(splits["validation"])))
    val_actual = np.stack([values[splits["validation"] + h, column] for h in range(HORIZON)], axis=1)
    val_persistence = np.repeat(values[splits["validation"] - 1, column, None], HORIZON, axis=1)
    val_previous_day = np.stack([values[splits["validation"] + h - 24, column] for h in range(HORIZON)], axis=1)
    prediction = np.maximum(0, unpack(model.predict(x_test), len(splits["test"])))
    actual = np.stack([values[splits["test"] + h, column] for h in range(HORIZON)], axis=1)
    persistence = np.repeat(values[splits["test"] - 1, column, None], HORIZON, axis=1)
    previous_day = np.stack([values[splits["test"] + h - 24, column] for h in range(HORIZON)], axis=1)
    metrics = []
    selection = []
    for h in range(HORIZON):
        val_candidates = {"xgboost": val_prediction[:, h], "persistence": val_persistence[:, h],
                          "previous_day": val_previous_day[:, h]}
        if label == "precipitation":
            val_candidates["zero_rain"] = np.zeros(len(splits["validation"]))
        val_mae = {name: float(np.abs(estimate - val_actual[:, h]).mean())
                   for name, estimate in val_candidates.items()}
        chosen = min(val_mae, key=val_mae.get)
        selection.append(chosen)
        row = {"hour_ahead": h + 1}
        for name, estimate in (("xgboost", prediction[:, h]), ("persistence", persistence[:, h]),
                               ("previous_day", previous_day[:, h])):
            error = estimate - actual[:, h]
            row[f"{name}_mae"] = round(float(np.abs(error).mean()), 4)
            row[f"{name}_rmse"] = round(float(np.sqrt((error ** 2).mean())), 4)
        if label == "precipitation":
            row["zero_rain_mae"] = round(float(actual[:, h].mean()), 4)
        test_candidates = {"xgboost": prediction[:, h], "persistence": persistence[:, h],
                           "previous_day": previous_day[:, h], "zero_rain": np.zeros(len(splits["test"]))}
        row["selected_method"] = chosen
        row["selected_mae"] = round(float(np.abs(test_candidates[chosen] - actual[:, h]).mean()), 4)
        row["validation_mae_by_method"] = {name: round(value, 4) for name, value in val_mae.items()}
        metrics.append(row)
    reports[label] = {
        "unit": "m/s" if label == "wind_speed_10m" else "mm/hour",
        "model_sha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
        "best_iteration": int(model.best_iteration),
        "selected_method_by_horizon": selection,
        "per_horizon": metrics,
    }
report = {
    "version": 1,
    "data_source": "Open-Meteo ERA5 reanalysis, Lisbon grid cell",
    "processed_data_sha256": hashlib.sha256(DATA.read_bytes()).hexdigest(),
    "feature_count": len(FEATURES), "features": FEATURES,
    "split": {name: {"start": str(frame.time_utc.iloc[origins[0]]),
                       "last_target": str(frame.time_utc.iloc[origins[-1] + HORIZON - 1]),
                       "windows": len(origins)} for name, origins in splits.items()},
    "targets": reports,
    "limitations": "ERA5 is reanalysis, not a weather-station observation or archived operational forecast. No cyclone or outage labels were used.",
}
result = ROOT / "experiments/ml/weather_model_evaluation.json"
result.parent.mkdir(parents=True, exist_ok=True)
result.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: value["per_horizon"] for key, value in reports.items()}, indent=2))
