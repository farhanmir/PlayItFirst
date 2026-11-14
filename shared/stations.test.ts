import { describe, expect, it } from "vitest";
import { nearestStation } from "./stations.ts";
import type { RoomSnapshot } from "./types.ts";

function baseSnap(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: "TEST",
    phase: "play",
    businessType: "cafe",
    property: null,
    layout: {
      propertyId: "p1",
      budgetSpent: 0,
      furniture: [
        { id: "c1", kind: "counter", label: "Counter", x: 2, z: 3, rotation: 0, cost: 0 },
        { id: "m1", kind: "coffee_machine", label: "Machine", x: 4, z: 3, rotation: 0, cost: 0 },
        { id: "p1", kind: "pickup", label: "Pickup", x: 6, z: 3, rotation: 0, cost: 0 },
        { id: "f1", kind: "fridge", label: "Fridge", x: 1, z: 5, rotation: 0, cost: 0 },
      ],
    },
    startingBudget: 20000,
    players: [{ id: "u1", name: "You", role: "barista", x: 2.1, z: 3.1, holding: null, score: 0, color: "#fff" }],
    customers: [],
    finance: { balance: 10000, revenue: 0, expenses: 0, transactions: [], nessieAccountId: "" },
    metrics: {
      customersServed: 0,
      customersLost: 0,
      avgWaitSec: 0,
      satisfaction: 80,
      queueLength: 0,
      revenuePerHour: 0,
    },
    inventory: { beans: 20, milk: 10, cups: 20 },
    director: null,
    photon: [],
    tick: 0,
    simTime: 0,
    open: true,
    eventLog: [],
    ...overrides,
  };
}

describe("nearestStation", () => {
  it("returns counter when player is near counter", () => {
    expect(nearestStation(baseSnap(), "u1")).toBe("counter");
  });

  it("returns machine when closer to machine", () => {
    const snap = baseSnap({
      players: [{ id: "u1", name: "You", role: "barista", x: 4, z: 3, holding: null, score: 0, color: "#fff" }],
    });
    expect(nearestStation(snap, "u1")).toBe("machine");
  });

  it("returns null when far from all stations", () => {
    const snap = baseSnap({
      players: [{ id: "u1", name: "You", role: "barista", x: 20, z: 20, holding: null, score: 0, color: "#fff" }],
    });
    expect(nearestStation(snap, "u1")).toBeNull();
  });
});
