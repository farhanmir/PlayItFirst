import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { PropertyListing } from "../shared/types.ts";
import { createRoomSnapshot, selectProperty } from "./simulation.ts";
import { pointInPolygon } from "../shared/floorplan.ts";
const rect=(x1:number,x2:number)=>[{x:x1,z:0},{x:x2,z:0},{x:x2,z:12},{x:x1,z:12}];
const property={...properties[0],width:24,depth:12,source:"costar-extract",floorPlan:{
  modelId:"synthetic",floorId:"floor",units:"meters",metadataSource:"matterport-live",metadataFetchedAt:1,
  entry:{x:1,z:6},serviceOrigin:{x:2,z:2},
  rooms:[{id:"dining",label:"Main Dining Room",areaM2:144,polygon:rect(0,12)}, {id:"kitchen",label:"Kitchen",areaM2:72,polygon:rect(12,18)}, {id:"store",label:"Storage",areaM2:72,polygon:rect(18,24)}],
  walls:[12,18].map(x=>({id:`wall${x}`,a:{x,z:0},b:{x,z:12},thickness:0.16,openings:[{id:`door${x}`,type:"doorway",center:0.5,width:2,height:2.1}]})),
}} as PropertyListing;
describe("source-aware starter layout",()=>{
  it("uses verified kitchen and storage with identical purchased items and opening costs",()=>{
    const s=selectProperty(createRoomSnapshot("distributed"),property);
    const fallback=selectProperty(createRoomSnapshot("fallback"),{...property,floorPlan:{...property.floorPlan!,rooms:property.floorPlan!.rooms.map(({label,...room})=>room)}});
    const machine=s.layout!.furniture.find(f=>f.kind==="coffee_machine")!;
    const fridge=s.layout!.furniture.find(f=>f.kind==="fridge")!;
    expect(pointInPolygon(machine.x,machine.z,property.floorPlan!.rooms[1].polygon)).toBe(true);
    expect(pointInPolygon(fridge.x,fridge.z,property.floorPlan!.rooms[2].polygon)).toBe(true);
    expect(s.layout!.furniture.map(f=>[f.kind,f.cost])).toEqual(fallback.layout!.furniture.map(f=>[f.kind,f.cost]));
    expect(s.finance.balance).toBe(fallback.finance.balance);
    expect(s.layout!.budgetSpent).toBe(fallback.layout!.budgetSpent);
    const oldTables=fallback.layout!.furniture.filter(f=>f.kind==="table");
    const newTables=s.layout!.furniture.filter(f=>f.kind==="table");
    const oldChairs=fallback.layout!.furniture.filter(f=>f.kind==="chair");
    const newChairs=s.layout!.furniture.filter(f=>f.kind==="chair");
    expect(newTables.some((table,i)=>table.x!==oldTables[i].x || table.z!==oldTables[i].z)).toBe(true);
    oldChairs.forEach((chair,i)=>{
      const tableIndex=oldTables.map((t,index)=>({index,distance:Math.hypot(t.x-chair.x,t.z-chair.z)})).sort((a,b)=>a.distance-b.distance)[0].index;
      expect(newChairs[i].x-newTables[tableIndex].x).toBeCloseTo(chair.x-oldTables[tableIndex].x);
      expect(newChairs[i].z-newTables[tableIndex].z).toBeCloseTo(chair.z-oldTables[tableIndex].z);
      expect(newChairs[i].rotation).toBe(chair.rotation);
      expect(pointInPolygon(newChairs[i].x,newChairs[i].z,property.floorPlan!.rooms[0].polygon)).toBe(true);
    });
    expect(s.layout!.furniture.filter(f=>f.kind==="table").every(f=>pointInPolygon(f.x,f.z,property.floorPlan!.rooms[0].polygon))).toBe(true);
  });
  it("keeps original station positions when source labels are absent or rooms are sealed",()=>{
    const unlabeled={...property,floorPlan:{...property.floorPlan!,rooms:property.floorPlan!.rooms.map(({label,...room})=>room)}};
    const sealed={...property,floorPlan:{...property.floorPlan!,walls:property.floorPlan!.walls.map(w=>({...w,openings:[]}))}};
    const a=selectProperty(createRoomSnapshot("a"),unlabeled),b=selectProperty(createRoomSnapshot("b"),sealed);
    for(const kind of ["coffee_machine","fridge"]){
      const old=a.layout!.furniture.find(f=>f.kind===kind)!,next=b.layout!.furniture.find(f=>f.kind===kind)!;
      expect([next.x,next.z]).toEqual([old.x,old.z]);
    }
  });
});
