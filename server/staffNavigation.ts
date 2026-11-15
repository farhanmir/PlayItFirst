import type { CafeLayout, FurnitureKind, PropertyListing, Vec2 } from "../shared/types.ts";
import { floorMoveClear, floorPositionClear } from "../shared/floorplan.ts";
import { furnitureMoveClear } from "../shared/movement.ts";

const STEP=0.3;
interface StaffGrid { width:number; height:number; valid:Uint8Array; edges:Map<number,number[]> }
const cache=new WeakMap<CafeLayout,StaffGrid>();
export function staffMoveClear(property:PropertyListing,layout:CafeLayout,a:Vec2,b:Vec2):boolean {
  return b.x>=0.3 && b.z>=0.3 && b.x<=property.width-0.3 && b.z<=property.depth-0.3 &&
    (!property.floorPlan || floorMoveClear(property.floorPlan,a,b)) && furnitureMoveClear(layout.furniture,a,b);
}
function gridFor(property:PropertyListing,layout:CafeLayout):StaffGrid {
  const old=cache.get(layout);if(old)return old;
  const width=Math.ceil(property.width/STEP)+1,height=Math.ceil(property.depth/STEP)+1,valid=new Uint8Array(width*height);
  for(let i=0;i<valid.length;i++){const p={x:i%width*STEP,z:Math.floor(i/width)*STEP};
    if(staffMoveClear(property,layout,p,p)&&(!property.floorPlan||floorPositionClear(property.floorPlan,p.x,p.z)))valid[i]=1;
  }
  const grid={width,height,valid,edges:new Map<number,number[]>()};cache.set(layout,grid);return grid;
}
export function staffSpawn(property:PropertyListing,layout:CafeLayout):Vec2|undefined {
  const counter=layout.furniture.find(f=>f.kind==="counter");const target=counter?{x:counter.x+1.6,z:counter.z+1.2}:property.floorPlan?.entry??{x:1,z:1};
  const grid=gridFor(property,layout);let best:Vec2|undefined,distance=Infinity;
  for(let i=0;i<grid.valid.length;i++)if(grid.valid[i]){const p={x:i%grid.width*STEP,z:Math.floor(i/grid.width)*STEP},d=Math.hypot(p.x-target.x,p.z-target.z);if(d<distance){distance=d;best=p}}
  return best;
}
/** Actual player-clearance BFS; no station range or wall bypass. */
export function staffRoute(property:PropertyListing,layout:CafeLayout,start:Vec2,kinds:FurnitureKind[]):Vec2[] {
  const grid=gridFor(property,layout),point=(i:number)=>({x:i%grid.width*STEP,z:Math.floor(i/grid.width)*STEP});
  const stations=layout.furniture.filter(f=>kinds.includes(f.kind));
  let first=-1,distance=Infinity;
  for(let i=0;i<grid.valid.length;i++)if(grid.valid[i]){const p=point(i),d=Math.hypot(p.x-start.x,p.z-start.z);if(d<distance&&d<0.65&&staffMoveClear(property,layout,start,p)){first=i;distance=d}}
  if(first<0)return [];
  const parents=new Map([[first,first]]),queue=[first];let end=-1;
  for(let head=0;head<queue.length;head++){
    const current=queue[head],p=point(current);
    if(stations.some(f=>Math.hypot(f.x-p.x,f.z-p.z)<=1.5&&(!property.floorPlan||floorMoveClear(property.floorPlan,p,f,.05)))){end=current;break}
    let edges=grid.edges.get(current);
    if(!edges){const x=current%grid.width;edges=[x>0?current-1:-1,x+1<grid.width?current+1:-1,current-grid.width,current+grid.width].filter(n=>n>=0&&n<grid.valid.length&&grid.valid[n]&&staffMoveClear(property,layout,p,point(n)));grid.edges.set(current,edges)}
    for(const next of edges)if(!parents.has(next)){parents.set(next,current);queue.push(next)}
  }
  if(end<0)return [];
  const path:Vec2[]=[];for(let i=end;i!==first;i=parents.get(i)!)path.push(point(i));path.push(point(first));return path.reverse();
}
