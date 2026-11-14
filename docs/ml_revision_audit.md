# Revised allocation policy and second frozen audit

The first [unused-date audit](ml_fresh_policy_audit.md) found that the 45% priority blend missed its 0.970 fairness gate. We then tightened the **validation-only** selection margin to median fairness at least 0.980 while keeping hospital minimum service at least 0.800 and zero capacity violations. Among the previously recorded validation candidates, the lowest-loss eligible rule was a 25% priority blend with the same 2× validation-residual buffer, 100% feasible top-up, and 100% scripted-supply planning. This was an adaptive revision after the first audit, so the first audit is not independent confirmation of the revision.

The [revision policy and second audit protocol](../experiments/ml/revision_audit_protocol.json) were committed and pushed before second-audit outcomes were generated. Thirty dates were selected from 55 remaining test-period midnights unused by prior allocation replays and manual inference demonstrations. The [second audit summary](../experiments/ml/revision_audit_summary.json) records all frozen checks.

| Median over 30 second-audit dates | Former council | Revised council | Static priority |
|---|---:|---:|---:|
| Synthetic service-loss person-hours (lower) | 172,624 | 170,241 | 161,894 |
| Fairness (higher) | 0.9890 | 0.9804 | 0.9224 |
| Hospital minimum service (higher) | 0.820 | 0.834 | 0.910 |

The revised council lowered modeled service loss against the former council on **27 of 30** paired dates. Median paired improvement was **3,410** synthetic person-hours. Median fairness **0.9804** exceeded the frozen **0.970** acceptance gate; hospital minimum service exceeded 0.800; and every capacity check passed. The rule therefore passed all prespecified criteria for this simulated historical replay. Static priority still had lower service loss on **22 of 30** dates. The difference between table medians differs from the median paired improvement.

Reproduce with `npm run policy:revision:episodes` and `npm run policy:revision:audit`. The episode generator verifies data, model, policy, and prior-date source checksums before loading the saved XGBoost weights; the audit verifies the protocol hash and exact dates before scoring. The browser's opt-in `?historical=1` replay uses this revised rule after `npm run ml:infer -- --date YYYY-MM-DD --activate` and `npm run build`.

Limitations: these are unused **policy** dates within the model's existing test period, not a newly collected dataset. The meter-to-utility mapping, cyclone supply, and service impacts are simulated. The 100% planning supply assumes the authored trajectory is known; it does not validate operation under uncertain real supply.
