import { describe, expect, it } from "vitest";
import { createTouchLookTracker } from "./touchLook";

const finger = (identifier: number, clientX: number, clientY = 0) => ({ identifier, clientX, clientY });

describe("touch look finger ownership", () => {
  it("continues looking while an independent movement thumb is held", () => {
    const look = createTouchLookTracker();
    look.start(finger(7, 100, 80));
    expect(look.move([finger(2, 10), finger(7, 120, 75)])).toEqual({ x: 20, y: -5 });
    // A joystick finger ending must not reset the look finger's previous position.
    look.end([finger(2, 10)]);
    expect(look.move([finger(7, 125, 90)])).toEqual({ x: 5, y: 15 });
  });

  it("does not switch fingers or jump when another finger starts or the look finger ends", () => {
    const look = createTouchLookTracker();
    look.start(finger(7, 100));
    look.start(finger(8, 500));
    expect(look.move([finger(8, 520), finger(7, 110)])).toEqual({ x: 10, y: 0 });
    look.end([finger(7, 110)]);
    expect(look.move([finger(8, 540)])).toBeNull();
    look.start(finger(9, 600));
    expect(look.move([finger(9, 605)])).toEqual({ x: 5, y: 0 });
  });

  it("does not start from movement alone and clears stale positions on blur/cancel", () => {
    const look = createTouchLookTracker();
    expect(look.move([finger(2, 100)])).toBeNull();
    look.start(finger(7, 100));
    look.reset();
    expect(look.move([finger(7, 200)])).toBeNull();
    look.start(finger(7, 200));
    expect(look.move([finger(7, 205)])).toEqual({ x: 5, y: 0 });
  });
});
