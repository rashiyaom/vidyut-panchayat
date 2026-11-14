# Machine Learning Pipeline (`ml/`)

This directory contains the **Python training, inference, feature engineering, and data preparation pipeline** for the electricity demand and coastal weather forecasting models used by Vidyut Panchayat.

---

## Directory Roles & Architecture

To keep concerns strictly separated and prevent confusion across the repository:

| Directory | Role | Language / Environment | Primary Artifacts |
|---|---|---|---|
| **`ml/`** (This folder) | **Training & Inference Pipeline** | Python 3.10+ (`ml/requirements-inference.txt`) | Model training scripts, feature engineering, offline data preparation |
| **`data/ml/`** | **Bundled Browser Replays** | JSON (Consumed by TypeScript/Browser) | `browser_replay_v1.json`, `weather_browser_replay_v1.json` |
| **`experiments/ml/`** | **Frozen Evaluation Audits** | JSON / Markdown (Audit evidence) | Policy optimization reports, 30-day frozen audits, jury evidence |
| **`artifacts/`** | **Trained Weights & Buffers** | JSON / ONNX / Binaries | XGBoost booster trees, Informer checkpoints, error buffers |

---

## Key Pipeline Scripts

### 1. Data Preparation
- `prepare_electricity.py`: Ingests and cleans the 15-minute / hourly electricity load archive (UCI Dataset #321).
- `prepare_weather.py`: Extracts and normalizes 2013–2014 ERA5 surface wind speed (10m) and precipitation reanalysis for Lisbon / coastal coordinates.
- `prepare_grid_telemetry.py`: Ingests ENTSO-E Portugal national load profiles for grid telemetry validation.
- `weather_features.py`: Computes cyclical temporal encodings, lag features, and rolling metrics for weather models.

### 2. Model Training & Comparison
- `train_xgboost.py`: Trains multi-output gradient-boosted regression trees for 1-hour, 2-hour, and 3-hour ahead demand forecasting.
- `train_weather.py`: Trains dedicated XGBoost models for wind speed and evaluates precipitation forecasting against baseline persistence.
- `train_electricity.sh`: Automation script for running Informer transformer baselines via `ml/Informer2020/`.
- `evaluate_electricity.py`: Generates comparative error benchmarks (`experiments/ml/model_comparison.json`) across XGBoost, Informer, and persistence.

### 3. Inference & Replay Export
- `infer_electricity.py`: Generates multi-horizon demand forecasts on held-out test dates (e.g., `2014-08-10`, `2014-09-15`).
- `infer_weather.py`: Evaluates coastal storm and wind forecasts for historical weather sensitivity integration.
- `build_fresh_audit.py`: Executes deterministic frozen policy audits over held-out episodes without model retraining.

---

## Environment Setup & Reproduction

```bash
# 1. Create a virtual environment
python3 -m venv ml/.venv
source ml/.venv/bin/activate

# 2. Install inference & training dependencies
pip install -r ml/requirements-inference.txt

# 3. Run inference on a held-out test date
python3 ml/infer_electricity.py --date 2014-09-15
python3 ml/infer_weather.py --date 2014-09-15
```
