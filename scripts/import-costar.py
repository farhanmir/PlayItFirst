"""Import one matched suite into an ignored local demo file. Never executes kit code."""
import argparse
import base64
import csv
import io
import json
import math
import os
from pathlib import Path
import urllib.request
import zipfile


def import_suite(archive, password, listing_id, space_id, key, token):
    with zipfile.ZipFile(archive) as kit:
        kit.setpassword(password.encode())
        listing = next((json.loads(line) for line in kit.open("data/commercial-listing-summary.jsonl")
                        if json.loads(line)["id"] == listing_id), None)
        if not listing or listing.get("listingStatus") != 1:
            raise ValueError("Choose an active listing in the authorized extract")
        lease = listing["forLeaseSummary"]
        space = next(s for s in lease["spaces"] if s["id"] == space_id)
        if space.get("dateOffMarket") or space.get("isLeasePending") or space.get("monetaryUnit") != 1:
            raise ValueError("Suite is unavailable or currency is not USD")
        area, rate = space["squareFeetMin"], space["rateLow"]
        basis = space["rateBasis"]
        if not area or rate <= 0 or basis not in (1, 2) or lease.get("askingRateMeasurementType") != 1:
            raise ValueError("Require a positive USD per-square-foot asking rate with known basis")
        if area != space["squareFeetMax"]:
            raise ValueError("Require an exact suite area, not a divisible range")
        plan = space.get("floorPlan", {})
        model = plan.get("videoKey")
        if plan.get("videoExternalReferenceType") not in (36, 234) or not model:
            raise ValueError("Require the suite's own Matterport attachment")
        rows = csv.DictReader(io.StringIO(kit.read("commercial-properties.csv").decode("utf-8-sig")))
        matched = next((r for r in rows if r["PropertyId"] == str(listing["propertyId"]) and r["MatterportModelId"] == model), None)
        if not matched or matched["City"] not in ("Houston", "Los Angeles"):
            raise ValueError("No matching property/model row")
    query = {"query": "query($id:ID!) { model(id:$id) { id name dimensionEstimates(units:metric) { area } } }", "variables": {"id": model}}
    request = urllib.request.Request("https://api.matterport.com/api/models/graph", data=json.dumps(query).encode(), headers={
        "Authorization": "Basic " + base64.b64encode(f"{key}:{token}".encode()).decode(), "Content-Type": "application/json"})
    response = json.load(urllib.request.urlopen(request, timeout=20))
    live = response.get("data", {}).get("model")
    if response.get("errors") or not live or live["id"] != model:
        raise ValueError("Matched model failed live verification")
    scan_area = live.get("dimensionEstimates", {}).get("area")
    if not scan_area or not math.isfinite(scan_area) or scan_area <= 0:
        raise ValueError("No usable measured scan area")
    return [{
        "id": f"costar-{listing['propertyId']}-{space_id}", "name": f"{matched['Address']} · Suite {space.get('suite', '')}",
        "city": matched["City"], "neighborhood": "", "address": f"{matched['Address']}, {matched['City']}, {matched['State']}",
        "sqft": area, "monthlyRent": round(area * rate / (12 if basis == 2 else 1), 2),
        "width": math.sqrt(scan_area * 1.4), "depth": math.sqrt(scan_area / 1.4), "capacity": 28, "footTraffic": 0.6,
        "costarId": str(listing["propertyId"]), "matterportModelId": model,
        "matterportEmbedUrl": f"https://my.matterport.com/show/?m={model}", "source": "costar-extract", "imageTone": "#6b8068",
        "description": "Authorized event extract: active retail suite, marketed as a second-generation restaurant. Asking terms are not an executed lease.",
        "matterportHint": f"Exact suite attachment verified against live model: {live.get('name', model)}. Simplified playable rectangle, not a wall reconstruction.",
        "provenance": {"listingId": str(listing_id), "spaceId": str(space_id), "suite": space.get("suite", ""), "askingRate": rate,
            "rateBasis": "USD/sqft/year" if basis == 2 else "USD/sqft/month", "scanAreaM2": scan_area,
            "geometry": "Area-scaled rectangle from scan area; aspect ratio and entrance are assumed, walls not reconstructed",
            "assumptions": ["1.4 rectangle aspect ratio", "Entrance and furniture positions", "28-person simulation capacity", "0.6 simulated foot traffic", "CAM/taxes/additional charges excluded", "Permitted café use not independently verified"]},
    }]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--listing", type=int, required=True)
    parser.add_argument("--space", type=int, required=True)
    parser.add_argument("--out", default=".sponsor/property.json")
    args = parser.parse_args()
    env = dict(os.environ)
    if Path(".env").exists():
        for line in Path(".env").read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k, v)
    result = import_suite(env["COSTAR_KIT_PATH"], env["COSTAR_KIT_PASSWORD"], args.listing, args.space, env["MATTERPORT_API_KEY"], env["MATTERPORT_TOKEN"])
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Matched suite imported; raw records and credentials remain local. Geometry is explicitly simplified.")
