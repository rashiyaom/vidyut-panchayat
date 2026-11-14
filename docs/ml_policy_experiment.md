# Planning supply experiment

This experiment diagnoses the council's 85% scheduled-supply planning limit in the historical electricity replay. It does not change the browser's default 85% rule. Replay-only `World.planSupplyFraction` accepts 0.85–1.0; both plan validation and the supply-deviation trigger use the selected value. Execution still validates every allocation against actual supply, buses, feeders, and demand.

The trained XGBoost forecast and its validation-derived demand buffer are fixed. Twenty validation days were used to compare planning limits of 85%, 95%, and 100%. The 100% policy had the lowest median synthetic service loss (176,935 versus 191,750 at 85%), with higher median fairness and hospital minimum service. It was selected before evaluating 30 **different, previously uninspected allocation-replay days** from the test period. The prior 30 test days in `allocation_replay.json` were not used for this policy choice.

On the confirmation days, the 100% policy reduced synthetic service loss relative to 85% on all 30 paired days; the median paired difference was **-16,976** synthetic service-loss person-hours. Median hospital minimum service rose from 0.754 to 0.817 and median fairness from 0.982 to 0.988. All modeled capacity checks passed. Static priority still had lower service loss than the improved council on 23 of 30 days.

Tick-level diagnostics are in `experiments/ml/confirmation_100.json`. They record supply, allocated power, unmet demand, unused root supply, and negotiation outcome. Across the 30 confirmation episodes, the council had both root headroom and unmet demand in 432 of 540 ticks (6.12 PU-hours per episode on average); static priority had this combination in 30 ticks (0.59 PU-hours). Root headroom alone does not prove electricity can reach the unmet loads: bus and feeder constraints may prevent it. This finding points to further allocation-policy analysis beyond the supply reserve.

The result depends on a scripted supply trajectory known to this replay. It does not validate using 100% of a genuinely uncertain real-world supply forecast. The anonymous public meters are mapped illustratively to simulated utilities. The validation period also served model early stopping and demand-buffer calculation, so it is not an independent calibration set. The confirmation days were held aside from policy selection, but all results remain simulation outcomes.

Reproduce with:

```sh
ml/.venv/bin/python ml/train_xgboost.py
node --import tsx scripts/forecast-replay.ts experiments/ml/replay_validation.json 0.85 experiments/ml/validation_085.json
node --import tsx scripts/forecast-replay.ts experiments/ml/replay_validation.json 0.95 experiments/ml/validation_095.json
node --import tsx scripts/forecast-replay.ts experiments/ml/replay_validation.json 1 experiments/ml/validation_100.json
node --import tsx scripts/forecast-replay.ts experiments/ml/replay_confirmation.json 0.85 experiments/ml/confirmation_085.json
node --import tsx scripts/forecast-replay.ts experiments/ml/replay_confirmation.json 1 experiments/ml/confirmation_100.json
```
