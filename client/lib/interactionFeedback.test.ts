import { describe, expect, it } from "vitest";
import properties from "../../data/properties.json";
import type { Customer, PropertyListing, RoomSnapshot } from "../../shared/types";
import { addPlayer, advanceBrewing, createRoomSnapshot, interact, openCafe, selectProperty } from "../../server/simulation.ts";
import { interactionSounds } from "./interactionFeedback";

function setup() {
  let s = addPlayer(openCafe(selectProperty(createRoomSnapshot("feedback"), properties[0] as PropertyListing)), "p", "Player", "barista");
  s = { ...s, customers: [{ id: "order", state: "ordering", preference: "latte", persona: "student", name: "Pat",
    budget: 10, patience: 100, progress: 0, x: 2, z: 2, targetX: 2, targetZ: 2, satisfaction: 70, joinedAt: 0 } as Customer] };
  return s;
}
function at(s: RoomSnapshot, kind: "counter" | "coffee_machine" | "pickup" | "fridge") {
  const f = s.layout!.furniture.find((f) => f.kind === kind)!;
  return { ...s, players: s.players.map((p) => ({ ...p, x: f.x, z: f.z })) };
}

describe("accepted interaction feedback", () => {
  it("stays silent for rejected actions, no-op collect and repeated snapshots", () => {
    const far = { ...setup(), players: setup().players.map((p) => ({ ...p, x: 13, z: 9 })) };
    for (const action of ["take_order", "make_coffee", "restock", "collect"] as const) {
      const rejected = interact(far, "p", action);
      expect(interactionSounds(far, rejected, "p")).toEqual([]);
    }
    const poor = at(setup(), "fridge");
    poor.finance = { ...poor.finance, balance: 0 };
    expect(interactionSounds(poor, interact(poor, "p", "restock"), "p")).toEqual([]);
    expect(interactionSounds(poor, poor, "p")).toEqual([]);
  });

  it("plays accepted order and brew once while leaving sale sound to ServeToast", () => {
    const before = at(setup(), "counter");
    const ticket = interact(before, "p", "take_order");
    expect(interactionSounds(before, ticket, "p")).toEqual(["order"]);
    expect(interactionSounds(ticket, interact(ticket, "p", "take_order"), "p")).toEqual([]);
    const machine = at(ticket, "coffee_machine");
    const brewing = interact(machine, "p", "make_coffee");
    expect(interactionSounds(machine, brewing, "p")).toEqual(["brew"]);
    expect(interactionSounds(brewing, brewing, "p")).toEqual([]);
    const finished = advanceBrewing({ ...brewing, simTime: brewing.simTime + 2 });
    expect(interactionSounds(brewing, finished, "p")).toEqual([]);
    // A throttled render can observe the completed brew without its intermediate snapshot.
    expect(interactionSounds(machine, finished, "p")).toEqual(["brew"]);
    const pickup = at(finished, "pickup");
    const served = interact(pickup, "p", "serve");
    expect(served.metrics.customersServed).toBe(1);
    expect(interactionSounds(pickup, served, "p")).toEqual([]);
    expect(interactionSounds(served, interact(served, "p", "collect"), "p")).toEqual([]);
  });

  it("requires both delivered inventory and a new receipt, without replaying history on room changes", () => {
    const before = at(setup(), "fridge");
    const delivered = interact(before, "p", "restock");
    expect(interactionSounds(before, delivered, "p")).toEqual(["place"]);
    expect(interactionSounds(delivered, delivered, "p")).toEqual([]);
    expect(interactionSounds(before, { ...delivered, finance: before.finance }, "p")).toEqual([]);
    expect(interactionSounds(before, { ...delivered, inventory: before.inventory }, "p")).toEqual([]);
    expect(interactionSounds(before, { ...delivered, code: "another-room" }, "p")).toEqual([]);
    expect(interactionSounds(before, delivered, null)).toEqual([]);
  });
});
