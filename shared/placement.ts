import type { FurnitureItem, FurnitureKind, PropertyListing } from "./types";
import { floorPositionClear } from "./floorplan";

// Half-metre snapping is identical for mouse and touch placement.
export const snapFloor = (value: number) => Math.round(value * 2) / 2;

export function placementIssue(
  property: Pick<PropertyListing, "width" | "depth" | "floorPlan">,
  furniture: FurnitureItem[],
  kind: FurnitureKind,
  x: number,
  z: number,
  movingId?: string | null,
): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return "Choose a floor position";
  if (x < 0.5 || z < 0.5 || x > property.width - 0.5 || z > property.depth - 0.5) return "Keep inside the café";
  if (property.floorPlan && !floorPositionClear(property.floorPlan, x, z, kind === "decoration" ? 0.25 : 0.6)) return "Keep furniture on the measured floor, clear of walls and doors";
  if (furniture.some((item) => item.id !== movingId && Math.hypot(item.x - x, item.z - z) <
    (kind === "decoration" || item.kind === "decoration" ? 0.25 : 0.6))) {
    return "Leave room around furniture";
  }
  return null;
}

/** Stations service cannot run without; the last one of each kind cannot be deleted. */
const ESSENTIAL_KINDS: Partial<Record<FurnitureKind, string>> = { counter: "service counter", coffee_machine: "espresso machine", pickup: "pickup station" };

/** Returns why this piece cannot be deleted, or null when deletion is allowed. */
export function removalIssue(furniture: FurnitureItem[], id: string): string | null {
  const item = furniture.find((f) => f.id === id);
  if (!item) return null;
  const name = ESSENTIAL_KINDS[item.kind];
  if (name && furniture.filter((f) => f.kind === item.kind).length <= 1) return `Keep at least one ${name} so the café can serve.`;
  return null;
}
