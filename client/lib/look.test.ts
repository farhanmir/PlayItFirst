import { describe, expect, it } from "vitest";
import { Euler, Vector3 } from "three";
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
    expect(dx).toBeCloseTo(-1, 5);
    expect(dz).toBeCloseTo(0, 5);
  });

  it("clamps pitch", () => {
    setLook(0, 99);
    expect(getLook().pitch).toBeLessThanOrEqual(1.2);
  });
});


describe("camera-relative movement", () => {
  it.each([-2.4, -0.9, 0, 1.2, Math.PI / 2])("matches the camera basis at yaw %s", (yaw) => {
    setLook(yaw, 0);
    for (const [key, basis] of [["w", new Vector3(0, 0, -1)], ["d", new Vector3(1, 0, 0)]] as const) {
      const expected = basis.applyEuler(new Euler(0, yaw, 0, "YXZ"));
      const actual = moveFromKeys(new Set([key]), 1);
      expect(actual.dx).toBeCloseTo(expected.x);
      expect(actual.dz).toBeCloseTo(expected.z);
    }
  });
  it("keeps diagonal speed equal to cardinal speed", () => {
    setLook(-0.9, 0);
    const { dx, dz } = moveFromKeys(new Set(["w", "d"]), 3);
    expect(Math.hypot(dx, dz)).toBeCloseTo(3);
  });
});
