"""Prepare a small hourly Informer dataset from the UCI electricity ZIP."""
import csv
import hashlib
import json
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/raw/electricity/electricity_load_diagrams_2011_2014.zip"
OUT = ROOT / "data/processed/electricity"
OUT.mkdir(parents=True, exist_ok=True)


def rows():
    with zipfile.ZipFile(SOURCE).open("LD2011_2014.txt") as raw:
        import io
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8"), delimiter=";")
        names = next(reader)
        for row in reader:
            hour = datetime.fromisoformat(row[0]) - timedelta(minutes=15)
            if hour.year >= 2013:
                yield names, hour.replace(minute=0), row


counts = [0] * 370
positive = [0] * 370
for _, hour, row in rows():
    if hour.year != 2013:
        continue
    for i, cell in enumerate(row[1:]):
        counts[i] += 1
        positive[i] += float(cell.replace(",", ".")) > 0

# Select using the training year alone. All chosen series must be active for
# at least 95% of 2013 observations; deterministic ID order breaks ties.
chosen = [i for i in range(370) if counts[i] and positive[i] / counts[i] >= .95][:10]
if len(chosen) != 10:
    raise RuntimeError(f"Only {len(chosen)} sufficiently active meters")
names = [f"MT_{i+1:03d}" for i in chosen]
output = OUT / "ecl_10_hourly.csv"
with output.open("w", newline="") as dest:
    writer = csv.writer(dest, lineterminator="\n")
    writer.writerow(["date", *names])
    current = None
    sums = [0.0] * 10
    n = 0
    written = 0
    for _, hour, row in rows():
        if current is not None and hour != current:
            if n != 4:
                raise ValueError(f"Expected 4 samples at {current}, found {n}")
            writer.writerow([current.isoformat(sep=" "), *[round(v / 4, 6) for v in sums]])
            written += 1
            sums = [0.0] * 10
            n = 0
        current = hour
        for j, i in enumerate(chosen):
            sums[j] += float(row[i + 1].replace(",", "."))
        n += 1
    if current is not None:
        if n != 4:
            raise ValueError(f"Expected 4 samples at {current}, found {n}")
        writer.writerow([current.isoformat(sep=" "), *[round(v / 4, 6) for v in sums]])
        written += 1

manifest = {
    "source": "https://archive.ics.uci.edu/dataset/321/electricityloaddiagrams20112014",
    "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "selected_meters": names,
    "selection": "first 10 meter IDs with >=95% positive quarter-hour readings in 2013",
    "period": "2013-01-01 through 2014-12-31, Portuguese local timestamps",
    "aggregation": "mean of four 15-minute kW readings after shifting timestamps back 15 minutes",
    "rows": written,
    "unit": "kW",
    "note": "Meters are unlabeled clients, not measurements of the ten simulated utilities.",
}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
