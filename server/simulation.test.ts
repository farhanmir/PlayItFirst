import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { PropertyListing } from "../shared/types.ts";
import {
  createRoomSnapshot,
  openCafe,
  placeFurniture,
  selectProperty,
  stepSimulation,
  buildBlueprint,
} from "./simulation.ts";

const listing = (properties as PropertyListing[])[0];

describe("café simulation", () => {
  it("selects a property and spends starter budget", () => {
    let snap = createRoomSnapshot("demo");
    snap = selectProperty(snap, listing);
    expect(snap.property?.id).toBe(listing.id);
    expect(snap.layout?.furniture.length).toBeGreaterThan(3);
    expect(snap.finance.balance).toBeLessThan(snap.startingBudget);
    expect(snap.phase).toBe("build");
  });

  it("runs customers after opening", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = openCafe(snap);
    for (let i = 0; i < 200; i++) snap = stepSimulation(snap, 0.2);
    expect(snap.customers.length + snap.metrics.customersServed + snap.metrics.customersLost).toBeGreaterThan(0);
  });

  it("places furniture when funds allow", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    const before = snap.layout!.furniture.length;
    snap = placeFurniture(snap, "decoration", 5, 5);
    expect(snap.layout!.furniture.length).toBe(before + 1);
  });

  it("builds a blueprint markdown", () => {
    const snap = selectProperty(createRoomSnapshot("demo"), listing);
    const md = buildBlueprint(snap);
    expect(md).toContain("Business Launch Blueprint");
    expect(md).toContain(listing.name);
  });
});
