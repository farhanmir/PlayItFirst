import { describe, expect, it } from "vitest";
import { Euler, Vector3 } from "three";
import { getLook, moveFromKeys, setLook, walkingDistance, stickAxes, moveFromAxes } from "./look";

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

describe("walking pace and analog movement", () => {
  it("covers the same distance at 30 and 60 updates per second", () => {
    expect(walkingDistance(1000 / 30) * 30).toBeCloseTo(4);
    expect(walkingDistance(1000 / 60) * 60).toBeCloseTo(4);
    expect(walkingDistance(5000)).toBe(0.2);
  });
  it("supports slow precise movement and clamps out-of-pad drags", () => {
    setLook(0, 0);
    expect(stickAxes(0.1, 0)).toEqual({ strafe: 0, forward: 0 });
    const half = stickAxes(0.575, 0);
    expect(moveFromAxes(half.strafe, half.forward, 4).dx).toBeCloseTo(2);
    const full = stickAxes(8, -8);
    const result = moveFromAxes(full.strafe, full.forward, 4);
    expect(Math.hypot(result.dx, result.dz)).toBeCloseTo(4);
  });
});
