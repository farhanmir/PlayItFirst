import type { Vec2 } from "./types";

export interface PlanOpening { id: string; type: string; center: number; width: number; height: number }
export interface PlanWall { id: string; a: Vec2; b: Vec2; thickness: number; openings: PlanOpening[] }
export interface MeasuredFloorPlan {
  modelId: string; floorId: string; units: "meters";
  rooms: { id: string; areaM2: number; polygon: Vec2[] }[];
  walls: PlanWall[];
  entry: Vec2;
  serviceOrigin: Vec2;
}
export interface WallSegment { a: Vec2; b: Vec2; thickness: number }

export function pointInPolygon(x: number, z: number, points: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
export function onMeasuredFloor(plan: MeasuredFloorPlan, x: number, z: number): boolean {
  return plan.rooms.some((r) => pointInPolygon(x, z, r.polygon));
}
export function distanceToSegment(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
}

/** Split a measured wall at doorways. Windows remain solid at walking height. */
export function solidWallSegments(wall: PlanWall): WallSegment[] {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
  if (length < 0.001) return [];
  const gaps = wall.openings.filter((o) => o.type === "doorway").map((o) => ({
    start: Math.max(0, o.center - o.width / length / 2), end: Math.min(1, o.center + o.width / length / 2),
  })).sort((a, b) => a.start - b.start);
  const at = (t: number) => ({ x: wall.a.x + (wall.b.x - wall.a.x) * t, z: wall.a.z + (wall.b.z - wall.a.z) * t });
  const segments: WallSegment[] = [];
  let from = 0;
  for (const gap of [...gaps, { start: 1, end: 1 }]) {
    if (gap.start > from) segments.push({ a: at(from), b: at(gap.start), thickness: wall.thickness });
    from = Math.max(from, gap.end);
  }
  return segments;
}
const cache = new WeakMap<MeasuredFloorPlan, WallSegment[]>();
export function planSegments(plan: MeasuredFloorPlan): WallSegment[] {
  let segments = cache.get(plan);
  if (!segments) { segments = plan.walls.flatMap(solidWallSegments); cache.set(plan, segments); }
  return segments;
}
export function floorPositionClear(plan: MeasuredFloorPlan, x: number, z: number, radius = 0.2): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && onMeasuredFloor(plan, x, z) &&
    planSegments(plan).every((s) => distanceToSegment(x, z, s.a, s.b) >= radius + s.thickness / 2);
}
export function floorMoveClear(plan: MeasuredFloorPlan, a: Vec2, b: Vec2, radius = 0.2): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.08));
  if (steps > 1000) return false;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!floorPositionClear(plan, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, radius)) return false;
  }
  return true;
}
