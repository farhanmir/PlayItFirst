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


describe("truthful director outcomes", () => {
  it("does not charge for or invent temporary staff", () => {
    const state = { ...openCafe(selectProperty(createRoomSnapshot("free"), listing)), rushBoost: 1, director: forceDemoRushEvent() };
    const result = applyDirectorChoice(state, "temp_help");
    expect(result.snapshot.finance).toBe(state.finance);
    expect(result.snapshot.players).toBe(state.players);
    expect(result.snapshot.aiBarista).toBe(state.aiBarista);
    expect(result.snapshot.lastHumanInteractAt).toBe(state.lastHumanInteractAt);
    expect(result.snapshot.rushBoost).toBe(0.5);
    expect(result.photon).toContain("no worker was hired");
    expect(forceDemoRushEvent().choices.find((choice) => choice.id === "temp_help")?.label).toContain("free");
  });
  it("reports failed station placement without charging or claiming a reassignment", () => {
    const state = { ...openCafe(selectProperty(createRoomSnapshot("blocked"), listing)), director: forceDemoRushEvent() };
    state.layout!.furniture.push({ id: "obstacle", kind: "table", label: "Table", x: 2.8, z: 6.2, rotation: 0, cost: 0 });
    const result = applyDirectorChoice(state, "open_station");
    expect(result.snapshot.layout).toBe(state.layout);
    expect(result.snapshot.finance).toBe(state.finance);
    expect(result.photon).toContain("machine not added");
    expect(result.snapshot.eventLog[0]).toContain("not added");
    expect(result.photon).not.toContain("jordan");
  });
  it("reports insufficient funds without claiming a station exists", () => {
    const state = { ...openCafe(selectProperty(createRoomSnapshot("poor"), listing)), director: forceDemoRushEvent() };
    state.finance = { ...state.finance, balance: 0 };
    const result = applyDirectorChoice(state, "open_station");
    expect(result.snapshot.finance.balance).toBe(0);
    expect(result.photon).toContain("Insufficient funds");
    expect(result.snapshot.layout).toBe(state.layout);
  });
});
