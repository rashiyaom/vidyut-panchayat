"""Past-only hourly weather features shared by training and saved-model inference."""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/processed/weather/lisbon_era5_hourly.csv"
LOOKBACK = 168
HORIZON = 3
VARIABLES = ("temperature_2m", "precipitation", "wind_speed_10m")
FEATURES = (["hour_ahead", "target_hour_sin", "target_hour_cos", "target_year_sin", "target_year_cos"]
            + [f"{name}_lag_{lag}" for name in VARIABLES for lag in (1, 2, 3, 6, 24, 48, 168)]
            + [f"{name}_mean_{window}" for name in VARIABLES for window in (6, 24)])


def load():
    frame = pd.read_csv(DATA, parse_dates=["time_utc"])
    if list(frame.columns) != ["time_utc", *VARIABLES]:
        raise ValueError("Weather column order changed")
    values = frame[list(VARIABLES)].to_numpy(dtype=np.float32)
    if not np.isfinite(values).all():
        raise ValueError("Weather data contain missing or infinite values")
    return frame, values


def features(frame, values, origins):
    origins = np.asarray(origins, dtype=np.int32)
    if origins.min() < LOOKBACK or origins.max() + HORIZON > len(values):
        raise ValueError("Weather feature window exceeds available history")
    blocks = []
    for h in range(HORIZON):
        when = frame.time_utc.iloc[origins + h]
        hour = when.dt.hour.to_numpy()
        day = when.dt.dayofyear.to_numpy()
        columns = [np.full(len(origins), h + 1), np.sin(hour * 2 * np.pi / 24),
                   np.cos(hour * 2 * np.pi / 24), np.sin(day * 2 * np.pi / 365.25),
                   np.cos(day * 2 * np.pi / 365.25)]
        for m in range(len(VARIABLES)):
            columns.extend(values[origins - lag, m] for lag in (1, 2, 3, 6, 24, 48, 168))
        for m in range(len(VARIABLES)):
            columns.extend(np.stack([values[origins - lag, m] for lag in range(1, window + 1)]).mean(axis=0)
                           for window in (6, 24))
        blocks.append(np.column_stack(columns).astype(np.float32))
    matrix = np.concatenate(blocks)
    if matrix.shape[1] != len(FEATURES):
        raise ValueError("Weather feature schema changed")
    return matrix


def targets(values, origins, column):
    return np.concatenate([values[np.asarray(origins) + h, column] for h in range(HORIZON)])


def unpack(predictions, count):
    return np.asarray(predictions).reshape(HORIZON, count).T
