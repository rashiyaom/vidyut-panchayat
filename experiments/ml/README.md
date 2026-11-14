# Machine Learning Experiments & Policy Audits (`experiments/ml/`)

This directory contains **frozen evaluation records, candidate validation sweeps, model comparison metrics, and audit evidence** produced during Round 2 development.

---

## Role in the Architecture

While `ml/` holds executable Python code and `data/ml/` holds browser replay packages, `experiments/ml/` serves as the **verifiable paper trail of experimental proof**:
- Every policy candidate tested across parameter grids (e.g. priority blends, forecast buffer multipliers, top-up rates) is preserved with its full verification output.
- Two distinct 30-day policy audits (`fresh_policy_audit_*` and `revision_audit_*`) record frozen held-out replay outcomes.
- Comparative benchmarks across XGBoost, Informer Transformer, and Previous-Day persistence baselines.

---

## Primary File Categories

### 1. Model Comparison Benchmarks
- `model_comparison.json`: Held-out test period evaluation (3,456 windows) comparing XGBoost MAE, Informer MAE, and Persistence MAE at 1h, 2h, and 3h horizons.
- `weather_model_evaluation.json`: Comparative evaluation of wind speed and precipitation models against ERA5 ground truth.
- `informer_evaluation.json`: Multi-horizon performance metrics for the Informer benchmark model.

### 2. Candidate Optimization Sweeps
- `policy_selected.json`: Frozen optimization record selecting the winning policy parameters from 14 candidates.
- `blend_validation_*.json`: Candidate sweeps evaluating priority blend ratios (0.25 to 1.00).
- `buffer_validation_*.json`: Candidate sweeps evaluating forecast error buffer multipliers (1.5× to 3.0×).
- `topup_validation_*.json`: Candidate sweeps evaluating feasible top-up percentages.

### 3. Frozen Audits & Verification Manifests
- `revision_audit_protocol.json` & `revision_audit_summary.json`: Frozen protocol and 30-date evaluation summary for the revised 25% blend policy.
- `fresh_policy_audit_protocol.json` & `fresh_policy_audit_summary.json`: Initial 30-date audit assessing candidate performance.
- `jury_evidence_manifest.json`: Single master integrity manifest recording data checksums, model hashes, inference runs, and verification status.

---

## Verification

To verify the integrity of all models and audit records against the jury manifest:
```bash
npm run jury:verify
```
