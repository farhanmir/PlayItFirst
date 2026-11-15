import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { Customer, PropertyListing, RoomSnapshot } from "../shared/types.ts";
import {
  applyMindDecisions, cafeView, describeLayoutChanges, dueLooks, LOOK_EVERY, mindPrompt, parseDecision, type LookSchedule,
} from "./customer-mind.ts";
import { createRoomSnapshot, moveFurniture, openCafe, placeFurniture, selectProperty } from "./simulation.ts";

const listing = (properties as PropertyListing[])[0];
const base = () => openCafe(selectProperty(createRoomSnapshot("cafe-minds"), listing));
const MENU = ["latte", "americano", "cappuccino", "cold brew", "mocha", "espresso"];
function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1", persona: "student", name: "Ava", budget: 6, patience: 80, preference: "latte", state: "queue",
    progress: 0, x: 0, z: 0, targetX: 0, targetZ: 0, satisfaction: 70, joinedAt: 0, ...overrides,
  };
}
const withCustomers = (snap: RoomSnapshot, customers: Customer[]): RoomSnapshot => ({ ...snap, customers });

describe("cafeView", () => {
  it("summarises the café with counts only", () => {
    const snap = { ...base(), inventory: { milk: 0, cups: 5, beans: 3 } };
    const view = cafeView(snap, [{ at: snap.simTime, text: "added a plant or decoration" }, { at: snap.simTime - 999, text: "old" }]);
    expect(view.outOf).toEqual(["milk"]);
    expect(view.seats.total).toBeGreaterThanOrEqual(0);
    expect(view.recentChanges).toEqual(["added a plant or decoration"]);
    const json = JSON.stringify(view);
    expect(json).not.toContain(listing.name);
    expect(json).not.toContain("balance");
  });

  it("is included in the prompt", () => {
    const view = cafeView(base());
    const prompt = JSON.parse(mindPrompt({ id: "c1", name: "Ava", persona: "student", preference: "latte", budget: 6 }, "look", { menu: MENU, queueLength: 1, waitSec: 5, cafe: view }));
    expect(prompt.cafe).toEqual({ menu: MENU, queueLength: 1, ...view });
  });
});

describe("describeLayoutChanges", () => {
  it("names added, moved and removed furniture", () => {
    const snap = base();
    const placed = placeFurniture(snap, "decoration", 3, 3);
    expect(describeLayoutChanges(snap.layout, placed.layout)).toContain("added a plant or decoration");
    const plant = placed.layout!.furniture.find((f) => !snap.layout!.furniture.some((g) => g.id === f.id))!;
    const moved = moveFurniture(placed, plant.id, plant.x + 1, plant.z);
    expect(describeLayoutChanges(placed.layout, moved.layout)).toEqual(["moved the plant or decoration"]);
    expect(describeLayoutChanges(placed.layout, snap.layout)).toEqual(["removed a plant or decoration"]);
    expect(describeLayoutChanges(snap.layout, snap.layout)).toEqual([]);
  });
});

describe("dueLooks", () => {
  it("looks shortly after joining, then every LOOK_EVERY seconds", () => {
    const schedule: LookSchedule = new Map();
    const snap = withCustomers({ ...base(), simTime: 100 }, [customer()]);
    const view = cafeView(snap);
    expect(dueLooks(snap, schedule, view)).toEqual([]);
    const first = dueLooks({ ...snap, simTime: 102 }, schedule, view);
    expect(first.map((r) => [r.moment, r.round])).toEqual([["look", 0]]);
    expect(first[0].ctx.cafe).toEqual(view);
    expect(dueLooks({ ...snap, simTime: 103 }, schedule, view)).toEqual([]);
    expect(dueLooks({ ...snap, simTime: 102 + LOOK_EVERY }, schedule, view).map((r) => r.round)).toEqual([1]);
  });

  it("makes a few customers react straight away to a layout edit", () => {
    const schedule: LookSchedule = new Map();
    const crowd = ["a", "b", "c", "d", "e"].map((id) => customer({ id }));
    const snap = withCustomers({ ...base(), simTime: 50 }, crowd);
    const view = cafeView(snap);
    dueLooks(snap, schedule, view);
    expect(dueLooks(snap, schedule, view, true).map((r) => r.customer.id)).toEqual(["a", "b", "c"]);
  });

  it("ignores customers who are entering or leaving", () => {
    const schedule: LookSchedule = new Map();
    const snap = withCustomers(base(), [customer({ state: "entering" }), customer({ id: "l", state: "leaving" })]);
    expect(dueLooks(snap, schedule, cafeView(snap), true)).toEqual([]);
  });
});

describe("look decisions", () => {
  it("parses and clamps notice, mood and patience", () => {
    expect(parseDecision("c1", "look", '{"notice":"Decor","mood":9,"patienceDelta":-50,"line":"Love the plants!"}', MENU)).toEqual({
      customerId: "c1", moment: "look", notice: "decor", mood: 2, patienceDelta: -15, line: "Love the plants!",
    });
    expect(parseDecision("c1", "look", '{"notice":"weather","line":"Nice"}', MENU)?.notice).toBeUndefined();
  });

  it("changes patience and mood and tallies feedback", () => {
    const snap = withCustomers(base(), [customer({ patience: 40 }), customer({ id: "c2", state: "waiting", patience: 40 })]);
    const out = applyMindDecisions(snap, [
      { customerId: "c1", moment: "look", notice: "seating", mood: -2, patienceDelta: -10, line: "Nowhere to sit." },
      { customerId: "c2", moment: "look", notice: "decor", mood: 1, patienceDelta: 5, line: "Cute plants." },
    ]);
    expect(out.customers.map((c) => c.patience)).toEqual([30, 45]);
    expect(out.feedback).toEqual({
      seating: { liked: 0, disliked: 1, last: "Nowhere to sit." },
      decor: { liked: 1, disliked: 0, last: "Cute plants." },
    });
    expect(out.metrics.satisfaction).toBeCloseTo(snap.metrics.satisfaction - 0.75);
  });

  it("counts exit feedback even after the customer has gone", () => {
    const snap = withCustomers(base(), []);
    const out = applyMindDecisions(snap, [{ customerId: "gone", moment: "exit", notice: "queue", mood: -1, review: "Line was endless." }]);
    expect(out.feedback?.queue).toEqual({ liked: 0, disliked: 1, last: "Line was endless." });
  });
});

describe("customer memory", () => {
  it("passes a customer's earlier lines back so they do not repeat", async () => {
    const prompts: string[] = [];
    const { CustomerMinds } = await import("./customer-mind.ts");
    const minds = new CustomerMinds({ complete: async (_s, user) => { prompts.push(user); return '{"line":"Cute plants.","notice":"decor","mood":1}'; } });
    const who = { id: "m1", name: "Ava", persona: "student" as const, preference: "latte", budget: 6 };
    const ctx = { menu: MENU, queueLength: 1, waitSec: 3 };
    await minds.ask(who, "look", ctx, 0);
    await minds.ask(who, "look", ctx, 1);
    expect(JSON.parse(prompts[0]).youAlreadySaid).toBeUndefined();
    expect(JSON.parse(prompts[1]).youAlreadySaid).toEqual(["Cute plants."]);
    minds.forget("m1");
    await minds.ask(who, "look", ctx, 0);
    expect(JSON.parse(prompts[2]).youAlreadySaid).toBeUndefined();
  });
});
