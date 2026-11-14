import { describe, expect, it } from "vitest";
import { measuredShellHeight, openingVerticalSpan } from "./measuredShell";
import type { MeasuredFloorPlan, PlanOpening } from "../../shared/floorplan";

describe("measured opening presentation", () => {
  const window: PlanOpening = { id: "tall", type: "window", center: .5, width: 3, height: 3.757 };
  it("preserves a measured tall opening instead of clipping at 2.2m", () => {
    const span = openingVerticalSpan(window);
    expect(span.top - span.bottom).toBeCloseTo(3.757);
    const plan = { rooms: [], walls: [{ openings: [window] }] } as unknown as MeasuredFloorPlan;
    expect(measuredShellHeight(plan)).toBeGreaterThan(span.top);
  });
  it("uses a normalized measured sill, never raw absolute source elevation", () => {
    expect(openingVerticalSpan({ ...window, lowerElevation: .25, sourceLowerElevation: 105.25 })).toEqual({ bottom: .25, top: 4.007 });
    expect(openingVerticalSpan({ ...window, sourceLowerElevation: 105.25 }).bottom).toBe(.6);
  });
  it("preserves measured room height above openings", () => {
    const plan = { rooms: [{ height: 5.1 }], walls: [] } as unknown as MeasuredFloorPlan;
    expect(measuredShellHeight(plan)).toBe(5.1);
  });
});
