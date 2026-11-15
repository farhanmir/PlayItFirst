import type { FurnitureKind, RoomSnapshot } from "./types.ts";
import { floorMoveClear } from "./floorplan.ts";

export const BREW_SECONDS = 1.6;

export type StationHint = "counter" | "machine" | "pickup" | "fridge";

const STATION_MAP: { kind: FurnitureKind; station: StationHint }[] = [
  { kind: "counter", station: "counter" },
  { kind: "coffee_machine", station: "machine" },
  { kind: "pickup", station: "pickup" },
  { kind: "fridge", station: "fridge" },
];

/** Max distance (world units) to count as "near" a station. */
const NEAR_RADIUS = 2.4;

export function nearStation(snapshot: RoomSnapshot, playerId: string, kinds: FurnitureKind[]): boolean {
  const player = snapshot.players.find((p) => p.id === playerId);
  return !!player && !!snapshot.layout?.furniture.some((item) =>
    kinds.includes(item.kind) && Math.hypot(item.x - player.x, item.z - player.z) <= NEAR_RADIUS &&
    (!snapshot.property?.floorPlan || floorMoveClear(snapshot.property.floorPlan, player, item, .05)),
  );
}

/**
 * Nearest interactive station for a player, or null if none are in range.
 * Used for client action hints (`nearStation`).
 */
export function nearestStation(snapshot: RoomSnapshot, playerId: string, kinds?: FurnitureKind[]): StationHint | null {
  const player = snapshot.players.find((p) => p.id === playerId);
  if (!player || !snapshot.layout) return null;

  let best: StationHint | null = null;
  let bestDist = Infinity;

  for (const { kind, station } of STATION_MAP) {
    for (const item of snapshot.layout.furniture) {
      if (item.kind !== kind || (kinds && !kinds.includes(kind))) continue;
      if (snapshot.property?.floorPlan && !floorMoveClear(snapshot.property.floorPlan, player, item, .05)) continue;
      const dist = Math.hypot(item.x - player.x, item.z - player.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = station;
      }
    }
  }

  return bestDist <= NEAR_RADIUS ? best : null;
}

/** A dedicated pickup must be the closer handoff station, even when ranges overlap. */
export function nearServingStation(snapshot: RoomSnapshot, playerId: string): boolean {
  const hasPickup = snapshot.layout?.furniture.some(item => item.kind === "pickup");
  if (!hasPickup) return nearStation(snapshot, playerId, ["counter"]);
  return nearestStation(snapshot, playerId, ["counter", "pickup"]) === "pickup";
}
