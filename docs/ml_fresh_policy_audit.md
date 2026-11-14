# Frozen unused-date policy audit

The [protocol and date list](../experiments/ml/fresh_policy_audit_protocol.json) were committed and pushed before audit outcomes were generated. It fixed the trained XGBoost model, the selected allocation policy, 30 dates, and acceptance criteria. The dates are test-period midnights excluded from earlier allocation replays and the two manual inference demos. They remain part of the model's existing test period, so this audit assesses the policy on unused allocation dates, not a newly collected electricity dataset.

The saved model generated forecasts for all 30 dates without retraining. Measured customer demand was held out from plan construction and used during replay execution. All three policies saw the same measured demand and authored cyclone supply schedule: former council, selected council, and static priority. [Forecast errors](../experiments/ml/fresh_audit_forecast_metrics.json), [full selected-policy replay](../experiments/ml/fresh_audit_selected.json), [former-council replay](../experiments/ml/fresh_audit_former.json), and the [audit summary](../experiments/ml/fresh_policy_audit_summary.json) are committed.

| Median over 30 dates | Former council | Selected policy | Static priority |
|---|---:|---:|---:|
| Synthetic service-loss person-hours (lower) | 171,913 | 166,709 | 161,799 |
| Fairness (higher) | 0.9891 | 0.9688 | 0.9220 |
| Hospital minimum service (higher) | 0.829 | 0.853 | 0.910 |

The selected policy lowered modeled service loss versus the former council on 23 of 30 paired dates, with a median paired improvement of 4,263 synthetic person-hours. It had lower service loss than static priority on 11 dates. All modeled capacity checks passed. The frozen acceptance gate required median fairness of at least **0.970**; the result was **0.9688**. Therefore the 45% blend **failed the full audit criteria**. It was subsequently replaced in the browser replay by a [revised 25% blend](ml_revision_audit.md) tested on a second unused date set. The median paired improvement and the difference between the table medians are different statistics.

Run `npm run policy:audit:episodes` followed by `npm run policy:audit` to reproduce the audit from committed model weights and data. The episode generator verifies the frozen model, data, policy, and prior-date source checksums before predicting. The audit runner verifies the protocol hash and exact episode dates before scoring. The freeze command intentionally refuses to overwrite an existing protocol.

Limitations: ten anonymous Portuguese customer meters are mapped illustratively to city utilities. Cyclone supply and service impacts are simulated. A fresh policy dataset or prospective data collection is needed for a stronger generalization claim.
