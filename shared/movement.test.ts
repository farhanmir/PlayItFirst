import { describe, expect, it } from "vitest";
import { furnitureMoveClear } from "./movement";
import type { FurnitureItem } from "./types";
const counter: FurnitureItem = { id: "c", kind: "counter", label: "Counter", x: 3, z: 3, rotation: 0, cost: 0 };
describe("furniture movement", () => {
  it("blocks entry and tunneling through equipment", () => {
    expect(furnitureMoveClear([counter], { x: 1, z: 3 }, { x: 3, z: 3 })).toBe(false);
    expect(furnitureMoveClear([counter], { x: 1, z: 3 }, { x: 5, z: 3 })).toBe(false);
    expect(furnitureMoveClear([counter], { x: 1, z: 2 }, { x: 5, z: 2 })).toBe(true);
  });
  it("respects the wide counter ends and rotation", () => {
    expect(furnitureMoveClear([counter], { x: 4, z: 1 }, { x: 4, z: 5 })).toBe(false);
    expect(furnitureMoveClear([{ ...counter, rotation: Math.PI / 2 }], { x: 4, z: 1 }, { x: 4, z: 5 })).toBe(true);
  });
  it("allows escape after a shared layout edit encloses the player", () => {
    expect(furnitureMoveClear([counter], { x: 3.1, z: 3 }, { x: 3.5, z: 3 })).toBe(true);
    expect(furnitureMoveClear([counter], { x: 3.5, z: 3 }, { x: 3.1, z: 3 })).toBe(false);
  });
});
