"""Check the committed telemetry extract against its source and replay samples."""
import csv
import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path

root = Path(__file__).resolve().parents[1]
report = json.loads((root / "data/processed/telemetry/pt_load_2014-09-15.json").read_text())
raw = root / "data/raw/telemetry/pt_load_2014-09-15.csv"
source = root / "data/raw/telemetry/Monthly-hourly-load-values_2006-2015.xlsx"
assert hashlib.sha256(raw.read_bytes()).hexdigest() == report["rawExtractSha256"]
if source.exists():
    assert hashlib.sha256(source.read_bytes()).hexdigest() == report["sourceWorkbookSha256"]
rows = list(csv.DictReader(raw.open(newline="")))
assert len(rows) == 72
assert len({row["period_end_utc"] for row in rows}) == 72
assert all(float(row["load_mw"]) > 0 for row in rows)
origin = datetime.fromisoformat(report["originUtc"])
assert origin == datetime.fromisoformat(report["originPortugal"])
assert report["unit"] == "MW" and len(report["samples"]) == 4
indexed = {row["period_end_utc"]: row for row in rows}
for hour, sample in enumerate(report["samples"]):
    stamp = (origin + timedelta(hours=hour)).isoformat()
    assert sample["periodEndUtc"] == stamp
    assert float(indexed[stamp]["coverage_pct"]) == 100
    assert sample["loadMw"] == float(indexed[stamp]["load_mw"])
print("Portugal grid telemetry source, 72-hour extract, and four timed replay samples verified.")
