# Measured cyclone results

Actual matrix: 1 scenario × 4 strategies × 50 seeds = 200 runs, each 144 ticks. Engine 1.1.0, contract 1. Demand ±10%, event jitter ±3 ticks, directed message drop rate 1%. Extra scenarios are not implemented or measured.

Synthetic service exposures overlap; no casualty claims. Entries are median [p10, p90].

| Strategy | PHL | Damage | Hospital min | Fairness | Critical uptime | Weighted PU gap to full-information one-tick oracle | Violations |
|---|---:|---:|---:|---:|---:|---:|---:|
| council | 4781790.293 [4580737.974, 5445530.647] | 48.405 [46.021, 55.504] | 0.241 [0.230, 0.271] | 0.797 [0.764, 0.807] | 0.373 [0.295, 0.406] | 1088.357 [914.151, 1665.624] | 0.000 [0.000, 0.000] |
| static | 4670759.440 [4510456.830, 4920961.035] | 57.378 [55.521, 59.525] | 0.494 [0.424, 0.567] | 0.585 [0.570, 0.599] | 0.491 [0.472, 0.503] | 0.507 [0.189, 0.990] | 0.000 [0.000, 0.000] |
| equal | 5159707.334 [4974879.961, 5378179.953] | 44.361 [42.513, 46.420] | 0.061 [0.060, 0.062] | 0.839 [0.835, 0.843] | 0.349 [0.326, 0.370] | 2145.429 [2109.002, 2204.575] | 0.000 [0.000, 0.000] |
| optimum | 4670759.440 [4510456.830, 4920961.035] | 57.378 [55.521, 59.525] | 0.494 [0.424, 0.567] | 0.585 [0.570, 0.599] | 0.491 [0.472, 0.503] | 0.507 [0.189, 0.990] | 0.000 [0.000, 0.000] |

Static and optimum share the same fixed-weight greedy rule under this linear objective. Software-crash hold constraints can keep their live allocations below the fully responsive oracle, whose gap is explicitly reported. Council is not expected to win every metric; message drops and conservative fallback can substantially increase service loss. The oracle maximizes sum W×grid PU, not effective service, fairness or cumulative PHL.
