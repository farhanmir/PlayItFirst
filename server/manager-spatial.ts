import { createHash } from "node:crypto";
import type { RoomSnapshot, Vec2 } from "../shared/types.ts";
import type { PickupMove } from "../shared/manager.ts";
import { moveFurniture } from "./simulation.ts";
import { staffRoute, staffSpawn } from "./staffNavigation.ts";

export function layoutSignature(snapshot: RoomSnapshot): string {
  const p = snapshot.property;
  return createHash("sha256").update(JSON.stringify([p ? { id: p.id, width: p.width, depth: p.depth, floorPlan: p.floorPlan } : null, snapshot.layout?.furniture])).digest("hex");
}
function distance(start: Vec2, route: Vec2[]): number {
  return route.reduce((total, point, index) => total + Math.hypot(point.x - (route[index - 1] ?? start).x, point.z - (route[index - 1] ?? start).z), 0);
}
export function pickupRouteDistance(snapshot: RoomSnapshot, start: Vec2): number | null {
  if (!snapshot.property || !snapshot.layout) return null;
  const route = staffRoute(snapshot.property, snapshot.layout, start, ["pickup"]);
  return route.length ? distance(start, route) : null;
}
/** Bounded layout comparison using the same wall/furniture-clearance planner as Jamie. */
export function suggestPickupMove(snapshot: RoomSnapshot): PickupMove | null {
  const { property, layout } = snapshot;
  if (!property || !layout) return null;
  // Multiple pickup stations need a station-specific planner; do not imply which one was reached.
  const pickups = layout.furniture.filter((item) => item.kind === "pickup");
  const machine = layout.furniture.find((item) => item.kind === "coffee_machine");
  const spawn = staffSpawn(property, layout);
  if (pickups.length !== 1 || !machine || !spawn) return null;
  const pickup = pickups[0];
  const start = staffRoute(property, layout, spawn, ["coffee_machine"]).at(-1);
  if (!start) return null;
  const before = pickupRouteDistance(snapshot, start);
  if (before == null || before < 0.6) return null;
  let best: PickupMove | null = null;
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
    const x = Math.round((machine.x + dx) * 2) / 2, z = Math.round((machine.z + dz) * 2) / 2;
    // Preserve usable station silhouettes as well as the minimum collision checks.
    if (layout.furniture.some((f) => f.id !== pickup.id && f.kind !== "decoration" && Math.hypot(f.x - x, f.z - z) < 1.6)) continue;
    const candidate = moveFurniture(snapshot, pickup.id, x, z);
    if (candidate.layout === layout) continue;
    // Do not propose placing furniture through an active player, staff member or guest.
    const occupants = [...snapshot.players, ...snapshot.customers, ...(snapshot.aiBarista?.x != null && snapshot.aiBarista.z != null ? [snapshot.aiBarista as Vec2] : [])];
    if (occupants.some((p) => Math.hypot(p.x - x, p.z - z) < 0.9)) continue;
    const after = pickupRouteDistance(candidate, start);
    if (after == null || before - after < 0.6 || (best && after >= best.afterDistance)) continue;
    best = { furnitureId: pickup.id, from: { x: pickup.x, z: pickup.z }, to: { x, z }, start,
      layoutSignature: layoutSignature(snapshot), beforeDistance: before, afterDistance: after,
      unit: property.floorPlan ? "meters" : "simulation units",
      method: "Clearance-aware BFS from the same espresso approach to pickup interaction range. Modeled walking distance only; no measured service-time gain." };
  }
  return best;
}
export function executePickupMove(snapshot: RoomSnapshot, move: PickupMove) {
  const failed = (detail: string) => ({ ok: false, snapshot, detail });
  if (layoutSignature(snapshot) !== move.layoutSignature) return failed("Layout changed after this proposal. Ask for a fresh route comparison.");
  const occupants = [...snapshot.players, ...snapshot.customers, ...(snapshot.aiBarista?.x != null && snapshot.aiBarista.z != null ? [snapshot.aiBarista as Vec2] : [])];
  if (occupants.some((p) => Math.hypot(p.x - move.to.x, p.z - move.to.z) < 0.9)) return failed("The proposed pickup position is occupied. Ask for a fresh proposal.");
  if (snapshot.layout?.furniture.some((f) => f.id !== move.furnitureId && f.kind !== "decoration" && Math.hypot(f.x - move.to.x, f.z - move.to.z) < 1.6)) return failed("The proposed pickup position is too close to existing furniture.");
  const next = moveFurniture(snapshot, move.furnitureId, move.to.x, move.to.z);
  if (next.layout === snapshot.layout) return failed("The pickup move no longer passes floor and service-path checks.");
  const before = pickupRouteDistance(snapshot, move.start), after = pickupRouteDistance(next, move.start);
  if (before == null || after == null || before - after < 0.6) return failed("The proposed shorter route is no longer valid. Ask for a fresh comparison.");
  const detail = `Pickup moved to (${move.to.x}, ${move.to.z}). Modeled espresso-to-pickup route: ${before.toFixed(1)} → ${after.toFixed(1)} ${move.unit}. Service-time improvement is not yet measured.`;
  return { ok: true, snapshot: { ...next, eventLog: [detail, ...next.eventLog].slice(0, 30) }, detail };
}
