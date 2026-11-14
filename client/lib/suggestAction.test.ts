import { describe, expect, it } from "vitest";
import { suggestedAction } from "./suggestAction";
import type { RoomSnapshot } from "../../shared/types";

function snap(partial: Partial<RoomSnapshot> & { players: RoomSnapshot["players"] }): RoomSnapshot {
  return {
    code: "T",
    phase: "play",
    businessType: "cafe",
    property: null,
    layout: {
      propertyId: "p",
      budgetSpent: 0,
      furniture: [{ id: "c", kind: "counter", label: "C", x: 0, z: 0, rotation: 0, cost: 0 }],
    },
    startingBudget: 1,
    customers: [],
    finance: { balance: 0, revenue: 0, expenses: 0, transactions: [], nessieAccountId: "" },
    metrics: {
      customersServed: 0,
      customersLost: 0,
      avgWaitSec: 0,
      satisfaction: 80,
      revenuePerHour: 0,
      queueLength: 0,
    },
    inventory: { beans: 20, milk: 10, cups: 20 },
    director: null,
    photon: [],
    tick: 0,
    simTime: 0,
    open: true,
    eventLog: [],
    ...partial,
  };
}

describe("suggestedAction", () => {
  it("suggests serve when holding a drink", () => {
    const s = snap({
      players: [{ id: "u", name: "U", role: "barista", x: 0, z: 0, holding: "drink:latte", score: 0, color: "#fff" }],
    });
    expect(suggestedAction(s, "u")).toBe("serve");
  });

  it("suggests brew when holding a ticket", () => {
    const s = snap({
      players: [{ id: "u", name: "U", role: "barista", x: 0, z: 0, holding: "ticket:latte", score: 0, color: "#fff" }],
    });
    expect(suggestedAction(s, "u")).toBe("make_coffee");
  });

  it("suggests take_order near counter with empty hands", () => {
    const s = snap({
      players: [{ id: "u", name: "U", role: "barista", x: 0, z: 0, holding: null, score: 0, color: "#fff" }],
    });
    expect(suggestedAction(s, "u")).toBe("take_order");
  });
});
