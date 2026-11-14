import { describe, expect, it } from "vitest";
import { getLook, moveFromKeys, setLook } from "./look";

describe("look / moveFromKeys", () => {
  it("moves forward along -Z when yaw is 0", () => {
    setLook(0, 0);
    const { dx, dz } = moveFromKeys(new Set(["w"]), 1);
    expect(dx).toBeCloseTo(0, 5);
    expect(dz).toBeCloseTo(-1, 5);
  });

  it("strafes along +X when yaw is 0", () => {
    setLook(0, 0);
    const { dx, dz } = moveFromKeys(new Set(["d"]), 1);
    expect(dx).toBeCloseTo(1, 5);
    expect(dz).toBeCloseTo(0, 5);
  });

  it("turns forward with yaw", () => {
    setLook(Math.PI / 2, 0);
    const { dx, dz } = moveFromKeys(new Set(["w"]), 1);
    expect(dx).toBeCloseTo(1, 5);
    expect(dz).toBeCloseTo(0, 5);
  });

  it("clamps pitch", () => {
    setLook(0, 99);
    expect(getLook().pitch).toBeLessThanOrEqual(1.2);
  });
});
