"""Compare Informer with previous-day demand on the same held-out windows."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
data = pd.read_csv(ROOT / "data/processed/electricity/ecl_10_hourly.csv")
values = data.iloc[:, 1:].to_numpy(dtype=float)
train_end = int(len(values) * .7)
mean = values[:train_end].mean(axis=0)
std = values[:train_end].std(axis=0)
if (std == 0).any():
    raise ValueError("A selected meter has zero training variance")

results = next((ROOT / "ml/Informer2020/results").glob("informer_custom_*ecl10_hourly_3h_0"))
pred = np.load(results / "pred.npy") * std + mean
true = np.load(results / "true.npy") * std + mean
test_start = len(values) - int(len(values) * .2) - 48
origins = test_start + 48 + np.arange(len(pred))
baseline = np.stack([values[origins + h - 24] for h in range(3)], axis=1)

report = {
    "unit": "kW",
    "test_windows": len(pred),
    "test_start": str(data.iloc[origins[0], 0]),
    "test_last_target": str(data.iloc[origins[-1] + 2, 0]),
    "model": "Informer, 2 epochs, 48-hour context, 3-hour forecast",
    "per_horizon": [],
}
for h in range(3):
    item = {"hour_ahead": h + 1}
    for label, estimate in (("informer", pred[:, h]), ("previous_day", baseline[:, h])):
        error = estimate - true[:, h]
        item[label + "_mae_kw"] = round(float(np.abs(error).mean()), 4)
        item[label + "_rmse_kw"] = round(float(np.sqrt((error ** 2).mean())), 4)
    report["per_horizon"].append(item)

target = ROOT / "experiments/ml/informer_evaluation.json"
target.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
