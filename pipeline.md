# 12-Hour Future Implementation Pipeline

## Goal

Deliver one end-to-end, defensible data and ML addition to Vidyut Panchayat: historical electricity measurements are prepared reproducibly, an XGBoost model is trained and evaluated on unseen time periods, and its demand forecasts influence the existing council's plans. Preserve the current frontend and negotiation engine. Label scripted cyclone disruptions and modeled service impacts as simulated.

## Demonstration outcome

Replay a held-out historical day. At each forecast origin, use only observations available up to that time to predict demand for the next three hours. The council uses those predictions to draft allocations. Actual held-out measurements are supplied separately as the replay unfolds. Show forecast accuracy and allocation outcomes against a simple forecasting baseline.

## Scope and assumptions

- Dataset: UCI ElectricityLoadDiagrams20112014. Record source, usage terms, downloaded-file checksum, selected meter IDs, and date range in a dataset card.
- Select ten documented meter series and aggregate 15-minute measurements to hourly mean kW. These general customers are not hospital, water, or telecom meters; mapping them to illustrative simulator utilities is an explicit assumption.
- Forecast three hourly values. Hold each hourly value across six ten-minute engine ticks; do not claim resampling creates observed ten-minute measurements.
- Convert kW to power units using one fixed scaling derived from training data and document it. Scale demand and capacities consistently.
- Train XGBoost as a pooled regressor using meter identity, hour/day calendar features, past demand lags (1, 2, 3, 24, 168 hours), past-only rolling statistics, and forecast horizon.
- Compare with seasonal naïve demand from the same hour on the previous day. An LSTM is optional only after the full pipeline works.
- Split chronologically into train, validation, and test periods. Fit transformations on training data only. Keep test periods untouched until final evaluation.
- Scripted supply and feeder disruptions remain scenario inputs shared across comparisons; this iteration does not claim to predict outages or cyclone damage.

## Schedule

| Elapsed time | Work | Exit criterion |
|---|---|---|
| 0:00–0:45 | Freeze scope, meter selection, split dates, units, data/forecast schemas, and metrics | Both owners agree on interfaces and assumptions |
| 0:45–2:00 | Download, inspect, and prepare data | Hourly series, quality report, chronological splits, provenance/checksum manifest |
| 2:00–3:30 | Train seasonal-naïve baseline and XGBoost | Saved model, validation results, held-out predictions, forecast-vs-actual plot |
| 3:30–5:30 | Add observation and forecast adapters | Engine receives actual observations and forecast snapshots separately; planner no longer reads future demand outcomes |
| 5:30–7:00 | Connect inference to planning and replay | Held-out replay runs through the app, and forecasts change proposals |
| 7:00–8:30 | Run paired model/policy comparisons | Baseline and XGBoost use identical held-out demand and disruption schedules |
| 8:30–9:30 | Add concise evidence display | UI reports model version, forecast vs actual, errors, and allocation comparison |
| 9:30–10:30 | Verify integration and address defects | No future-data leakage; units and capacity checks hold; fallback and replay behavior are recorded |
| 10:30–11:15 | Prepare technical evidence and demo notes | Dataset card, model card, results table, architecture sketch, demo script |
| 11:15–12:00 | Rehearse from a clean start and preserve a backup | Local demo works; backup recording captured |

## Suggested ownership

- **Data/model owner:** data preparation, training, forecast evaluation, and evidence panel/presentation.
- **Engine/integration owner:** forecast contract, historical replay, planner boundary, inference connection, and allocation experiments.
- **Together:** agree on the interface in the first 45 minutes, integrate by hour five, and reserve the final two hours for verification and rehearsal.

Use a clearly labeled fixture implementing the agreed forecast schema while the model is training. Replace it with actual inference before claiming the model is integrated.

## Data boundary and integration

```text
Historical observations through time t -> forecast model -> planner and negotiation
Held-out observations after time t      -> execution replay and evaluation only
```

