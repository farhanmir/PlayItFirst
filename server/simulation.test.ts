import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { Customer, PropertyListing } from "../shared/types.ts";
import { staffMoveClear } from "./staffNavigation.ts";
import { nearestStation } from "../shared/stations.ts";
import {
  addPlayer,
  createRoomSnapshot,
  openCafe,
  placeFurniture,
  selectProperty,
  stepSimulation,
  buildBlueprint,
  interact,
  runAiBaristaAssist,
  seedDemoCrowd,
  syncTabletop,
} from "./simulation.ts";

const listing = (properties as PropertyListing[])[0];

function seedCustomer(partial: Partial<Customer> & Pick<Customer, "state">): Customer {
  return {
    id: partial.id ?? `c-${Math.random().toString(36).slice(2, 8)}`,
    persona: partial.persona ?? "student",
    name: partial.name ?? "Pat",
    budget: partial.budget ?? 10,
    patience: partial.patience ?? 200,
    preference: partial.preference ?? "latte",
    state: partial.state,
    order: partial.order,
    progress: partial.progress ?? 0,
    x: partial.x ?? 2,
    z: partial.z ?? 3,
    targetX: partial.targetX ?? 2,
    targetZ: partial.targetZ ?? 3,
    satisfaction: partial.satisfaction ?? 70,
    joinedAt: partial.joinedAt ?? Date.now(),
  };
}

