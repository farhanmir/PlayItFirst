import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { PropertyListing } from "../shared/types.ts";
import { applyDirectorChoice, forceDemoRushEvent } from "./director.ts";
import { createRoomSnapshot, openCafe, selectProperty } from "./simulation.ts";

const listing = (properties as PropertyListing[])[0];

describe("director choices", () => {
  it("open_station places a coffee machine instead of inventing queueLength", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("dir"), listing));
    const beforeMachines = snap.layout!.furniture.filter((f) => f.kind === "coffee_machine").length;
    const beforeQueue = snap.metrics.queueLength;
    snap = { ...snap, director: forceDemoRushEvent() };
    const { snapshot } = applyDirectorChoice(snap, "open_station");
    const afterMachines = snapshot.layout!.furniture.filter((f) => f.kind === "coffee_machine").length;
    expect(afterMachines).toBe(beforeMachines + 1);
    expect(snapshot.metrics.queueLength).toBe(beforeQueue);
    expect(snapshot.director?.resolved).toBe("open_station");
  });

  it("refuses to charge twice when already resolved", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("dir"), listing));
    const balance = snap.finance.balance;
    snap = { ...snap, director: { ...forceDemoRushEvent(), resolved: "temp_help" } };
    const { snapshot } = applyDirectorChoice(snap, "temp_help");
    expect(snapshot.finance.balance).toBe(balance);
  });

  it("reduce_menu sets menuReduced without rewriting avgWaitSec", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("dir"), listing));
    snap = {
      ...snap,
      metrics: { ...snap.metrics, avgWaitSec: 42 },
      director: forceDemoRushEvent(),
    };
    const { snapshot } = applyDirectorChoice(snap, "reduce_menu");
    expect(snapshot.menuReduced).toBe(true);
    expect(snapshot.metrics.avgWaitSec).toBe(42);
  });
});
