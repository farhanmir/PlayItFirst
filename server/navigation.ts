import type { CafeLayout, PropertyListing, Vec2 } from "../shared/types.ts";
import { floorPositionClear } from "../shared/floorplan.ts";

const STEP = 0.3;
interface Grid { width: number; height: number; valid: Uint8Array; version: string }
const grids = new WeakMap<CafeLayout, Grid>();
export function measuredGrid(property: PropertyListing, layout: CafeLayout): Grid {
  const cached = grids.get(layout);
  if (cached) return cached;
  const width = Math.ceil(property.width / STEP) + 1, height = Math.ceil(property.depth / STEP) + 1;
  const valid = new Uint8Array(width * height);
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    const px = x * STEP, pz = z * STEP;
    if (!floorPositionClear(property.floorPlan!, px, pz, 0.18)) continue;
    if (layout.furniture.some((f) => f.kind !== "decoration" && Math.hypot(px - f.x, pz - f.z) < 0.75)) continue;
    valid[z * width + x] = 1;
  }
  const version = layout.furniture.map((f) => `${f.x.toFixed(2)},${f.z.toFixed(2)}`).join(";");
  const grid = { width, height, valid, version };
  grids.set(layout, grid);
  return grid;
}
/** Cardinal BFS cannot cut through a doorway jamb or a diagonal wall corner. */
export function measuredRoute(property: PropertyListing, layout: CafeLayout, start: Vec2, goal: Vec2): Vec2[] {
  const grid = measuredGrid(property, layout);
  const nearest = (p: Vec2) => {
    let best = -1, distance = Infinity;
    for (let i = 0; i < grid.valid.length; i++) if (grid.valid[i]) {
      const d = (i % grid.width * STEP - p.x) ** 2 + (Math.floor(i / grid.width) * STEP - p.z) ** 2;
      if (d < distance) { distance = d; best = i; }
    }
    return best;
  };
  const from = nearest(start), to = nearest(goal);
  if (from < 0 || to < 0) return [];
  const parents = new Int32Array(grid.valid.length).fill(-1);
  const queue = new Int32Array(grid.valid.length);
  let head = 0, tail = 1; queue[0] = from; parents[from] = from;
  while (head < tail && parents[to] === -1) {
    const current = queue[head++], x = current % grid.width;
    for (const next of [x > 0 ? current - 1 : -1, x + 1 < grid.width ? current + 1 : -1, current - grid.width, current + grid.width]) {
      if (next < 0 || next >= grid.valid.length || !grid.valid[next] || parents[next] !== -1) continue;
      parents[next] = current; queue[tail++] = next;
    }
  }
  if (parents[to] === -1) return [];
  const path: Vec2[] = [];
  for (let i = to; i !== from; i = parents[i]) path.push({ x: i % grid.width * STEP, z: Math.floor(i / grid.width) * STEP });
  path.push({ x: from % grid.width * STEP, z: Math.floor(from / grid.width) * STEP });
  return path.reverse();
}