describe("café simulation", () => {
  it("reserves the first sale for humans through an idle judge rush", () => {
    let snap = seedDemoCrowd(openCafe(selectProperty(createRoomSnapshot("judge"), listing)));
    snap = addPlayer(snap, "p1", "Judge", "barista");
    const inventory = { ...snap.inventory };
    for (let i = 0; i < 400; i++) snap = stepSimulation(snap, 0.05);
    expect(snap.metrics.customersServed).toBe(0);
    expect(snap.aiBarista?.holding).toBeNull();
    expect(snap.inventory).toEqual(inventory);
    expect(snap.eventLog.some((line) => line.includes("Jamie (AI)"))).toBe(false);
  });
  it("selects a property and spends starter budget", () => {
    let snap = createRoomSnapshot("demo");
    snap = selectProperty(snap, listing);
    expect(snap.property?.id).toBe(listing.id);
    expect(snap.layout?.furniture.length).toBeGreaterThan(3);
    expect(snap.finance.balance).toBeLessThan(snap.startingBudget);
    expect(snap.phase).toBe("build");
  });

  it("runs customers after opening", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = openCafe(snap);
    // Deterministic seed so we don't flake on spawn RNG
    snap = seedDemoCrowd(snap);
    for (let i = 0; i < 80; i++) snap = stepSimulation(snap, 0.25);
    expect(snap.customers.length + snap.metrics.customersServed + snap.metrics.customersLost).toBeGreaterThan(0);
  });

  it("places furniture when funds allow", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    const before = snap.layout!.furniture.length;
    snap = placeFurniture(snap, "decoration", 5, 5);
    expect(snap.layout!.furniture.length).toBe(before + 1);
  });

  it("builds a blueprint markdown", () => {
    const snap = selectProperty(createRoomSnapshot("demo"), listing);
    const md = buildBlueprint(snap);
    expect(md).toContain("Play It First Business Launch Blueprint");
    expect(md).toContain(listing.name);
    expect(md).toMatch(/Disclaimer|educational simulation/i);
    expect(md).toMatch(/Data provenance|Gameplay assumptions/i);
  });

  it("nearestStation returns the closest in-range station", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = addPlayer(snap, "p1", "Alex", "barista");
    const counter = snap.layout!.furniture.find((f) => f.kind === "counter")!;
    snap = {
      ...snap,
      players: snap.players.map((p) => (p.id === "p1" ? { ...p, x: counter.x, z: counter.z } : p)),
    };
    expect(nearestStation(snap, "p1")).toBe("counter");

    const machine = snap.layout!.furniture.find((f) => f.kind === "coffee_machine")!;
    snap = {
      ...snap,
      players: snap.players.map((p) => (p.id === "p1" ? { ...p, x: machine.x, z: machine.z } : p)),
    };
    expect(nearestStation(snap, "p1")).toBe("machine");
  });

  it("AI helper Jamie assists idle humans after their first completed sale", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = openCafe(snap);
    // Force a backed-up queue + idle humans so Jamie steps in reliably
    snap = {
      ...snap,
      lastHumanInteractAt: 0,
      aiBarista: { holding: null },
      customers: [
        seedCustomer({ id: "c1", name: "Ava", state: "ordering", patience: 500 }),
        seedCustomer({ id: "c2", name: "Ben", state: "queue", patience: 500 }),
        seedCustomer({ id: "c3", name: "Chris", state: "queue", patience: 500 }),
        seedCustomer({ id: "c4", name: "Dana", state: "queue", patience: 500 }),
        seedCustomer({ id: "c5", name: "Eli", state: "queue", patience: 500 }),
      ],
      metrics: { ...snap.metrics, queueLength: 5, customersServed: 1 },
    };

    for (let i = 0; i < 600; i++) {
      snap = stepSimulation(snap, 0.25);
    }

    const jamieLogs = snap.eventLog.filter((e) => e.includes("Jamie (AI)"));
    expect(jamieLogs.length).toBeGreaterThan(0);
    expect(snap.metrics.customersServed).toBeGreaterThan(1);
    expect(jamieLogs.some((e) => /served|brewed|took a/.test(e))).toBe(true);
  });

  it("Jamie walks, brews on the sim clock, and serves exactly once", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("staff"), { ...listing, footTraffic: 0 }));
    snap = {...snap,simTime:20,metrics:{...snap.metrics,customersServed:1},customers:[seedCustomer({id:"c1",name:"Dana",state:"ordering",preference:"espresso",patience:800})]};
    const initial={x:snap.aiBarista!.x!,z:snap.aiBarista!.z!},stock={...snap.inventory};
    let brewingAt:number|undefined,done=false,moved=false;
    for(let i=0;i<800;i++){
      snap={...snap,simTime:snap.simTime+0.05};
      const beforeMove={x:snap.aiBarista!.x!,z:snap.aiBarista!.z!};
      snap=runAiBaristaAssist(snap,0.05);
      const afterMove={x:snap.aiBarista!.x!,z:snap.aiBarista!.z!};
      expect(Math.hypot(afterMove.x-beforeMove.x,afterMove.z-beforeMove.z)).toBeLessThanOrEqual(0.10001);
      expect(staffMoveClear(snap.property!,snap.layout!,beforeMove,afterMove)).toBe(true);
      moved ||= Math.hypot(snap.aiBarista!.x!-initial.x,snap.aiBarista!.z!-initial.z)>0.5;
      if(snap.aiBarista?.holding?.startsWith("brewing:")){
        brewingAt ??= snap.simTime;
        expect(snap.metrics.customersServed).toBe(1);
        // Resuming human input must not freeze an already started order.
        snap={...snap,lastHumanInteractAt:snap.simTime};
      }
      if(snap.aiBarista?.holding?.startsWith("drink:"))expect(snap.simTime-brewingAt!).toBeGreaterThanOrEqual(1.6-1e-8);
      if(snap.aiBarista?.served===1){done=true;break}
    }
    expect(done).toBe(true);expect(moved).toBe(true);expect(brewingAt).toBeDefined();
    expect(snap.aiBarista?.holding).toBeNull();
    expect(snap.metrics.customersServed).toBe(2);
    expect(snap.inventory).toEqual({...stock,beans:stock.beans-1,cups:stock.cups-1});
    const revenue=snap.finance.revenue;
    expect(revenue).toBeGreaterThan(0);
    for(let i=0;i<20;i++)snap=runAiBaristaAssist({...snap,simTime:snap.simTime+.05},.05);
    expect(snap.finance.revenue).toBe(revenue);
    expect(snap.players.some(p=>p.id==="__jamie_ai__")).toBe(false);
  });

  it("Jamie cannot brew or sell through a sealed measured wall",()=>{
    const property={...listing,width:12,depth:10,footTraffic:0,floorPlan:{modelId:"synthetic",floorId:"floor",units:"meters" as const,entry:{x:2,z:2},serviceOrigin:{x:1,z:1},
      rooms:[{id:"room",areaM2:120,polygon:[{x:0,z:0},{x:12,z:0},{x:12,z:10},{x:0,z:10}]}],
      walls:[{id:"wall",a:{x:6,z:0},b:{x:6,z:10},thickness:.16,openings:[]}],
    }};
    let snap=openCafe(selectProperty(createRoomSnapshot("blocked"),property));
    snap={...snap,simTime:20,aiBarista:{x:2,z:2,holding:"ticket:espresso"},metrics:{...snap.metrics,customersServed:1},
      layout:{...snap.layout!,furniture:snap.layout!.furniture.map(f=>f.kind==="coffee_machine"?{...f,x:9,z:3}:f)}};
    const stock={...snap.inventory};
    for(let i=0;i<100;i++)snap=runAiBaristaAssist({...snap,simTime:snap.simTime+.05},.05);
    expect(snap.aiBarista?.status).toBe("Path blocked");
    expect(snap.aiBarista?.holding).toBe("ticket:espresso");
    expect(snap.inventory).toEqual(stock);expect(snap.finance.revenue).toBe(0);
  });

  it("human interact updates lastHumanInteractAt", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = openCafe(snap);
    const counter = snap.layout!.furniture.find((f) => f.kind === "counter")!;
    snap = {
      ...snap,
      simTime: 12,
      lastHumanInteractAt: 0,
      players: snap.players.map((p) => (p.id === "p1" ? { ...p, x: counter.x, z: counter.z } : p)),
      customers: [seedCustomer({ state: "ordering" })],
    };
    snap = interact(snap, "p1", "take_order");
    expect(snap.lastHumanInteractAt).toBe(12);
    expect(snap.players[0]?.holding?.startsWith("ticket:")).toBe(true);
  });

  it("rejects take_order when player is far from the counter", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = openCafe(snap);
    snap = {
      ...snap,
      players: snap.players.map((p) => (p.id === "p1" ? { ...p, x: 20, z: 20 } : p)),
      customers: [seedCustomer({ state: "ordering" })],
    };
    snap = interact(snap, "p1", "take_order");
    expect(snap.players[0]?.holding).toBeFalsy();
    expect(snap.eventLog[0]).toMatch(/Walk to the counter/i);
  });

  it("starts a brew timer then finishes into a drink", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = openCafe(snap);
    const machine = snap.layout!.furniture.find((f) => f.kind === "coffee_machine")!;
    snap = {
      ...snap,
      simTime: 5,
      players: snap.players.map((p) =>
        p.id === "p1" ? { ...p, x: machine.x, z: machine.z, holding: "ticket:latte" } : p,
      ),
      customers: [seedCustomer({ state: "waiting", order: "latte", ticketHolder: "p1" })],
    };
    snap = interact(snap, "p1", "make_coffee");
    expect(snap.players[0]?.holding?.startsWith("brewing:latte")).toBe(true);
    for (let i = 0; i < 20; i++) snap = stepSimulation(snap, 0.2);
    expect(snap.players[0]?.holding).toBe("drink:latte");
  });

  it("seedDemoCrowd adds a visible queue for judge demo", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("demo"), listing));
    const before = snap.customers.length;
    snap = seedDemoCrowd(snap);
    expect(snap.customers.length).toBeGreaterThan(before);
    expect(snap.customers.some((c) => c.state === "ordering")).toBe(true);
    expect(snap.metrics.queueLength).toBeGreaterThanOrEqual(3);
  });

  it("syncTabletop moves the counter for live layout wow", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    const counter = snap.layout!.furniture.find((f) => f.kind === "counter")!;
    snap = syncTabletop(snap, [{ kind: "counter", x: counter.x + 2.5, z: counter.z + 1.2 }]);
    const moved = snap.layout!.furniture.find((f) => f.kind === "counter")!;
    expect(moved.x).toBeCloseTo(counter.x + 2.5, 1);
    expect(moved.z).toBeCloseTo(counter.z + 1.2, 1);
    expect(snap.eventLog[0]).toMatch(/Tabletop layout synced/i);
  });

  it("keeps Happy above a soft floor during early rush", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("demo"), listing));
    snap = seedDemoCrowd(snap);
    snap = {
      ...snap,
      rushBoost: 0.9,
      metrics: { ...snap.metrics, satisfaction: 58 },
      simTime: 20,
    };
    for (let i = 0; i < 80; i++) snap = stepSimulation(snap, 0.25);
    expect(snap.metrics.satisfaction).toBeGreaterThanOrEqual(55);
  });
});


