"""Extract Portugal's dated hourly total load from the official ENTSO-E workbook."""
import argparse
import csv
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/raw/telemetry/Monthly-hourly-load-values_2006-2015.xlsx"
URL = "https://www.entsoe.eu/publications/data/power-stats//Monthly-hourly-load-values_2006-2015.xlsx"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def extract(source: Path, day: datetime):
    wanted = {(day + timedelta(days=offset)).date() for offset in (-1, 0, 1)}
    with ZipFile(source) as archive:
        strings = ["".join(item.itertext()) for item in ET.fromstring(
            archive.read("xl/sharedStrings.xml")).findall(NS + "si")]
        with archive.open("xl/worksheets/sheet1.xml") as sheet:
            for _, row in ET.iterparse(sheet, events=("end",)):
                if row.tag != NS + "row":
                    continue
                cells = {}
                for cell in row.findall(NS + "c"):
                    value = cell.find(NS + "v")
                    if value is not None:
                        column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                        cells[column] = strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text
                if cells.get("A") == "PT" and all(cells.get(key) for key in ("B", "C", "D")):
                    date = datetime(int(cells["B"]), int(cells["C"]), int(cells["D"])).date()
                    if date in wanted:
                        coverage = float(cells["E"])
                        for hour in range(24):
                            column = chr(70 + hour) if hour < 21 else "A" + chr(65 + hour - 21)
                            if column not in cells:
                                raise ValueError(f"Missing Portugal {date} hour {hour}")
                            period_end = datetime(date.year, date.month, date.day, hour,
                                                  tzinfo=ZoneInfo("Europe/Berlin")).astimezone(timezone.utc)
                            yield {"period_end_utc": period_end.isoformat(),
                                   "load_mw": float(cells[column]), "coverage_pct": coverage,
                                   "source_date_cet": str(date), "source_hour_cet": hour}
                row.clear()


parser = argparse.ArgumentParser()
parser.add_argument("--date", default="2014-09-15", help="Portugal local date")
args = parser.parse_args()
day = datetime.strptime(args.date, "%Y-%m-%d")
if not SOURCE.exists():
    raise SystemExit(f"Download {URL} to {SOURCE} first")
rows = sorted(extract(SOURCE, day), key=lambda row: row["period_end_utc"])
if len(rows) != 72:
    raise ValueError(f"Expected 72 source hours across three dates, got {len(rows)}")
raw = ROOT / f"data/raw/telemetry/pt_load_{args.date}.csv"
with raw.open("w", newline="") as stream:
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

origin = day.replace(tzinfo=ZoneInfo("Europe/Lisbon"))
origin_utc = origin.astimezone(timezone.utc)
by_time = {row["period_end_utc"]: row for row in rows}
samples = []
for hour in range(4):
    stamp = (origin_utc + timedelta(hours=hour)).isoformat()
    row = by_time.get(stamp)
    if row is None or row["coverage_pct"] != 100 or row["load_mw"] <= 0:
        raise ValueError(f"Missing, partial-coverage, or invalid load at {stamp}")
    samples.append({"periodEndUtc": stamp, "loadMw": row["load_mw"]})
report = {
    "version": 1,
    "originPortugal": origin.isoformat(),
    "originUtc": origin_utc.isoformat(),
    "source": URL,
    "sourceWorkbookSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "rawExtractSha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
    "scope": "Portugal national total load, not local feeder load or available supply",
    "unit": "MW",
    "availabilityAssumption": "A sample enters the replay at its period end. Archive publication delay is unknown; values never enter planning.",
    "samples": samples,
}
result = ROOT / f"data/processed/telemetry/pt_load_{args.date}.json"
result.parent.mkdir(parents=True, exist_ok=True)
result.write_text(json.dumps(report, indent=2) + "\n")
print(f"Prepared {len(rows)} source hours and {len(samples)} replay samples at {result}")
