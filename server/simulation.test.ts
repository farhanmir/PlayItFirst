import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { Customer, PropertyListing } from "../shared/types.ts";
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

  it("runAiBaristaAssist advances take_order → brew → serve", () => {
    let snap = selectProperty(createRoomSnapshot("demo"), listing);
    snap = openCafe(snap);
    snap = {
      ...snap,
      customers: [seedCustomer({ id: "c1", name: "Dana", state: "ordering", preference: "espresso" })],
      aiBarista: { holding: null },
    };

    snap = runAiBaristaAssist(snap);
    expect(snap.aiBarista?.holding?.startsWith("ticket:")).toBe(true);
    expect(snap.customers[0]?.state).toBe("waiting");
    expect(snap.eventLog[0]).toContain("Jamie (AI)");

    snap = runAiBaristaAssist(snap);
    expect(snap.aiBarista?.holding?.startsWith("drink:")).toBe(true);

    snap = runAiBaristaAssist(snap);
    expect(snap.aiBarista?.holding).toBeNull();
    expect(snap.metrics.customersServed).toBe(1);
    expect(snap.eventLog.some((e) => e.includes("Jamie (AI) served"))).toBe(true);
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
