import { describe, expect, it } from "vitest";
import { entranceMarkersFor } from "./entrances";
import type { PropertyListing } from "../../shared/types";
import { floorMoveClear, floorPositionClear } from "../../shared/floorplan";
import properties from "../../data/properties.json";
const base = properties[0] as PropertyListing;
describe("entrance wayfinding",()=>{
  it("maps the imported approach to its exact measured opening without obstructing it",()=>{
    const property:PropertyListing={...base,floorPlan:{modelId:"test",floorId:"test",units:"meters",entry:{x:.45,z:2},serviceOrigin:{x:2,z:2},rooms:[{id:"room",areaM2:36,polygon:[{x:0,z:0},{x:6,z:0},{x:6,z:6},{x:0,z:6}]}],walls:[{id:"wall",a:{x:0,z:0},b:{x:0,z:6},thickness:.12,openings:[{id:"door",type:"doorway",center:1/3,width:1.2,height:2.1}]}]}};
    const before=JSON.stringify(property.floorPlan);
    const [marker]=entranceMarkersFor(property);
    expect(marker.openingId).toBe("door");expect(marker.position).toEqual({x:0,z:2});expect(marker.rotation).toBeCloseTo(Math.PI/2);expect(marker.width).toBe(1.2);
    expect(floorPositionClear(property.floorPlan!,marker.approach.x,marker.approach.z)).toBe(true);
    expect(floorMoveClear(property.floorPlan!,marker.approach,{x:1.3,z:2})).toBe(true);
    expect(JSON.stringify(property.floorPlan)).toBe(before);
  });
  it("does not invent a door when entry has no nearby measured opening",()=>{
    const property={...base,floorPlan:{modelId:"test",floorId:"test",units:"meters" as const,entry:{x:2,z:2},serviceOrigin:{x:2,z:2},rooms:[],walls:[]}};
    expect(entranceMarkersFor(property)[0]).toMatchObject({position:{x:2,z:2},hasOpening:false,label:"ARRIVAL / DEPARTURE"});
  });
  it("labels separate demo arrival and departure sides from existing simulation routes",()=>{
    const markers=entranceMarkersFor({...base,floorPlan:undefined});expect(markers.map(m=>m.position)).toEqual([{x:0,z:2},{x:base.width,z:1}]);
  });
});
