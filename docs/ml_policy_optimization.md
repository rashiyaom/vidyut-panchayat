# Validation-selected electricity allocation policy

This follow-up starts from the trained XGBoost forecast and the earlier 100% scripted-supply council replay. It changes only the **historical replay** policy. The normal cyclone simulation retains its original 85% planning rule. Anonymous Portuguese customer meters are still mapped illustratively to city utilities; cyclone supply and service loss are simulated.

The 30 confirmation dates were used in the earlier supply-policy analysis, so they are not a newly untouched dataset. Their outcomes were not read by the automated candidate-selection command for this follow-up. A genuinely prospective or newly held-out period would be needed for a stronger generalization claim.

## Method

Twenty validation-day episodes were used to compare forecast-buffer multipliers, feasible capacity top-up fractions, and blends between the negotiated proposal and a fixed-priority allocation. A top-up preserves each negotiated allocation while offering remaining forecast and network capacity. A priority blend is a proposal, then the same plan validator checks it and agents must sign it before execution. Every live allocation remains subject to actual supply, bus, feeder, and demand limits.

The selection rule was frozen before reading the separate 30-day confirmation file: minimize median synthetic service-loss person-hours among candidates with zero capacity violations, median fairness at least 0.970, and median minimum hospital service at least 0.800. [The frozen record](../experiments/ml/policy_selected.json) includes every candidate, its validation metrics, and its report checksum. It selected 100% scripted supply, a 2× validation-residual forecast buffer, 100% feasible top-up, and a 45% priority blend. On validation days, median service loss was 170,106 synthetic person-hours, fairness 0.9707, and hospital minimum service 0.8264.

## Separate confirmation

| Median over 30 confirmation days | Former 100% council | Selected policy |
|---|---:|---:|
| Synthetic service-loss person-hours (lower) | 180,278 | 168,651 |
| Fairness (higher) | 0.988 | 0.968 |
| Minimum hospital service (higher) | 0.817 | 0.843 |

The selected policy lowered service loss versus the former council on 24 of 30 paired days, with a median paired improvement of 5,196 synthetic person-hours. It beat static priority on 8 of 30 days; static priority still won the other 22. All modeled capacity checks passed. Confirmation fairness **fell below the 0.970 validation threshold**, so this is a measured tradeoff, not a policy that satisfied every target out of sample. The median difference between the two medians is not the median paired improvement.

The original 45% blend failed a later [unused-date fairness audit](ml_fresh_policy_audit.md). The browser's `?historical=1` mode now uses the [revised 25% blend](ml_revision_audit.md) that passed a second frozen audit. `npm run ml:infer -- --date YYYY-MM-DD --activate` recomputes the selected date's saved-model forecast and revised policy buffer. Its report includes model and data checksums, raw predictions, measured readings, and the selected policy. Rebuild the browser after activating a date.

To reproduce the policy results without retraining XGBoost, run `npm run policy:validate`, `npm run policy:select`, then `npm run policy:confirm`. The validation command regenerates 14 candidate reports from the committed validation episodes while retaining the original 100% council reference. The selection command reads validation reports only. The confirmation command checks the frozen winner's report hash, then reads the separate confirmation episodes and writes [the confirmation summary](../experiments/ml/policy_confirmation_summary.json) and [full tick-level results](../experiments/ml/policy_confirmation.json). Candidate reports in `experiments/ml/*validation*.json` are committed for audit.