describe("dedicated pickup handoff", () => {
  function ready() {
    let snap = addPlayer(openCafe(selectProperty(createRoomSnapshot("pickup"), listing)), "p", "Pat", "barista");
    snap.layout!.furniture = [
      { id: "counter", kind: "counter", label: "Counter", x: 2, z: 3, rotation: 0, cost: 0 },
      { id: "pickup", kind: "pickup", label: "Pickup", x: 4, z: 3, rotation: 0, cost: 0 },
    ];
    snap.players[0] = { ...snap.players[0], x: 2, z: 2, holding: "drink:latte" };
    snap.customers = [{ ...seedCustomer({ state: "waiting", order: "latte" }), ticketHolder: "p" }];
    return snap;
  }
  it("rejects the counter even inside overlapping pickup range without consuming or charging", () => {
    const before = ready();
    const after = interact(before, "p", "serve");
    expect(after.finance).toEqual(before.finance);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.players).toEqual(before.players);
    expect(after.customers).toEqual(before.customers);
    expect(after.metrics.customersServed).toBe(0);
    expect(after.eventLog[0]).toContain("Walk to pickup");
    after.players = [{ ...after.players[0], x: 4, z: 2 }];
    const served = interact(after, "p", "serve");
    expect(served.metrics.customersServed).toBe(1);
    expect(served.finance.balance).toBeGreaterThan(before.finance.balance);
    expect(served.players[0].holding).toBeNull();
    expect(interact(served, "p", "serve").finance).toEqual(served.finance);
  });
  it("requires reaching the pickup shelf even when it is the nearest station", () => {
    const before = ready();
    before.players = [{ ...before.players[0], x: 4, z: 1.2 }];
    const rejected = interact(before, "p", "serve");
    expect(rejected.metrics.customersServed).toBe(0);
    expect(rejected.finance).toEqual(before.finance);
    expect(rejected.players[0].holding).toBe("drink:latte");
    expect(rejected.eventLog[0]).toContain("Walk to pickup");
    rejected.players = [{ ...rejected.players[0], x: 4, z: 2 }];
    expect(interact(rejected, "p", "serve").metrics.customersServed).toBe(1);
  });
  it("retains counter service only when the layout has no pickup", () => {
    const snap = ready();
    snap.layout!.furniture = snap.layout!.furniture.filter(item => item.kind !== "pickup");
    expect(interact(snap, "p", "serve").metrics.customersServed).toBe(1);
  });
});
