import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { CafeLayout, Customer, PropertyListing } from "../shared/types.ts";
import { seatingTargets } from "./seating.ts";
import { createRoomSnapshot, openCafe, selectProperty, stepSimulation } from "./simulation.ts";
const property = { ...properties[0], footTraffic: 0 } as PropertyListing;
const layout: CafeLayout = { propertyId: property.id, budgetSpent: 0, furniture: [
  { id: "table", kind: "table", label: "Table", x: 8, z: 5, rotation: 0, cost: 0, seats: 2 },
  { id: "pickup", kind: "pickup", label: "Pickup", x: 2, z: 2, rotation: 0, cost: 0 },
] };
describe("reachable seating", () => {
  it("actually walks a waiting guest toward the table over successive ticks", () => {
    const guest: Customer = { id: "guest", name: "Guest", persona: "student", budget: 10, patience: 800, preference: "latte", order: "latte", state: "waiting", progress: 0, x: 9, z: 2, targetX: 2.8, targetZ: 2, satisfaction: 80, joinedAt: 0 };
    let snapshot = { ...openCafe(selectProperty(createRoomSnapshot("seat"), property)), layout, customers: [guest], lastHumanInteractAt: 1e9, director: null };
    const seat = seatingTargets(property, layout)[0];
    const before = Math.hypot(guest.x-seat.x,guest.z-seat.z);
    for (let i=0;i<30;i++) snapshot = stepSimulation(snapshot,0.1) as typeof snapshot;
    const after = snapshot.customers[0];
    expect(after.targetX).toBe(seat.x);
    expect(after.targetZ).toBe(seat.z);
    expect(Math.hypot(after.x-seat.x,after.z-seat.z)).toBeLessThan(0.2);
    expect(Math.hypot(after.x-seat.x,after.z-seat.z)).toBeLessThan(before);
    expect(snapshot.finance.revenue).toBe(0);
  });
  it("skips a table across a sealed measured partition and rechecks after layout change", () => {
    const measured: PropertyListing = { ...property, width: 10, depth: 10, floorPlan: {
      modelId: "synthetic", floorId: "floor", units: "meters", entry: {x:2,z:2}, serviceOrigin: {x:1,z:1},
      rooms: [{id:"room",areaM2:100,polygon:[{x:0,z:0},{x:10,z:0},{x:10,z:10},{x:0,z:10}]}],
      walls: [{id:"partition",a:{x:5,z:0},b:{x:5,z:10},thickness:0.16,openings:[]}],
    } };
    const sealed = { ...layout, furniture: [layout.furniture[0]] };
    expect(seatingTargets(measured,sealed)).toEqual([]);
    const moved = { ...sealed, furniture: [{ ...sealed.furniture[0], x:3 }] };
    expect(seatingTargets(measured,moved)).toHaveLength(1);
  });
});
