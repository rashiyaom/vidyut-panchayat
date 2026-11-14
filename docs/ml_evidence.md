# Electricity forecasting and allocation evidence

The trained XGBoost model predicts three hourly electricity-demand values for ten anonymous customer meters from the UCI ElectricityLoadDiagrams20112014 dataset. Its saved artifact is `artifacts/xgboost/electricity_10_meter_3h.json`. Preparation, meter selection, and source checksum are recorded in `data/processed/electricity/manifest.json`.

Data are split chronologically: 70% training, 10% validation, and 20% test. Inputs use only past meter readings and known calendar features. The Informer and XGBoost forecasts are evaluated on the same 3,456 held-out windows. Test MAE in kW is:

| Hours ahead | XGBoost | Previous-day baseline | Informer |
|---|---:|---:|---:|
| 1 | 5.12 | 8.94 | 10.26 |
| 2 | 6.76 | 8.94 | 10.00 |
| 3 | 7.77 | 8.94 | 10.99 |

The council experiment samples 30 predetermined midnight origins across that test period. Each origin replays three hours of measured demand through the same authored cyclone supply schedule and random seed. Meter-to-utility assignment and kW-to-PU scaling are illustrative. XGBoost demand receives an upper buffer equal to the positive 80th percentile of its validation residual for each meter and horizon; the test data are not used to calculate the buffer. The validation period also supplied early stopping, so the buffer's nominal percentile is not independently calibrated.

| Median over 30 episodes | Buffered XGBoost council | Previous-day council | Static priority |
|---|---:|---:|---:|
| Synthetic service-loss person-hours (lower) | 188,810 | 207,076 | 163,788 |
| Unserved PU-hours (lower) | 81.02 | 89.36 | 71.97 |
| Fairness (higher) | 0.982 | 0.984 | 0.923 |
| Minimum hospital service (higher) | 0.749 | 0.749 | 0.910 |

The buffered council has lower service loss than the previous-day council in 25 of 30 paired episodes, with a median paired difference of -9,861 synthetic person-hours. Static priority has lower service loss in all 30. All runs satisfy modeled capacity limits. The council leaves more supply unused than static priority in this replay (median 107.03 versus 97.05 PU-hours), a possible contributor to its service-loss gap; further policy analysis is needed before assigning causality.

These results establish forecast accuracy on the selected public meter data and a repeatable **simulation** comparison. They do not establish forecasts for hospitals or Indian utilities, real cyclone supply forecasts, or real-world casualty benefits. The simulated exposure categories overlap, so service-loss person-hours are not a unique affected population.

Reproduce the allocation comparison with `npm run replay:forecast`. Machine-readable forecast and per-episode results are in `experiments/ml/model_comparison.json` and `experiments/ml/allocation_replay.json`.

The follow-up [planning supply experiment](ml_policy_experiment.md) documents validation-based policy selection and a separate 30-day confirmation run. The normal browser simulation still uses the original 85% supply planning limit. Open `?historical=1` for the selected held-out episode with the 100% replay policy and precomputed XGBoost forecasts. The browser panel shows forecast error and all 30 confirmation rows; `npm run evidence:ml` regenerates the aggregate evidence file. With a production preview running on port 4173, `npm run test:historical-browser` checks that replay in Chrome.

For arbitrary held-out midnight origins, `npm run ml:infer -- --date YYYY-MM-DD --activate` loads the saved XGBoost model, rebuilds its training-only normalization and past-only features, predicts three hours, compares each prediction with measured readings, writes `experiments/ml/inference_revision_YYYY-MM-DD.json`, and sets that report as the browser replay. Earlier inference reports named in frozen audit protocols stay unchanged. Run `npm run build` after activation. The browser evidence panel exposes the selected date, ten meter readings at each horizon, and forecast error. The model checksum in the report identifies the exact weight file. [Recorded walkthrough](assets/ml-demo.webm) shows the selected report and council decision.
