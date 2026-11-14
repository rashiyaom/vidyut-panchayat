# Machine Learning, Telemetry & Policy Audit Evidence

This document compiles the quantitative evaluation records, comparative baselines, telemetry integrations, and frozen policy audits for the Vidyut Panchayat multi-agent decision engine.

---

## 1. Electricity Demand Forecasting (XGBoost vs Informer)

### 1.1 Dataset & Split
- **Source**: UCI ElectricityLoadDiagrams20112014 (10 anonymous Portuguese customer meters, 17,520 hourly readings from 2013–2014).
- **Split**: Chronological 70% Train, 10% Validation, 20% Test (3,456 complete held-out test windows).
- **Inputs**: Strictly past meter lags, rolling window statistics, and deterministic calendar indicators.

### 1.2 Test Evaluation: Out-of-Sample Mean Absolute Error (MAE in kW)
| Forecast Horizon | XGBoost (Saved Model) | Previous-Day Baseline | Informer (Deep Attention) |
| :---: | :---: | :---: | :---: |
| **1 Hour Ahead** | **5.12 kW** | 8.94 kW | 10.26 kW |
| **2 Hours Ahead** | **6.76 kW** | 8.94 kW | 10.00 kW |
| **3 Hours Ahead** | **7.77 kW** | 8.94 kW | 10.99 kW |

*Artifact location*: `artifacts/xgboost/electricity_10_meter_3h.json`  
*Verification*: `npm run replay:forecast` verifies out-of-sample performance and writes `experiments/ml/model_comparison.json`.

---

## 2. Lisbon Weather Forecasting (ERA5 Reanalysis)

### 2.1 Dataset
- **Source**: Copernicus ECMWF ERA5 reanalysis via Open-Meteo Historical API (Lisbon grid cell: 38.75°N, 9.25°W; 17,520 hourly rows, CC BY 4.0).
- **Split**: Evaluated across 3,502 complete held-out chronological test windows.

### 2.2 Model Evaluation Across Horizons
| Horizon | Wind XGBoost MAE | Wind Persistence MAE | Rain XGBoost MAE | Rain Persistence MAE |
| :---: | :---: | :---: | :---: | :---: |
| **1 Hour** | 0.329 m/s | **0.327 m/s** | 0.120 mm/h | **0.075 mm/h** |
| **2 Hours** | **0.524 m/s** | 0.564 m/s | 0.142 mm/h | **0.108 mm/h** |
| **3 Hours** | **0.680 m/s** | 0.754 m/s | 0.152 mm/h | **0.121 mm/h** |

> [!NOTE]
> **Weather Model Transparency**:
> Wind XGBoost outperforms persistence at 2 and 3 hours. Rainfall XGBoost was weaker than simple persistence on this test split; the historical engine uses persistence for rain.
>
> In the opt-in historical replay (`?historical=1`), weather feeds an illustrative derating rule: winds $>12\text{ m/s}$ or rain $>5\text{ mm/h}$ linearly scale supply by up to 25% and feeder capacity by up to 35%.

---

## 3. Portugal National Grid Telemetry (ENTSO-E)

- **Source**: ENTSO-E Monthly Hourly Load Values (2006–2015 archive).
- **Extracted Sample**: Four consecutive completed-hour load values for 2014-09-15 midnight: **4,528 MW**, **4,357 MW**, **4,241 MW**, and **4,184 MW** (100% reported coverage).
- **Role**: Serves as real-world background telemetry displayed in the metrics panel during replay ticks; does not dictate local feeder capacity.

---

## 4. Multi-Agent Policy Optimization & Frozen Audits

The council applies a parameterized policy tuple: `(supplyFraction, fillFraction, bufferMultiplier, priorityBlend)`.

### 4.1 First Audit (45% Priority Blend)
- Evaluated on 30 fresh held-out test dates.
- Result: Lowered synthetic person-hour loss vs. former council on 29/30 dates, but marginally missed the strict $\ge 0.970$ fairness gate (0.966 median).

### 4.2 Revised Policy & Second Frozen Audit (25% Priority Blend)
We tightened the validation threshold to requiring median fairness $\ge 0.980$, selecting the **25% priority blend** (`policy_revision_selected.json`). The audit protocol was pre-committed before running on 30 further unused test-period dates:

| Median Metric (30 Unused Dates) | Former Council | Revised Council (25% Blend) | Static Priority |
| :--- | :---: | :---: | :---: |
| **Synthetic Service Loss (PHL, lower is better)** | 172,624 | **170,241** | 161,894 |
| **Within-Tier Fairness (higher is better)** | 0.9890 | **0.9804** *(Gate: $\ge 0.970$ PASS)* | 0.9224 |
| **Hospital Minimum Service (higher is better)** | 0.820 | **0.834** *(Gate: $\ge 0.800$ PASS)* | 0.910 |
| **Physical Capacity Violations** | 0 | **0** *(Gate: 0 PASS)* | 0 |

### 4.3 Key Findings
1. The revised council beat the former council on **27 of 30** paired dates (median paired improvement: **3,410** synthetic person-hours).
2. It satisfied all pre-registered acceptance criteria: **0.9804** fairness (above 0.970 gate), **0.834** hospital minimum, and zero violations.
3. Static priority achieves lower raw service loss on 22 of 30 dates by completely starving lower tiers; the multi-agent council protects vital civil equity while keeping essential services functioning.

---

## 5. Reproduction Commands

```bash
# Verify ML predictions and model comparison table
npm run replay:forecast

# Re-run electricity inference on any test date
npm run ml:infer -- --date 2014-09-15 --activate

# Re-evaluate weather model and past-only feature separation
npm run weather:verify

# Verify ENTSO-E telemetry extract
npm run telemetry:verify

# Execute the frozen policy revision audit
npm run policy:revision:audit

# Complete automated verification
npm run jury:verify
```
