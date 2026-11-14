# Portugal grid-load telemetry

The selected historical replay includes Portugal national **total load**, in MW, from [ENTSO-E's 2006–2015 Monthly Hourly Load Values archive](https://www.entsoe.eu/data/power-stats/). This is a measured or estimated national aggregate. It is not local feeder capacity, grid headroom, or a measurement of the simulated city's supply. ENTSO-E's [methodology](https://eepublicdownloads.entsoe.eu/clean-documents/Publications/Statistics/20150531_MS_guidelines_public.pdf) says workbook timestamps use CET/CEST and each value averages the preceding hour.

The official 21 MB workbook is downloaded to `data/raw/telemetry/Monthly-hourly-load-values_2006-2015.xlsx` and kept locally outside Git. Its SHA-256 is `3a762b8dcee5567cfc84912deee1bbe5e908553d813228634bbd43e7ff0a0b20`. The standard-library extractor [prepare_grid_telemetry.py](../ml/prepare_grid_telemetry.py) commits a [72-hour source extract](../data/raw/telemetry/pt_load_2014-09-15.csv) and a [four-sample replay file](../data/processed/telemetry/pt_load_2014-09-15.json) with checksums, UTC period-end timestamps, coverage, and provenance. Selected samples have 100% reported coverage.

At Portugal midnight on 2014-09-15, the most recent completed hour was **4,528 MW**. The next completed hours are **4,357**, **4,241**, and **4,184 MW**. At ten-minute replay ticks 0–5, the engine exposes only the first value; ticks 6–11 expose the second; ticks 12–17 expose the third. The fourth becomes available at tick 18, after this replay's three-hour horizon. Archive publication lag is unknown, so the simulator treats period end as an illustrative availability time. None of these values enter the council plan, electricity demand forecast, supply, feeder limits, or allocation calculation.

To reproduce the extract:

```sh
mkdir -p data/raw/telemetry
curl -L 'https://www.entsoe.eu/publications/data/power-stats//Monthly-hourly-load-values_2006-2015.xlsx' -o data/raw/telemetry/Monthly-hourly-load-values_2006-2015.xlsx
npm run telemetry:prepare -- --date 2014-09-15
npm run telemetry:verify
```

The current replay date is bundled at build time. For another date, run the extractor and update the imported processed-file path in the app; a mismatched date is rejected or omitted. The normal city remains an authored simulation.
