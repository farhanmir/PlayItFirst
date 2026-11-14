import type { FurnitureItem } from "./types";

/** Rendered furniture footprint plus the player's body clearance. */
export function furnitureMoveClear(furniture: FurnitureItem[], from: { x: number; z: number }, to: { x: number; z: number }): boolean {
  return furniture.every((item) => {
    if (item.kind === "decoration") return true;
    const size = item.kind === "counter" ? [2.3, 0.78] : item.kind === "pickup" ? [1.5, 0.62]
      : item.kind === "coffee_machine" ? [0.9, 0.8] : item.kind === "fridge" ? [0.78, 0.68]
      : item.kind === "table" ? [1.1, 1.1] : [0.42, 0.42];
    const hx = size[0] / 2 + 0.2, hz = size[1] / 2 + 0.2;
    const c = Math.cos(item.rotation), s = Math.sin(item.rotation);
    const local = (p: {x:number;z:number}) => ({ x: c * (p.x-item.x) - s * (p.z-item.z), z: s * (p.x-item.x) + c * (p.z-item.z) });
    const a = local(from), b = local(to);
    const penetration = (p: {x:number;z:number}) => Math.min(hx-Math.abs(p.x),hz-Math.abs(p.z));
    // A live layout edit can enclose a player; allow movement toward the nearest exit.
    if (penetration(a) > 0) return Math.hypot(b.x / hx, b.z / hz) > Math.hypot(a.x / hx, a.z / hz);
    let enter = 0, leave = 1;
    for (const [start, delta, half] of [[a.x,b.x-a.x,hx],[a.z,b.z-a.z,hz]]) {
      if (Math.abs(delta) < 1e-9) { if (Math.abs(start) >= half) return true; continue; }
      const t1 = (-half-start)/delta, t2 = (half-start)/delta;
      enter = Math.max(enter,Math.min(t1,t2)); leave = Math.min(leave,Math.max(t1,t2));
      if (enter >= leave) return true;
    }
    return leave <= 0 || enter >= 1;
  });
}
