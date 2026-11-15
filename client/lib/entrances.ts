import type { PropertyListing, Vec2 } from "../../shared/types";

export interface EntranceMarker {
  position: Vec2;
  approach: Vec2;
  rotation: number;
  width: number;
  height: number;
  surfaceOffset: number;
  label: string;
  caption: string;
  openingId?: string;
  hasOpening: boolean;
}

/** Wayfinding only: never changes source walls, collision or the chosen operational entry. */
export function entranceMarkersFor(property: PropertyListing): EntranceMarker[] {
  const plan = property.floorPlan;
  if (!plan) return [
    { position: { x: 0, z: 2 }, approach: { x: .65, z: 2 }, rotation: Math.PI / 2, width: 2.8, height: 2.3, surfaceOffset: .13, label: "ENTRANCE", caption: "CUSTOMER ARRIVALS", hasOpening: true },
    { position: { x: property.width, z: 1 }, approach: { x: property.width - .65, z: 1 }, rotation: -Math.PI / 2, width: 1, height: 2.3, surfaceOffset: .13, label: "EXIT", caption: "SEE YOU SOON", hasOpening: true },
  ];
  const candidates = plan.walls.flatMap(wall => {
    const dx = wall.b.x-wall.a.x, dz = wall.b.z-wall.a.z, length = Math.hypot(dx,dz);
    if (length < .001) return [];
    return wall.openings.filter(opening => opening.type === "doorway").map(opening => {
      const position = { x:wall.a.x+dx*opening.center, z:wall.a.z+dz*opening.center };
      const distance = Math.hypot(position.x-plan.entry.x, position.z-plan.entry.z);
      const sign = (plan.entry.x-position.x)*(-dz/length)+(plan.entry.z-position.z)*(dx/length) >= 0 ? 1 : -1;
      return { position, approach:plan.entry, rotation:Math.atan2(-sign*dz/length,sign*dx/length), width:opening.width, height:opening.height, surfaceOffset:wall.thickness/2+.025,
        label:"ENTRY / EXIT", caption:"CUSTOMER ACCESS", openingId:opening.id, hasOpening:true, distance };
    });
  }).sort((a,b)=>a.distance-b.distance);
  // Imported operational entry sits .45m inside the selected measured external doorway.
  // An unmatched entry gets a floor marker, not an invented doorway/frame in a solid wall.
  if (candidates[0]?.distance <= .85) return [candidates[0]];
  return [{ position:plan.entry, approach:plan.entry, rotation:0, width:1.2, height:0, surfaceOffset:0, label:"ARRIVAL / DEPARTURE", caption:"GAME ENTRY POINT", hasOpening:false }];
}
