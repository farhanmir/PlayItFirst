"""Import verified matched suites into an ignored local demo file. Never executes kit code."""
import argparse
import base64
import csv
import io
import json
import math
import os
import time
from pathlib import Path
import urllib.request
import zipfile
from measured_floor import convert_floor


def candidate_suites(archive, password):
    """Find active, exact-area USD spaces whose own attachment matches the property/model table."""
    with zipfile.ZipFile(archive) as kit:
        kit.setpassword(password.encode())
        rows = csv.DictReader(io.StringIO(kit.read("commercial-properties.csv").decode("utf-8-sig")))
        matches = {(row["PropertyId"], row["MatterportModelId"]): row for row in rows
                   if row["City"] in ("Houston", "Los Angeles") and row["MatterportModelId"]}
        candidates = []
        for line in kit.open("data/commercial-listing-summary.jsonl"):
            listing = json.loads(line)
            if listing.get("listingStatus") != 1:
                continue
            lease = listing.get("forLeaseSummary") or {}
            if lease.get("askingRateMeasurementType") != 1:
                continue
            for space in lease.get("spaces") or []:
                plan = space.get("floorPlan") or {}
                model = plan.get("videoKey")
                row = matches.get((str(listing["propertyId"]), model))
                if (not row or plan.get("videoExternalReferenceType") not in (36, 234)
                        or space.get("dateOffMarket") or space.get("isLeasePending")
                        or space.get("monetaryUnit") != 1 or space.get("rateBasis") not in (1, 2)
                        or not isinstance(space.get("rateLow"), (int, float)) or space["rateLow"] <= 0
                        or not isinstance(space.get("squareFeetMin"), (int, float))
                        or space["squareFeetMin"] <= 0 or space["squareFeetMin"] != space.get("squareFeetMax")):
                    continue
                candidates.append({"listingId": listing["id"], "spaceId": space["id"],
                                   "address": row["Address"], "city": row["City"],
                                   "suite": space.get("suite", ""), "modelId": model})
    return candidates


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
    query = {"query": "query($id:ID!) { model(id:$id) { id name dimensionEstimates(units:metric) { area } floors { id edges { id type thickness vertices { id position { x y } } openings { id type relativeCenter width height lowerElevation } } } rooms { id label classifications { label } dimensionEstimates(units:metric) { area height lowerElevation } boundary { edges { id } } } } }", "variables": {"id": model}}
    request = urllib.request.Request("https://api.matterport.com/api/models/graph", data=json.dumps(query).encode(), headers={
        "Authorization": "Basic " + base64.b64encode(f"{key}:{token}".encode()).decode(), "Content-Type": "application/json"})
    response = json.load(urllib.request.urlopen(request, timeout=20))
    live = response.get("data", {}).get("model")
    if response.get("errors") or not live or live["id"] != model:
        raise ValueError("Matched model failed live verification")
    scan_area = live.get("dimensionEstimates", {}).get("area")
    if not scan_area or not math.isfinite(scan_area) or scan_area <= 0:
        raise ValueError("No usable measured scan area")
    floor_plan, width, depth = convert_floor(live)
    floor_plan["metadataSource"] = "matterport-live"
    floor_plan["metadataFetchedAt"] = round(time.time() * 1000)
    return [{
        "id": f"costar-{listing['propertyId']}-{space_id}", "name": f"{matched['Address']} · Suite {space.get('suite', '')}",
        "city": matched["City"], "neighborhood": "", "address": f"{matched['Address']}, {matched['City']}, {matched['State']}",
        "sqft": area, "monthlyRent": round(area * rate / (12 if basis == 2 else 1), 2),
        "width": width, "depth": depth, "floorPlan": floor_plan, "capacity": 28, "footTraffic": 0.6,
        "costarId": str(listing["propertyId"]), "matterportModelId": model,
        "matterportEmbedUrl": f"https://my.matterport.com/show/?m={model}", "source": "costar-extract", "imageTone": "#6b8068",
        "description": "Authorized event extract: active commercial suite. Asking terms are not an executed lease; permitted café use has not been independently verified.",
        "matterportHint": f"Measured walls, rooms and openings from matched scan: {live.get('name', model)}. Original game materials and equipment.",
        "provenance": {"listingId": str(listing_id), "spaceId": str(space_id), "suite": space.get("suite", ""), "askingRate": rate,
            "rateBasis": "USD/sqft/year" if basis == 2 else "USD/sqft/month", "scanAreaM2": scan_area,
            "geometry": "Measured single-floor room polygons, walls and openings; Model API x/-y translated to right-handed game x/z in meters",
            "assumptions": ["Operational entrance chosen among measured exterior doors", "New café equipment positions", "Missing wall heights and sill elevations use labeled reconstruction assumptions", "Game materials approximate the walkthrough; original scan textures are not included", "28-person simulation capacity", "0.6 simulated foot traffic", "CAM/taxes/additional charges excluded", "Permitted café use not independently verified"]},
    }]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--listing", type=int)
    parser.add_argument("--space", type=int)
    parser.add_argument("--suite", action="append", metavar="LISTING:SPACE",
                        help="Repeat to import several verified suites into one file")
    parser.add_argument("--candidates", action="store_true", help="List eligible listing/model pairs without calling Matterport")
    parser.add_argument("--out", default=".sponsor/property.json")
    args = parser.parse_args()
    env = dict(os.environ)
    if Path(".env").exists():
        for line in Path(".env").read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k, v)
    archive, password = env["COSTAR_KIT_PATH"], env["COSTAR_KIT_PASSWORD"]
    if args.candidates:
        for candidate in candidate_suites(archive, password):
            print(json.dumps(candidate))
        raise SystemExit(0)
    pairs = []
    if args.listing is not None or args.space is not None:
        if args.listing is None or args.space is None:
            parser.error("--listing and --space must be used together")
        pairs.append((args.listing, args.space))
    for pair in args.suite or []:
        try:
            listing_id, space_id = map(int, pair.split(":"))
        except ValueError:
            parser.error("--suite requires LISTING:SPACE numeric IDs")
        pairs.append((listing_id, space_id))
    if not pairs or len(pairs) != len(set(pairs)):
        parser.error("provide distinct --listing/--space or --suite pairs")
    result = []
    for listing_id, space_id in pairs:
        result.extend(import_suite(archive, password, listing_id, space_id,
                                   env["MATTERPORT_API_KEY"], env["MATTERPORT_TOKEN"]))
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Matched suite imported with measured topology; raw records and credentials remain local.")
