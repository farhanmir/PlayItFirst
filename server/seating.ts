import type { CafeLayout, PropertyListing, Vec2 } from "../shared/types.ts";
import { floorPositionClear } from "../shared/floorplan.ts";
import { measuredRoute } from "./navigation.ts";

const cache = new WeakMap<CafeLayout, Vec2[]>();
/** One clear waiting place beside each reachable table. Recompute after layout edits. */
export function seatingTargets(property: PropertyListing, layout: CafeLayout): Vec2[] {
  const cached = cache.get(layout);
  if (cached) return cached;
  const targets: Vec2[] = [];
  for (const table of layout.furniture.filter((f) => f.kind === "table" && (f.seats ?? 0) > 0)) {
    for (const [dx, dz] of [[0.95, 0], [-0.95, 0], [0, 0.95], [0, -0.95]]) {
      const point = { x: table.x + dx, z: table.z + dz };
      if (point.x < 0.35 || point.z < 0.35 || point.x > property.width - 0.35 || point.z > property.depth - 0.35) continue;
      if (layout.furniture.some((f) => f.kind !== "decoration" && Math.hypot(f.x - point.x, f.z - point.z) < 0.75)) continue;
      if (property.floorPlan) {
        if (!floorPositionClear(property.floorPlan, point.x, point.z, 0.18)) continue;
        const route = measuredRoute(property, layout, property.floorPlan.entry, point);
        const end = route.at(-1);
        if (!end || Math.hypot(end.x - point.x, end.z - point.z) > 0.4) continue;
      }
      targets.push(point);
      break;
    }
  }
  cache.set(layout, targets);
  return targets;
}
