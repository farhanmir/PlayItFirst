import { describe, expect, it } from "vitest";
import { correctLegacyMatterportFloor, floorMoveClear, floorPositionClear, solidWallSegments, type MeasuredFloorPlan } from "./floorplan";
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
  it("corrects Model API handedness once while preserving directed wall openings and collision", () => {
    const legacy: MeasuredFloorPlan = {
      modelId: "synthetic", floorId: "floor", units: "meters", entry: { x: 1, z: 3 }, serviceOrigin: { x: 4, z: 4 },
      rooms: [{ id: "room", areaM2: 192, polygon: [{ x: 0, z: 0 }, { x: 16, z: 0 }, { x: 16, z: 12 }, { x: 0, z: 12 }] }],
      walls: [{ id: "west", a: { x: 0, z: 0 }, b: { x: 0, z: 12 }, thickness: 0.16,
        openings: [{ id: "door", type: "doorway", center: 0.25, width: 1.2, height: 2.3 }] }],
    };
    const corrected = correctLegacyMatterportFloor(legacy, 16, 12);
    expect(corrected.rooms[0].polygon[0]).toEqual({ x: 0, z: 12 });
    expect(corrected.entry).toEqual({ x: 1, z: 9 });
    expect(corrected.walls[0].a).toEqual({ x: 0, z: 12 });
    expect(corrected.walls[0].b).toEqual({ x: 0, z: 0 });
    expect(corrected.walls[0].openings).toEqual(legacy.walls[0].openings);
    const segments = solidWallSegments(corrected.walls[0]);
    expect(segments[0].b.z).toBeCloseTo(9.6);
    expect(segments[1].a.z).toBeCloseTo(8.4);
    expect(floorPositionClear(corrected, 0.1, 9)).toBe(true);
    expect(floorPositionClear(corrected, 0.1, 3)).toBe(false);
    for (const [x, z] of [[1, 2], [3, 2], [5, 2], [2, 5], [5, 5]]) {
      expect(floorPositionClear(corrected, corrected.serviceOrigin.x + x, corrected.serviceOrigin.z + z, 0.6)).toBe(true);
    }
    expect(correctLegacyMatterportFloor(corrected, 16, 12)).toBe(corrected);
    expect(legacy.entry.z).toBe(3);
  });
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
