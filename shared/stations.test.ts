import { describe, expect, it } from "vitest";
import { nearStation, nearestStation } from "./stations.ts";
import properties from "../data/properties.json";
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


describe("measured station access", () => {
  it("requires access through a doorway instead of interacting through a wall", () => {
    const snap = baseSnap();
    snap.layout!.furniture = [snap.layout!.furniture[1]];
    snap.players[0] = { ...snap.players[0], x: 2.1, z: 3 };
    snap.property = { ...properties[0], city: "Houston", width: 8, depth: 8, floorPlan: {
      modelId: "test", floorId: "floor", units: "meters", entry: { x: 1, z: 1 }, serviceOrigin: { x: 1, z: 1 },
      rooms: [{ id: "room", areaM2: 64, polygon: [{x:0,z:0},{x:8,z:0},{x:8,z:8},{x:0,z:8}] }],
      walls: [{ id: "divider", a: {x:3,z:0}, b:{x:3,z:8}, thickness:.16, openings:[] }],
    } };
    expect(nearStation(snap, "u1", ["coffee_machine"])).toBe(false);
    expect(nearestStation(snap, "u1")).toBeNull();
    snap.property = { ...snap.property, floorPlan: { ...snap.property.floorPlan!, walls: [{
      ...snap.property.floorPlan!.walls[0], openings: [{ id:"door",type:"doorway",center:3/8,width:1.2,height:2.1 }],
    }] } };
    expect(nearStation(snap, "u1", ["coffee_machine"])).toBe(true);
    expect(nearestStation(snap, "u1")).toBe("machine");
  });
});
