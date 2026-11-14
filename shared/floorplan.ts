import type { Vec2 } from "./types";

export interface PlanOpening {
  id: string; type: string; center: number; width: number; height: number;
  /** Floor-relative game Y; populated only when source floor elevation is known. */
  lowerElevation?: number;
  /** Unmodified Model API Z, retained separately from the normalized sill. */
  sourceLowerElevation?: number;
}
export interface PlanWall { id: string; a: Vec2; b: Vec2; thickness: number; openings: PlanOpening[] }
export interface MeasuredFloorPlan {
  modelId: string; floorId: string; units: "meters";
  /** Model API x/y mapped to right-handed Y-up game x/-y, then translated. */
  coordinateConvention?: "matterport-api-x-neg-y-v1";
  sourceFloorElevation?: number;
  /** Set only after a validated authenticated read of this model/floor's metadata. */
  metadataSource?: "matterport-live";
  metadataFetchedAt?: number;
  rooms: { id: string; label?: string; labelSource?: "user-label" | "detected-classification"; height?: number; areaM2: number; polygon: Vec2[] }[];
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

/** Same conservative starter-layout search used by the authorized importer. */
export function measuredServiceOrigin(plan: MeasuredFloorPlan, width: number, depth: number): Vec2 {
  const main = [...plan.rooms].sort((a, b) => b.areaM2 - a.areaM2)[0];
  if (!main) throw new Error("Measured floor has no rooms");
  const pattern = [[1, 2], [3, 2], [5, 2], [2, 5], [5, 5], [1.2, 5], [2.8, 5], [0.5, 0.5], [3, 4], [1, 3]];
  let best: Vec2 | undefined, score = Infinity;
  for (let ix = 1; ix < Math.floor(width * 2); ix++) {
    for (let iz = 1; iz < Math.floor(depth * 2); iz++) {
      const x = ix / 2, z = iz / 2;
      if (!pattern.every(([px, pz]) => pointInPolygon(x + px, z + pz, main.polygon) &&
        plan.walls.every((wall) => distanceToSegment(x + px, z + pz, wall.a, wall.b) >= 0.85))) continue;
      const nextScore = (x - (width - 7.2)) ** 2 + (z - (depth - 9.2)) ** 2;
      if (nextScore < score) { best = { x, z }; score = nextScore; }
    }
  }
  if (!best) throw new Error("No safe starter café area after coordinate correction; manual layout required");
  return best;
}

/** Correct old importer output; caller must identify the exact legacy provenance. */
export function correctLegacyMatterportFloor(plan: MeasuredFloorPlan, width: number, depth: number): MeasuredFloorPlan {
  if (plan.coordinateConvention === "matterport-api-x-neg-y-v1") return plan;
  const reflect = (p: Vec2): Vec2 => ({ x: p.x, z: depth - p.z });
  const corrected: MeasuredFloorPlan = {
    ...plan,
    coordinateConvention: "matterport-api-x-neg-y-v1",
    rooms: plan.rooms.map((room) => ({ ...room, polygon: room.polygon.map(reflect) })),
    walls: plan.walls.map((wall) => ({ ...wall, a: reflect(wall.a), b: reflect(wall.b), openings: wall.openings.map((o) => ({ ...o })) })),
    entry: reflect(plan.entry),
    serviceOrigin: reflect(plan.serviceOrigin),
  };
  // The starter furniture offsets point toward +z; reflecting only its origin
  // would place equipment through walls. Search again on corrected geometry.
  corrected.serviceOrigin = measuredServiceOrigin(corrected, width, depth);
  return corrected;
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
