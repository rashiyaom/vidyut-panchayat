"""Train a past-only 3-hour demand forecaster and compare exact Informer test windows."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parents[1]
df = pd.read_csv(ROOT / "data/processed/electricity/ecl_10_hourly.csv", parse_dates=["date"])
y = df.iloc[:, 1:].to_numpy(dtype=np.float32)
n, meters = y.shape
train_end = int(n * .7)
val_end = n - int(n * .2)
mean = y[:train_end].mean(axis=0)
std = y[:train_end].std(axis=0)
z = (y - mean) / std
hours = df.date.dt.hour.to_numpy()
weekdays = df.date.dt.day_of_week.to_numpy()


def make_rows(start, stop):
    origins = np.arange(start, stop)
    m = np.arange(meters)
    features = []
    targets = []
    for h in range(3):
        for meter in m:
            t = origins
            features.append(np.column_stack([
                np.full(len(t), meter), np.full(len(t), h + 1),
                hours[t + h], weekdays[t + h],
                z[t - 1, meter], z[t - 2, meter], z[t - 3, meter],
                z[t - 24, meter], z[t - 48, meter], z[t - 168, meter],
                np.array([z[i-24:i, meter].mean() for i in t]),
            ]))
            targets.append(z[t + h, meter])
    return np.concatenate(features).astype(np.float32), np.concatenate(targets)


X_train, y_train = make_rows(168, train_end - 2)
X_val, y_val = make_rows(train_end, val_end - 2)
model = xgb.XGBRegressor(
    n_estimators=400, max_depth=6, learning_rate=.05,
    subsample=.8, colsample_bytree=.9, tree_method="hist",
    n_jobs=4, random_state=42, objective="reg:squarederror",
    early_stopping_rounds=20,
)
model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
OUT = ROOT / "artifacts/xgboost"
OUT.mkdir(parents=True, exist_ok=True)
model.save_model(OUT / "electricity_10_meter_3h.json")

# Fixed 80th-percentile upper residual from validation only. The same
# validation period was used for early stopping; the test period stays held out.
val_origins = np.arange(train_end, val_end - 2)
val_pred_z = model.predict(X_val).reshape(3, meters, len(val_origins)).transpose(2, 0, 1)
val_pred = val_pred_z * std + mean
val_actual = np.stack([y[val_origins + h] for h in range(3)], axis=1)
upper_residual_kw = np.maximum(0, np.quantile(val_actual - val_pred, .8, axis=0))
(OUT / "demand_buffer.json").write_text(json.dumps({
    "method": "positive 80th percentile of actual minus predicted kW",
    "validation_only": True,
    "meter_order": list(df.columns[1:]),
    "buffer_kw_by_horizon": upper_residual_kw.tolist(),
}, indent=2) + "\n")

# Match Informer's 3,456 complete test windows exactly.
origins = np.arange(val_end, val_end + 3456)
X_test, _ = make_rows(origins[0], origins[-1] + 1)
pred_z = model.predict(X_test).reshape(3, meters, len(origins)).transpose(2, 0, 1)
pred = pred_z * std + mean
actual = np.stack([y[origins + h] for h in range(3)], axis=1)
previous_day = np.stack([y[origins + h - 24] for h in range(3)], axis=1)
informer_dir = next((ROOT / "ml/Informer2020/results").glob("informer_custom_*ecl10_hourly_3h_0"))
informer = np.load(informer_dir / "pred.npy") * std + mean

report = {"unit": "kW", "test_windows": len(origins), "best_iteration": model.best_iteration,
          "train_rows": len(X_train), "validation_rows": len(X_val), "per_horizon": []}
for h in range(3):
    item = {"hour_ahead": h + 1}
    for name, estimate in (("xgboost", pred[:, h]), ("informer", informer[:, h]),
                           ("previous_day", previous_day[:, h])):
        item[name + "_mae_kw"] = round(mean_absolute_error(actual[:, h], estimate), 4)
        item[name + "_rmse_kw"] = round(float(np.sqrt(mean_squared_error(actual[:, h], estimate))), 4)
    report["per_horizon"].append(item)
(ROOT / "experiments/ml/model_comparison.json").write_text(json.dumps(report, indent=2) + "\n")
# Thirty predetermined, day-spaced held-out origins across the test period.
# Meter-to-utility mapping is illustrative; scale by training mean to profile PU.
profiles = json.loads((ROOT / "data/agents/profiles.json").read_text())["agents"]
def make_episode(offset, origin_index, actual_values, predicted_values, naive_values):
    actual_ticks, forecast_ticks, calibrated_ticks, naive_ticks = {}, {}, {}, {}
    for h in range(3):
        for tick in range(h * 6, (h + 1) * 6):
            actual_ticks[str(tick)] = {}
            forecast_ticks[str(tick)] = {}
            calibrated_ticks[str(tick)] = {}
            naive_ticks[str(tick)] = {}
            for meter, profile in enumerate(profiles):
                scale = profile["demand"] / float(mean[meter])
                actual_ticks[str(tick)][profile["id"]] = round(max(0, float(actual_values[offset, h, meter]) * scale), 2)
                forecast_ticks[str(tick)][profile["id"]] = round(max(0, float(predicted_values[offset, h, meter]) * scale), 2)
                calibrated_ticks[str(tick)][profile["id"]] = round(max(0, float(predicted_values[offset, h, meter] + upper_residual_kw[h, meter]) * scale), 2)
                naive_ticks[str(tick)][profile["id"]] = round(max(0, float(naive_values[offset, h, meter]) * scale), 2)
    return {"origin": str(df.date.iloc[origin_index[offset]]), "actualDemand": actual_ticks,
            "xgboostForecast": forecast_ticks, "calibratedForecast": calibrated_ticks,
            "previousDayForecast": naive_ticks}

def save_replay(name, selection, offsets, indices, actual_values, predicted_values, naive_values):
    replay = {"source": "UCI ElectricityLoadDiagrams20112014",
              "mapping": "10 anonymous meters mapped illustratively to 10 utilities; kW scaled by training mean to profile PU",
              "selection": selection,
              "episodes": [make_episode(int(i), indices, actual_values, predicted_values, naive_values) for i in offsets]}
    (ROOT / f"experiments/ml/{name}.json").write_text(json.dumps(replay, indent=2) + "\n")

prior_offsets = (np.linspace(0, len(origins) - 24, 30).astype(int) // 24) * 24
save_replay("replay_episodes", "30 previously inspected test days", prior_offsets, origins, actual, pred, previous_day)
validation_offsets = (np.linspace(0, len(val_origins) - 24, 20).astype(int) // 24) * 24
val_naive = np.stack([y[val_origins + h - 24] for h in range(3)], axis=1)
save_replay("replay_validation", "20 validation days used for policy selection", validation_offsets,
            val_origins, val_actual, val_pred, val_naive)
remaining = [i for i in range(0, len(origins) - 24, 24) if i not in set(prior_offsets)]
confirmation_offsets = np.array(remaining)[np.linspace(0, len(remaining)-1, 30).astype(int)]
save_replay("replay_confirmation", "30 previously uninspected test days; policy confirmation only",
            confirmation_offsets, origins, actual, pred, previous_day)
print(json.dumps(report, indent=2))
