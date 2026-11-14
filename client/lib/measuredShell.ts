import type { MeasuredFloorPlan, PlanOpening } from "../../shared/floorplan";

/** Measured opening height is never replaced by the game's standard door height. */
export function openingVerticalSpan(opening: PlanOpening) {
  const bottom = Math.max(0, opening.lowerElevation ?? (opening.type === "window" ? .6 : 0));
  return { bottom, top: bottom + opening.height };
}

/** Prefer measured room height; missing ceiling data requires an explicit estimate. */
export function measuredShellHeight(plan: MeasuredFloorPlan) {
  const measured = plan.rooms.map(r => r.height ?? 0).filter(h => Number.isFinite(h) && h > 0);
  return Math.max(measured.length ? Math.max(...measured) : 3.6,
    ...plan.walls.flatMap(w => w.openings.map(o => openingVerticalSpan(o).top + .2)));
}
