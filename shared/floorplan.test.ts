import { describe, expect, it } from "vitest";
import { floorMoveClear, floorPositionClear, solidWallSegments, type MeasuredFloorPlan } from "./floorplan";
import { measuredRoute } from "../server/navigation";
import { addPlayer, createRoomSnapshot, movePlayer, placeFurniture, selectProperty } from "../server/simulation";
import properties from "../data/properties.json";
import type { PropertyListing } from "./types";

const plan: MeasuredFloorPlan = {
  modelId: "synthetic", floorId: "floor", units: "meters", entry: { x: 2, z: 2 }, serviceOrigin: { x: 4, z: 1 },
  rooms: [{ id: "room", areaM2: 100, polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }] }],
  walls: [{ id: "partition", a: { x: 5, z: 0 }, b: { x: 5, z: 10 }, thickness: 0.16,
    openings: [{ id: "door", type: "doorway", center: 0.5, width: 1.2, height: 2.1 }] }],
};
describe("measured floor topology", () => {
  it("keeps doors passable and walls solid, including long movement attempts", () => {
    expect(solidWallSegments(plan.walls[0])).toHaveLength(2);
    expect(floorMoveClear(plan, { x: 4, z: 2 }, { x: 6, z: 2 })).toBe(false);
    expect(floorMoveClear(plan, { x: 4, z: 5 }, { x: 6, z: 5 })).toBe(true);
    expect(floorPositionClear(plan, -1, 5)).toBe(false);
    expect(floorPositionClear(plan, 5, 2)).toBe(false);
  });
  it("routes around a partition through its real door, and reroutes after furniture edits", () => {
    const property = { ...properties[0], width: 10, depth: 10, floorPlan: plan } as PropertyListing;
    const layout = { propertyId: property.id, budgetSpent: 0, furniture: [] };
    const path = measuredRoute(property, layout, { x: 2, z: 2 }, { x: 8, z: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((p) => p.z > 4.4)).toBe(true);
    for (let i = 1; i < path.length; i++) expect(floorMoveClear(plan, path[i - 1], path[i], 0.16)).toBe(true);
    const sealed = { ...layout, furniture: [{ id: "block", kind: "counter" as const, label: "Counter", cost: 1, rotation: 0, x: 5, z: 5 }] };
    expect(measuredRoute(property, sealed, { x: 2, z: 2 }, { x: 8, z: 2 })).toHaveLength(0);
  });
  it("applies measured walls to authoritative player movement and building", () => {
    const property = { ...properties[0], width: 20, depth: 15, floorPlan: plan } as PropertyListing;
    let snapshot = selectProperty(createRoomSnapshot("floor"), property);
    snapshot = addPlayer(snapshot, "u", "Owner", "owner");
    snapshot = { ...snapshot, players: snapshot.players.map((p) => ({ ...p, x: 4, z: 2 })) };
    expect(movePlayer(snapshot, "u", 6, 2).players[0].x).toBe(4);
    expect(placeFurniture(snapshot, "decoration", 5, 2).layout).toEqual(snapshot.layout);
    expect(movePlayer(snapshot, "u", NaN, 2)).toBe(snapshot);
  });
});
