import type { CafeLayout, FurnitureItem, PropertyListing, Vec2 } from "../shared/types.ts";
import { floorMoveClear, floorPositionClear, pointInPolygon } from "../shared/floorplan.ts";
import { furnitureMoveClear } from "../shared/movement.ts";
import { measuredRoute } from "./navigation.ts";

/** Reuse the purchased starter items in verified source rooms; never infer a room's use. */
export function distributeStarterLayout(property: PropertyListing, original: FurnitureItem[]): FurnitureItem[] {
  const plan = property.floorPlan;
  if (!plan || plan.metadataSource !== "matterport-live") return original;
  let furniture = original;
  // Bind each existing nearby chair to its nearest ORIGINAL table once. A moved
  // table must not steal a chair from another group later in this pass.
  const tables = original.filter(f => f.kind === "table");
  const chairTable = new Map<string, string>();
  for (const chair of original.filter(f => f.kind === "chair")) {
    const nearest = [...tables].sort((a,b) => Math.hypot(a.x-chair.x,a.z-chair.z)-Math.hypot(b.x-chair.x,b.z-chair.z))[0];
    if (nearest && Math.hypot(nearest.x-chair.x,nearest.z-chair.z) <= 1.2) chairTable.set(chair.id,nearest.id);
  }
  const approach = (layout: CafeLayout, item: FurnitureItem) => {
    for (const [dx,dz] of [[1.4,0],[-1.4,0],[0,1.4],[0,-1.4]]) {
      const goal = { x: item.x+dx, z: item.z+dz };
      if (!floorPositionClear(plan,goal.x,goal.z,0.2)) continue;
      if (!plan.rooms.some(r=>pointInPolygon(item.x,item.z,r.polygon)&&pointInPolygon(goal.x,goal.z,r.polygon))) continue;
      const route = measuredRoute(property,layout,plan.entry,goal);
      if (!route.length || Math.hypot(route.at(-1)!.x-goal.x,route.at(-1)!.z-goal.z)>0.4) continue;
      if (route.every((p,i) => i===0 || (floorMoveClear(plan,route[i-1],p) && furnitureMoveClear(layout.furniture,route[i-1],p)))) return true;
    }
    return false;
  };
  const radius = (f: FurnitureItem) => f.kind === "counter" ? 1.25 : f.kind === "table" ? 0.8 : f.kind === "chair" ? 0.35 : f.kind === "decoration" ? 0.25 : 0.65;
  for (const item of original.filter(f=>["coffee_machine","fridge","table"].includes(f.kind)).sort((a,b)=>Number(a.kind==="table")-Number(b.kind==="table"))) {
    const roomLabel = item.kind === "coffee_machine" ? "kitchen" : item.kind === "fridge" ? "storage" : "main dining room";
    const rooms = plan.rooms.filter(r=>r.label?.trim().toLowerCase()===roomLabel);
    const candidates: Vec2[] = [];
    for (const room of rooms) {
      const xs=room.polygon.map(p=>p.x), zs=room.polygon.map(p=>p.z);
      for(let x=Math.ceil(Math.min(...xs)*2)/2;x<=Math.max(...xs);x+=0.5) for(let z=Math.ceil(Math.min(...zs)*2)/2;z<=Math.max(...zs);z+=0.5) {
        if(pointInPolygon(x,z,room.polygon) && floorPositionClear(plan,x,z,radius(item))) candidates.push({x,z});
      }
    }
    // Spread dining destinations away from the counter and each other. Utility
    // stations stay near their room's accessible edge to keep service practical.
    const separation = (p:Vec2) => Math.min(...furniture.filter(f=>f.id!==item.id && ["table","counter"].includes(f.kind)).map(f=>Math.hypot(f.x-p.x,f.z-p.z)));
    candidates.sort((a,b)=>item.kind==="table" ? separation(b)-separation(a) : Math.hypot(a.x-plan.entry.x,a.z-plan.entry.z)-Math.hypot(b.x-plan.entry.x,b.z-plan.entry.z));
    for (const point of candidates.slice(0,80)) {
      const groupIds = new Set([item.id, ...original.filter(f=>chairTable.get(f.id)===item.id).map(f=>f.id)]);
      const translated = furniture.filter(f=>groupIds.has(f.id)).map(f=>({...f,x:f.x+point.x-item.x,z:f.z+point.z-item.z}));
      if (translated.some(f=>!rooms.some(r=>pointInPolygon(f.x,f.z,r.polygon)) || !floorPositionClear(plan,f.x,f.z,radius(f)))) continue;
      // Internal spacing is the existing table/chair arrangement, preserved by
      // translation. Check every member against everything outside the group.
      if (translated.some(member=>furniture.some(f=>!groupIds.has(f.id) && Math.hypot(f.x-member.x,f.z-member.z)<radius(f)+radius(member)+0.15))) continue;
      const proposed = furniture.map(f=>translated.find(member=>member.id===f.id) ?? f);
      const layout: CafeLayout={propertyId:property.id,budgetSpent:0,furniture:proposed};
      const moved=proposed.find(f=>f.id===item.id)!;
      if(!approach(layout,moved)) continue;
      // Do not strand any previously purchased service equipment or block its route.
      if(!proposed.filter(f=>["counter","coffee_machine","pickup","fridge"].includes(f.kind)).every(f=>approach(layout,f))) continue;
      furniture=proposed;
      break;
    }
  }
  return furniture;
}
