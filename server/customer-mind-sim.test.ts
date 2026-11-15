import { afterEach, describe, expect, it, vi } from "vitest";
import properties from "../data/properties.json";
import type { Customer, PropertyListing, RoomSnapshot } from "../shared/types.ts";
import { applyMindDecisions, CustomerMinds, detectMindMoments, departedCustomers, SAY_SECONDS } from "./customer-mind.ts";
import { createRoomSnapshot, openCafe, selectProperty, stepSimulation } from "./simulation.ts";

const listing = (properties as PropertyListing[])[0];
const base = () => openCafe(selectProperty(createRoomSnapshot("minds"), listing));

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1", persona: "student", name: "Ava", budget: 6, patience: 80, preference: "latte", state: "queue",
    progress: 0, x: 0, z: 0, targetX: 0, targetZ: 0, satisfaction: 70, joinedAt: 0, ...overrides,
  };
}
afterEach(() => vi.restoreAllMocks());
/** Make spawning deterministic: every roll succeeds. */
const busyDoor = () => vi.spyOn(Math, "random").mockReturnValue(0.001);
const withCustomers = (snap: RoomSnapshot, customers: Customer[]): RoomSnapshot => ({ ...snap, customers });

describe("detectMindMoments", () => {
  it("flags arrivals, reaching the counter, impatience and exits", () => {
    const snap = base();
    const prev = withCustomers(snap, [
      customer({ id: "q", state: "queue" }),
      customer({ id: "p", state: "waiting", patience: 31 }),
      customer({ id: "h", state: "happy", satisfaction: 92 }),
      customer({ id: "a", state: "waiting", patience: 0.5 }),
    ]);
    const next = withCustomers(snap, [
      customer({ id: "new", state: "entering" }),
      customer({ id: "q", state: "ordering" }),
      customer({ id: "p", state: "waiting", patience: 29 }),
      customer({ id: "h", state: "leaving", satisfaction: 92 }),
      customer({ id: "a", state: "leaving", patience: 0 }),
    ]);
    const moments = detectMindMoments(prev, next).map((r) => `${r.customer.id}:${r.moment}:${r.ctx.outcome ?? ""}`);
    expect(moments).toEqual(["new:arrive:", "q:counter:", "p:impatient:", "h:exit:served", "a:exit:walked_out"]);
  });

  it("finds real arrivals from the running simulation, including ones added between steps", () => {
    busyDoor();
    let snap = base();
    const seen = new Set<string>();
    for (let i = 0; i < 400 && seen.size === 0; i++) {
      const next = stepSimulation(snap, 0.05);
      for (const r of detectMindMoments(snap, next)) if (r.moment === "arrive") seen.add(r.customer.id);
      snap = next;
    }
    expect(seen.size).toBeGreaterThan(0);
    const [arrival] = [...seen];
    expect(snap.customers.some((c) => c.id === arrival)).toBe(true);

    const seenIds = new Set(snap.customers.map((c) => c.id));
    const injected = withCustomers(snap, [...snap.customers, customer({ id: "rush", state: "entering" })]);
    const moments = detectMindMoments(injected, stepSimulation(injected, 0.05), seenIds);
    expect(moments.filter((r) => r.moment === "arrive").map((r) => r.customer.id)).toContain("rush");
  });

  it("lists departed customers", () => {
    const snap = base();
    expect(departedCustomers(withCustomers(snap, [customer({ id: "x" })]), withCustomers(snap, []))).toEqual(["x"]);
  });
});

