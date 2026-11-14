# Technical jury walkthrough

## One-command check

From the repository root, install dependencies once:

```sh
npm ci
python3 -m venv ml/.venv
ml/.venv/bin/python -m pip install -r ml/requirements-inference.txt
npm run jury:verify
```

The command needs a local Chrome installation for its final browser check. Set `CHROME_PATH` if Chrome lives elsewhere. It uses committed processed electricity and weather datasets and saved XGBoost weights, so it does not retrain models or download data. If the original UCI ZIP is present at `data/raw/electricity/electricity_load_diagrams_2011_2014.zip`, its checksum is checked too. The ZIP is not committed; its recorded source checksum is in the [dataset manifest](../data/processed/electricity/manifest.json).

The final `PASS` file is [jury_evidence_manifest.json](../experiments/ml/jury_evidence_manifest.json). It records the processed data and model hashes, freshly rerun electricity and weather inference, the frozen policy audit, code/browser checks, and the recorded demo checksum. The [electricity forecast report](../experiments/ml/inference_revision_2014-08-10.json) compares predictions with measured readings at three horizons. [Weather evidence](weather_evidence.md) records wind and rain forecasts beside later ERA5 reanalysis. The [electricity model comparison](../experiments/ml/model_comparison.json) contains XGBoost, Informer, and previous-day errors across 3,456 held-out windows.

## Five-minute presentation

1. Open the manifest. Show the public dataset source, selected meters, saved model SHA-256, and the held-out model comparison.
2. Open the rerun inference reports. Show one meter's predicted and measured kW values; then show Lisbon wind/rain forecasts beside later ERA5 reanalysis. Explain that rainfall falls back to simple baselines because the trained rainfall model was weaker.
3. Open the [frozen revision protocol](../experiments/ml/revision_audit_protocol.json) and [audit summary](../experiments/ml/revision_audit_summary.json). Explain that the 25% priority blend was selected on validation days before the second 30-date policy audit. It lowered modeled service loss against the former council on 27 of 30 dates and met the 0.970 fairness gate with 0.9804 median fairness.
4. Run `npm run preview -- --host 127.0.0.1`, open `http://127.0.0.1:4173/?historical=1`, enter the council, inspect **Trained model & historical evidence**, approve the plan, and step the replay. The [recorded backup](assets/ml-demo.webm) shows this flow.
5. State the limits: the ten meters are anonymous Portuguese customers mapped illustratively to utilities; cyclone supply and impacts are simulated; the audit dates share the model's existing test period; and static priority still had lower modeled service loss on 22 of 30 second-audit dates.

The normal city remains the original authored cyclone simulation. The historical replay is opt-in and uses precomputed predictions from the saved model. The audit demonstrates reproducible **simulation** behavior, not real-world grid safety or casualty benefits.
