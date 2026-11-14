"""Validate and preserve hourly Lisbon ERA5 reanalysis from Open-Meteo."""
import csv
import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = ("https://archive-api.open-meteo.com/v1/archive?latitude=38.72&longitude=-9.14"
       "&start_date=2013-01-01&end_date=2014-12-31"
       "&hourly=temperature_2m,precipitation,wind_speed_10m"
       "&models=era5&timezone=GMT&wind_speed_unit=ms&precipitation_unit=mm")
source = ROOT / "data/raw/weather/lisbon_era5_2013_2014.json"
raw = source.read_bytes()
data = json.loads(raw)
hourly = data["hourly"]
names = ["temperature_2m", "precipitation", "wind_speed_10m"]
times = hourly["time"]
if data["timezone"] != "GMT" or len(times) != 17520:
    raise ValueError("Expected exactly two complete UTC years of hourly data")
if {name: data["hourly_units"][name] for name in names} != {
    "temperature_2m": "°C", "precipitation": "mm", "wind_speed_10m": "m/s"
}:
    raise ValueError("Unexpected weather units")
start = datetime(2013, 1, 1)
for i, stamp in enumerate(times):
    if datetime.fromisoformat(stamp) != start + timedelta(hours=i):
        raise ValueError(f"Missing or duplicate hour at row {i}")
    for name in names:
        value = hourly[name][i]
        if value is None or not isinstance(value, (int, float)):
            raise ValueError(f"Missing {name} at row {i}")
        if name != "temperature_2m" and value < 0:
            raise ValueError(f"Negative {name} at row {i}")
out = ROOT / "data/processed/weather"
out.mkdir(parents=True, exist_ok=True)
with (out / "lisbon_era5_hourly.csv").open("w", newline="") as file:
    writer = csv.writer(file, lineterminator="\n")
    writer.writerow(["time_utc", *names])
    for i, stamp in enumerate(times):
        writer.writerow([stamp, *[hourly[name][i] for name in names]])
manifest = {
    "source": URL,
    "documentation": "https://open-meteo.com/en/docs/historical-weather-api",
    "provider": "Open-Meteo, ERA5 reanalysis",
    "license": "CC BY 4.0; attribution to Open-Meteo and Copernicus/ECMWF ERA5",
    "source_sha256": hashlib.sha256(raw).hexdigest(),
    "requested_coordinates": [38.72, -9.14],
    "returned_grid_cell": [data["latitude"], data["longitude"]],
    "time_zone": "UTC (GMT API response)",
    "period": "2013-01-01T00:00 through 2014-12-31T23:00 UTC",
    "rows": len(times),
    "units": {name: data["hourly_units"][name] for name in names},
    "note": "ERA5 is reanalysis, not an archived operational forecast or a station sensor. No outage labels are included.",
}
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Prepared {len(times)} UTC weather hours; raw SHA-256 {manifest['source_sha256'][:12]}")
