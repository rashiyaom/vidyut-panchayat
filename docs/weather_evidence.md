# Lisbon weather forecast evidence

Weather data come from the [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api), requesting the ERA5 model for 2013–2014 near Lisbon. The returned grid cell is 38.75°N, 9.25°W. The 17,520 hourly records have no missing values. Wind speed is in m/s, hourly precipitation in mm, and temperature in °C. The [raw response](../data/raw/weather/lisbon_era5_2013_2014.json), [processed CSV](../data/processed/weather/lisbon_era5_hourly.csv), and [manifest](../data/processed/weather/manifest.json) are committed with the source checksum and attribution. Open-Meteo API data are [CC BY 4.0](https://open-meteo.com/en/license); credit Open-Meteo and Copernicus/ECMWF ERA5.

Two saved XGBoost regressors predict wind speed and precipitation one, two, and three hours ahead. Inputs are past weather lags and rolling means plus known calendar features. Training, validation, and test periods are chronological. The [evaluation report](../experiments/ml/weather_model_evaluation.json) covers 3,502 complete held-out test windows and records model hashes, features, split dates, and validation-selected methods.

| Horizon | Wind XGBoost MAE (m/s) | Wind persistence MAE | Rain XGBoost MAE (mm) | Rain persistence MAE |
|---|---:|---:|---:|---:|
| 1 hour | 0.329 | 0.327 | 0.120 | 0.075 |
| 2 hours | 0.524 | 0.564 | 0.142 | 0.108 |
| 3 hours | 0.680 | 0.754 | 0.152 | 0.121 |

Wind XGBoost was selected on validation at all three horizons. It narrowly lost to persistence at one hour on the held-out test, and won at two and three hours. Rain XGBoost lost to simple baselines at every test horizon; validation selected persistence at one hour and zero-rain at two and three hours. This is weak rainfall forecasting and should be presented as such. No severe-storm or outage skill is claimed.

Reproduce with `npm run weather:prepare`, `npm run weather:train`, and `npm run weather:verify`. `npm run weather:infer -- --date 2014-09-15 --activate` loads the saved weights, converts Portugal midnight to UTC, writes [the dated report](../experiments/ml/weather_inference_2014-09-15.json), and bundles it into the historical evidence panel. `weather:verify` reruns held-out model evaluation and checks that changing future readings cannot change forecast inputs.

ERA5 is **reanalysis**: a retrospective estimate derived from observations and models, not an archived operational forecast or a live station feed. The trained wind forecast is our own past-only model evaluated against later ERA5 values.

In the opt-in historical replay, matching-date forecast values enter the engine at initialization. Each forecast hour covers six ten-minute ticks. A transparent sensitivity rule starts above 12 m/s wind or 5 mm/hour rain, reaches full stress at 25 m/s or 20 mm/hour, and scales the existing scripted supply and feeder caps down by up to 25% and 35% respectively. Planning, plan validation, pre-simulation, and execution share the same rule; later ERA5 values never enter these paths. The selected date has no extra derating. The thresholds and derating sizes are **illustrative assumptions**, not calibrated weather-to-outage estimates. The normal city simulation remains authored and unchanged.
