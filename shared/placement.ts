import type { FurnitureItem, FurnitureKind, PropertyListing } from "./types";

// Half-metre snapping is identical for mouse and touch placement.
export const snapFloor = (value: number) => Math.round(value * 2) / 2;

export function placementIssue(
  property: Pick<PropertyListing, "width" | "depth">,
  furniture: FurnitureItem[],
  kind: FurnitureKind,
  x: number,
  z: number,
  movingId?: string | null,
): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return "Choose a floor position";
  if (x < 0.5 || z < 0.5 || x > property.width - 0.5 || z > property.depth - 0.5) return "Keep inside the café";
  if (furniture.some((item) => item.id !== movingId && Math.hypot(item.x - x, item.z - z) <
    (kind === "decoration" || item.kind === "decoration" ? 0.25 : 0.6))) {
    return "Leave room around furniture";
  }
  return null;
}
