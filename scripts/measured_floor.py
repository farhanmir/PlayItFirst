"""Convert authorized Matterport floor topology to game coordinates; no texture/asset copying."""
import math
from collections import Counter


def inside(p, polygon):
    x, z = p
    result = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > z) != (b[1] > z) and x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result


def convert_floor(model):
    if len(model.get("floors", [])) != 1:
        raise ValueError("This converter requires a single captured floor; never silently drops floors")
    floor = model["floors"][0]
    elevations = [r["dimensionEstimates"].get("lowerElevation") for r in model["rooms"]]
    elevations = [v for v in elevations if isinstance(v, (int, float)) and math.isfinite(v)]
    floor_elevation = min(elevations) if elevations else None
    edges = {e["id"]: e for e in floor["edges"]}
    coordinates = [v["position"] for e in edges.values() for v in e["vertices"]]
    min_x = min(p["x"] for p in coordinates) - 0.6
    # Model API is Z-up; Showcase / Three is Y-up. Preserve handedness:
    # (api x, api y, api z) -> (game x, api z, -api y).
    # https://developers.matterport.com/overview/concepts/#api-to-sdk-conversions
    min_z = -max(p["y"] for p in coordinates) - 0.6
    width = max(p["x"] for p in coordinates) - min_x + 0.6
    depth = -min(p["y"] for p in coordinates) - min_z + 0.6
    point = lambda v: (v["position"]["x"] - min_x, -v["position"]["y"] - min_z)
    rooms = []
    for room in model["rooms"]:
        refs = [edges[e["id"]] for e in room["boundary"]["edges"]]
        # Some room boundaries include internal wall spurs. They remain physical
        # walls below, but cannot be part of the room's enclosing floor polygon.
        while refs:
            degree = Counter(v["id"] for e in refs for v in e["vertices"])
            trimmed = [e for e in refs if all(degree[v["id"]] > 1 for v in e["vertices"])]
            if len(trimmed) == len(refs):
                break
            refs = trimmed
        if len(refs) < 3:
            raise ValueError("Room has no enclosing boundary cycle")
        first = refs.pop(0)
        current = first["vertices"][1]["id"]
        start = first["vertices"][0]["id"]
        polygon = [point(v) for v in first["vertices"]]
        while refs:
            index = next((i for i, e in enumerate(refs) if any(v["id"] == current for v in e["vertices"])), None)
            if index is None:
                raise ValueError("Room boundary is not a connected loop")
            edge = refs.pop(index)
            vertex = next(v for v in edge["vertices"] if v["id"] != current)
            current = vertex["id"]
            polygon.append(point(vertex))
        if current != start:
            raise ValueError("Room boundary is not closed")
        converted_room = {"id": room["id"], "areaM2": room["dimensionEstimates"]["area"],
                          "polygon": [{"x": x, "z": z} for x, z in polygon[:-1]]}
        if room.get("label"):
            converted_room["label"] = room["label"]
            converted_room["labelSource"] = "user-label"
        else:
            labels = {c["label"].strip() for c in room.get("classifications", [])
                      if isinstance(c.get("label"), str) and c["label"].strip()
                      and c["label"].strip().lower() not in ("unknown", "other", "unclassified", "room")}
            if len(labels) == 1:
                converted_room["label"] = next(iter(labels))
                converted_room["labelSource"] = "detected-classification"
        room_height = room["dimensionEstimates"].get("height")
        if isinstance(room_height, (int, float)) and math.isfinite(room_height) and room_height > 0:
            converted_room["height"] = room_height
        rooms.append(converted_room)
    walls = []
    for e in edges.values():
        if e["type"] != "wall":
            continue  # invisible edges describe room divisions, not physical walls
        a, b = [point(v) for v in e["vertices"]]
        walls.append({"id": e["id"], "a": {"x": a[0], "z": a[1]}, "b": {"x": b[0], "z": b[1]},
                      "thickness": e.get("thickness") or 0.16,
                      "openings": [{"id": o["id"], "type": o["type"], "center": o["relativeCenter"],
                                    "width": o["width"], "height": o.get("height") or 2.1,
                                    **({"sourceLowerElevation": o["lowerElevation"]} if o.get("lowerElevation") is not None else {}),
                                    **({"lowerElevation": o["lowerElevation"] - floor_elevation}
                                       if floor_elevation is not None and o.get("lowerElevation") is not None else {})}
                                   for o in e["openings"]]})
    main = max(rooms, key=lambda r: r["areaM2"])
    main_poly = [(p["x"], p["z"]) for p in main["polygon"]]
    def clear(x, z):
        if not inside((x, z), main_poly):
            return False
        for w in walls:
            a, b = w["a"], w["b"]
            dx, dz = b["x"] - a["x"], b["z"] - a["z"]
            t = max(0, min(1, ((x - a["x"]) * dx + (z - a["z"]) * dz) / (dx * dx + dz * dz)))
            if math.hypot(x - a["x"] - t * dx, z - a["z"] - t * dz) < 0.85:
                return False
        return True
    pattern = [(1, 2), (3, 2), (5, 2), (2, 5), (5, 5), (1.2, 5), (2.8, 5), (0.5, 0.5), (3, 4), (1, 3)]
    origins = [(x / 2, z / 2) for x in range(1, int(width * 2)) for z in range(1, int(depth * 2))
               if all(clear(x / 2 + px, z / 2 + pz) for px, pz in pattern)]
    if not origins:
        raise ValueError("No safe starter café area; manual layout required")
    ox, oz = min(origins, key=lambda p: (p[0] - (width - 7.2)) ** 2 + (p[1] - (depth - 9.2)) ** 2)
    uses = Counter(e["id"] for r in model["rooms"] for e in r["boundary"]["edges"])
    entries = []
    for w in walls:
        if uses[w["id"]] != 1:
            continue
        dx, dz = w["b"]["x"] - w["a"]["x"], w["b"]["z"] - w["a"]["z"]
        length = math.hypot(dx, dz)
        for o in w["openings"]:
            if o["type"] != "doorway":
                continue
            cx, cz = w["a"]["x"] + dx * o["center"], w["a"]["z"] + dz * o["center"]
            for sign in [-1, 1]:
                x, z = cx - sign * dz / length * 0.45, cz + sign * dx / length * 0.45
                if any(inside((x, z), [(p["x"], p["z"]) for p in r["polygon"]]) for r in rooms):
                    entries.append((x, z))
    if not entries:
        raise ValueError("No measured external doorway; manual entrance review required")
    ex, ez = min(entries, key=lambda p: (p[0] - ox) ** 2 + (p[1] - oz) ** 2)
    return {"modelId": model["id"], "floorId": floor["id"], "units": "meters", "coordinateConvention": "matterport-api-x-neg-y-v1", "rooms": rooms, "walls": walls,
            **({"sourceFloorElevation": floor_elevation} if floor_elevation is not None else {}),
            "entry": {"x": ex, "z": ez}, "serviceOrigin": {"x": ox, "z": oz}}, width, depth
