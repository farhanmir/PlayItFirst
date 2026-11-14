interface LookTouch { identifier: number; clientX: number; clientY: number }

/** Tracks only the finger claimed by the look surface, independent of a move thumb. */
export function createTouchLookTracker() {
  let active: LookTouch | null = null;
  return {
    start(touch: LookTouch) {
      if (!active) active = { identifier: touch.identifier, clientX: touch.clientX, clientY: touch.clientY };
    },
    move(touches: ArrayLike<LookTouch>) {
      if (!active) return null;
      const touch = Array.from(touches).find((candidate) => candidate.identifier === active!.identifier);
      if (!touch) return null;
      const delta = { x: touch.clientX - active.clientX, y: touch.clientY - active.clientY };
      active = { identifier: touch.identifier, clientX: touch.clientX, clientY: touch.clientY };
      return delta;
    },
    end(touches: ArrayLike<Pick<LookTouch, "identifier">>) {
      if (active && Array.from(touches).some((touch) => touch.identifier === active!.identifier)) active = null;
    },
    reset() { active = null; },
  };
}
