/** Shared look angles for first/third person cameras + relative WASD. */
/** Start diagonally across the service counter so the line and equipment are visible. */
let yaw = 0.9;
let pitch = -0.22;
const listeners = new Set<() => void>();

export function getLook() {
  return { yaw, pitch };
}

export function setLook(nextYaw: number, nextPitch: number) {
  yaw = nextYaw;
  pitch = Math.max(-1.2, Math.min(1.2, nextPitch));
  for (const fn of listeners) fn();
}

export function nudgeLook(dx: number, dy: number, sensitivity = 0.0022) {
  setLook(yaw - dx * sensitivity, pitch - dy * sensitivity);
}

export function subscribeLook(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Move vector in XZ from WASD relative to current yaw. */
export function moveFromKeys(keys: Set<string>, speed: number) {
  let forward = 0;
  let strafe = 0;
  if (keys.has("w") || keys.has("arrowup")) forward += 1;
  if (keys.has("s") || keys.has("arrowdown")) forward -= 1;
  if (keys.has("a") || keys.has("arrowleft")) strafe -= 1;
  if (keys.has("d") || keys.has("arrowright")) strafe += 1;
  return moveFromAxes(strafe, forward, speed);
}

/** Preserve analog magnitude while limiting diagonal movement. */
export function moveFromAxes(strafe: number, forward: number, speed: number) {
  const len = Math.max(1, Math.hypot(forward, strafe));
  forward = (forward / len) * speed;
  strafe = (strafe / len) * speed;
  const { yaw: y } = getLook();
  const sin = Math.sin(y);
  const cos = Math.cos(y);
  return {
    dx: -sin * forward + cos * strafe,
    dz: -cos * forward - sin * strafe,
  };
}

/** Same walking pace on desktop and phone; never catch up after a suspended tab. */
export function walkingDistance(elapsedMs: number) {
  return 4 * Math.max(0, Math.min(50, elapsedMs)) / 1000;
}

/** Radial deadzone removes thumb jitter without snapping to eight directions. */
export function stickAxes(x: number, y: number) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 0.15) return { strafe: 0, forward: 0 };
  const strength = (Math.min(1, magnitude) - 0.15) / 0.85;
  return { strafe: x / magnitude * strength, forward: -y / magnitude * strength };
}