describe("applyMindDecisions", () => {
  it("renames, re-orders and speaks for an arriving customer", () => {
    const snap = withCustomers(base(), [customer({ state: "entering" })]);
    const out = applyMindDecisions(snap, [{ customerId: "c1", moment: "arrive", name: "Marisol", persona: "office", order: "mocha", line: "Hi!" }]);
    expect(out.customers[0]).toMatchObject({ name: "Marisol", persona: "office", preference: "mocha", say: "Hi!", mind: "grok" });
    expect(out.customers[0].sayUntil).toBe(snap.simTime + SAY_SECONDS);
  });

  it("never changes an order that already has a ticket, or one off the reduced menu", () => {
    const ticketed = withCustomers(base(), [customer({ state: "waiting", order: "latte" })]);
    expect(applyMindDecisions(ticketed, [{ customerId: "c1", moment: "counter", order: "mocha" }]).customers[0].preference).toBe("latte");
    const reduced = { ...withCustomers(base(), [customer({ state: "ordering" })]), menuReduced: true };
    expect(applyMindDecisions(reduced, [{ customerId: "c1", moment: "counter", order: "mocha" }]).customers[0].preference).toBe("latte");
    expect(applyMindDecisions(reduced, [{ customerId: "c1", moment: "counter", order: "espresso" }]).customers[0].preference).toBe("espresso");
  });

  it("adjusts patience but keeps it positive", () => {
    const snap = withCustomers(base(), [customer({ state: "waiting", patience: 10 })]);
    expect(applyMindDecisions(snap, [{ customerId: "c1", moment: "impatient", patienceDelta: -30 }]).customers[0].patience).toBe(1);
    expect(applyMindDecisions(snap, [{ customerId: "c1", moment: "impatient", patienceDelta: 20 }]).customers[0].patience).toBe(30);
  });

  it("books a tip only for a served customer and records reviews", () => {
    const snap = withCustomers(base(), []);
    const served = applyMindDecisions(snap, [{ customerId: "gone", moment: "exit", tip: 3, review: "Lovely crema." }], new Set(["gone"]));
    expect(served.finance.balance).toBeCloseTo(snap.finance.balance + 3);
    expect(served.finance.transactions[0]).toMatchObject({ amount: 3, category: "sales" });
    expect(served.reviews?.[0]).toMatchObject({ text: "Lovely crema.", tip: 3, outcome: "served" });

    const walked = applyMindDecisions(snap, [{ customerId: "gone", moment: "exit", tip: 3, review: "Too slow." }]);
    expect(walked.finance.balance).toBe(snap.finance.balance);
    expect(walked.reviews?.[0]).toMatchObject({ text: "Too slow.", outcome: "walked_out" });
    expect(walked.reviews?.[0].tip).toBeUndefined();
  });

  it("expires speech bubbles and is a no-op when nothing changes", () => {
    const snap = withCustomers(base(), [customer({ say: "hi", sayUntil: 1 })]);
    const later = { ...snap, simTime: 2 };
    expect(applyMindDecisions(later, []).customers[0].say).toBeUndefined();
    const quiet = withCustomers(base(), [customer()]);
    expect(applyMindDecisions(quiet, [])).toBe(quiet);
  });
});

describe("end to end with a fake Grok", () => {
  it("drives customers through a simulated shift without breaking the sim", async () => {
    const minds = new CustomerMinds({
      complete: async (_s, user) => {
        const { moment } = JSON.parse(user);
        if (moment === "arrive") return '{"name":"Grokster","order":"americano","line":"One americano please."}';
        if (moment === "impatient") return '{"patienceDelta":15,"line":"I can wait a bit."}';
        return '{"line":"Hello"}';
      },
    });
    busyDoor();
    let snap = base();
    for (let i = 0; i < 600; i++) {
      const prev = snap;
      let next = stepSimulation(prev, 0.05);
      for (const r of detectMindMoments(prev, next)) void minds.ask(r.customer, r.moment, r.ctx);
      await Promise.resolve();
      await Promise.resolve();
      next = applyMindDecisions(next, minds.drain());
      snap = next;
    }
    expect(minds.stats.answered).toBeGreaterThan(0);
    const shaped = snap.customers.filter((c) => c.mind === "grok");
    expect(shaped.length).toBeGreaterThan(0);
    expect(shaped.every((c) => c.name === "Grokster" && c.preference === "americano")).toBe(true);
  });
});