The current planner and plan validator inspect future scripted environments. For historical evaluation, future demand measurements must not be available to planning or validation. Pass a forecast snapshot with issue time, valid time, entity ID, predicted demand, bounds, unit, model version, and data version. The engine separately receives actual replay observations as each step occurs. Keep execution-time capacity validation and safe fallback. If inference fails, use the seasonal baseline and record that fallback.

Hourly measurements can be held for the existing six ten-minute ticks per hour. Do not interpolate them and present the result as measured ten-minute data. If time permits, use a local Python inference service; precomputed predictions generated at each replay origin are an acceptable fallback when clearly identified as model inference and reproducible from training code.

## Evaluation

Run paired comparisons across held-out days using identical observations, supply schedules, feeder constraints, and communication seeds:

| Demand forecast | Allocation policy | Question |
|---|---|---|
| Previous-day seasonal naïve | Council | Baseline forecast with current negotiation |
| XGBoost | Council | Does the learned forecast change council outcomes? |
| Previous-day seasonal naïve | Static priority | Simple full-system baseline |
| XGBoost | Static priority | Separate forecast effect from negotiation effect |

Report forecasting MAE and RMSE by horizon. Report allocation unserved energy with documented units, hospital service, fairness, constraint violations, fallback frequency, and inference latency. Do not promise that the learned model or council wins; preserve and explain measured results. Keep forecast accuracy and allocation quality as distinct results.

## Repository deliverables

```text
ml/
  prepare_data.py
  train.py
  evaluate.py
  serve.py                 # optional if using precomputed inference
  requirements.txt
  config.json
artifacts/
  demand_xgboost.json
  model_metadata.json
experiments/ml/
  forecast_metrics.csv
  test_predictions.csv
  allocation_comparison.csv
  forecast_vs_actual.png
docs/
  dataset_card.md
  model_card.md
  round_two_demo.md
```

Model metadata records features, split dates, training settings, data checksum, and model version. The dataset card records source, usage terms, selected series, units, cleaning, date ranges, and simulator mapping assumptions.

## Cutoff rules

- **Hour 2:** If preparation runs long, reduce the meter subset; retain real measurements and chronological splits.
- **Hour 4:** Stop tuning. Save the best validation model and integrate it.
- **Hour 7:** If inference service is unstable, generate forecasts from the trained model at each replay origin and label this precomputed inference.
- **Hour 9:** Freeze features and focus on verification, evidence, and rehearsal.
- Add an LSTM only after the end-to-end pipeline succeeds.

## Demo claim

> Round one demonstrated the negotiation system. This version adds a demand model trained on historical electricity measurements, evaluates it on unseen periods, and uses its forecasts to drive the same council's allocation plans.

State plainly that the dataset meters do not represent local critical services, utility mappings are illustrative, cyclone disruptions remain scripted, and results do not establish local operational accuracy.

## Next step after the policy audits: reproducible jury evidence package

Add one command, `npm run jury:verify`, that checks the committed data and model hashes, reruns saved-model inference and the frozen revised-policy audit, runs the code tests and production build, and opens the historical replay in a local browser test. Write a machine-readable manifest and a short demonstration guide from the verified outputs. This is a packaging and verification step; it does not turn the scripted cyclone supply or simulated service impacts into measured field outcomes. Real supply/outage data and field impact validation remain later research work.

## Weather extension

Train a separate three-hour wind/rain forecaster on 2013–2014 hourly Lisbon-area ERA5 reanalysis. Use past-only features, chronological splits, saved weights, and simple baselines. Select forecast methods on validation data; show test errors even when a baseline wins. Bundle same-date forecast and later reanalysis in the opt-in historical evidence panel. Weather remains independent of the scripted cyclone supply until a measured weather-to-outage relationship exists. Verify source/model hashes and future-data isolation in `npm run jury:verify`.
