import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { PropertyListing } from "../shared/types.ts";
import { adjustStaffing, deepagentsConfigured, getCafeState, reorderSupplies } from "./deepagents.ts";
import { createRoomSnapshot, openCafe, selectProperty } from "./simulation.ts";

const listing = (properties as PropertyListing[])[0];

describe("local café tools", () => {
  it("reads state without claiming a hosted Deepagents runtime", () => {
    const snap = openCafe(selectProperty(createRoomSnapshot("tools"), listing));
    const state = getCafeState(snap);
    expect(state.open).toBe(true);
    expect(state.inventory.beans).toBeGreaterThan(0);
    expect(state.hostedRuntime).toBe(deepagentsConfigured());
    expect(state.hostedRuntime).toBe(false);
  });

  it("reorders stock once when funds allow and refuses an overdraft", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("reorder"), listing));
    const poor = { ...snap, finance: { ...snap.finance, balance: 10 } };
    const refused = reorderSupplies(poor);
    expect(refused.ok).toBe(false);
    expect(refused.snapshot.finance.balance).toBe(10);
    expect(refused.snapshot.inventory).toEqual(poor.inventory);

    snap = { ...snap, finance: { ...snap.finance, balance: 80 } };
    const bought = reorderSupplies(snap);
    expect(bought.ok).toBe(true);
    expect(bought.snapshot.finance.balance).toBe(45);
    expect(bought.snapshot.inventory.beans).toBe(snap.inventory.beans + 15);
    const twice = reorderSupplies(bought.snapshot);
    expect(twice.ok).toBe(true);
    expect(twice.snapshot.finance.balance).toBe(10);
    expect(reorderSupplies(twice.snapshot).ok).toBe(false);
  });

  it("applies a staffing change and ignores an unknown mode", () => {
    const snap = openCafe(selectProperty(createRoomSnapshot("staff"), listing));
    const simplified = adjustStaffing({ ...snap, rushBoost: 0.8 }, "simplify_menu");
    expect(simplified.ok).toBe(true);
    expect(simplified.snapshot.menuReduced).toBe(true);
    const eased = adjustStaffing(simplified.snapshot, "ease_rush");
    expect(eased.snapshot.rushBoost).toBeCloseTo(0.55, 5);
    const unknown = adjustStaffing(eased.snapshot, "fire_everyone" as "ease_rush");
    expect(unknown.ok).toBe(false);
    expect(unknown.snapshot).toBe(eased.snapshot);
  });
});
