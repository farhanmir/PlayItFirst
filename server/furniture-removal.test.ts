import { describe, expect, it } from "vitest";
import { removalIssue } from "../shared/placement.ts";
import { createRoomSnapshot, removeFurniture, selectProperty } from "./simulation.ts";
import { getCachedProperties } from "./costar.ts";

const room = () => selectProperty(createRoomSnapshot("removal-test"), getCachedProperties().listings.find((p) => p.id === "hou-eaado-41")!);

describe("deleting placed furniture", () => {
  it("refuses to delete the last service counter, espresso machine or pickup station", () => {
    const snapshot = room();
    for (const kind of ["counter", "coffee_machine", "pickup"] as const) {
      const pieces = snapshot.layout!.furniture.filter((f) => f.kind === kind);
      expect(pieces).toHaveLength(1);
      expect(removalIssue(snapshot.layout!.furniture, pieces[0].id)).toMatch(/Keep at least one/);
      const after = removeFurniture(snapshot, pieces[0].id);
      expect(after).toBe(snapshot);
    }
  });

  it("allows deleting one of two counters, and other furniture, with a 60% refund", () => {
    const snapshot = room();
    const counter = snapshot.layout!.furniture.find((f) => f.kind === "counter")!;
    const twoCounters = { ...snapshot, layout: { ...snapshot.layout!, furniture: [...snapshot.layout!.furniture, { ...counter, id: "extra-counter", x: counter.x + 3 }] } };
    expect(removalIssue(twoCounters.layout.furniture, counter.id)).toBeNull();
    expect(removeFurniture(twoCounters, counter.id).layout!.furniture.filter((f) => f.kind === "counter")).toHaveLength(1);

    const other = snapshot.layout!.furniture.find((f) => f.kind !== "counter" && f.kind !== "coffee_machine" && f.kind !== "pickup")!;
    const after = removeFurniture(snapshot, other.id);
    expect(after.layout!.furniture.some((f) => f.id === other.id)).toBe(false);
    expect(after.finance.balance).toBe(snapshot.finance.balance + Math.round(other.cost * 0.6));
  });
});
