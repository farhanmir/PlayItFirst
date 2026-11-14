import { describe, expect, it } from "vitest";
import { placementIssue, snapFloor } from "./placement";
import { createRoomSnapshot, selectProperty, placeFurniture, moveFurniture } from "../server/simulation";
import properties from "../data/properties.json";
import type { PropertyListing } from "./types";

describe("shared build placement", () => {
  const property = properties[0] as PropertyListing;
  it("snaps to half metres and rejects nonfinite and outside coordinates", () => {
    expect(snapFloor(3.24)).toBe(3);
    expect(snapFloor(3.26)).toBe(3.5);
    expect(placementIssue(property, [], "table", NaN, 3)).toBeTruthy();
    expect(placementIssue(property, [], "table", 0, 3)).toBeTruthy();
  });
  it("rejects overlapping purchases and moves without charging or changing layout", () => {
    const room = selectProperty(createRoomSnapshot("build"), property);
    const counter = room.layout!.furniture.find((f) => f.kind === "counter")!;
    const table = room.layout!.furniture.find((f) => f.kind === "table")!;
    const placed = placeFurniture(room, "table", counter.x, counter.z);
    expect(placed.layout).toEqual(room.layout);
    expect(placed.finance).toEqual(room.finance);
    const moved = moveFurniture(room, table.id, counter.x, counter.z);
    expect(moved.layout).toEqual(room.layout);
    expect(placementIssue(property, room.layout!.furniture, "table", table.x, table.z, table.id)).toBeNull();
  });
});
