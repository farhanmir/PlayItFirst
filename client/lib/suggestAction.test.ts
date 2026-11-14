import { describe, expect, it } from "vitest";
import { actionPrompt, suggestedAction } from "./suggestAction";
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
  it("waits for the accepted brew to finish before another action", () => {
    const s = snap({ players: [{ id: "u", name: "U", role: "barista", x: 0, z: 0, holding: "brewing:latte@1", score: 0, color: "#fff" }] });
    expect(suggestedAction(s, "u")).toBeNull();
    expect(actionPrompt(s, "u")).toBe("Pulling your shot…");
  });
  it("suggests serve when holding a drink", () => {
    const s = snap({
      players: [{ id: "u", name: "U", role: "barista", x: 0, z: 0, holding: "drink:latte", score: 0, color: "#fff" }],
    });
    expect(suggestedAction(s, "u")).toBe("serve");
  });

  it("prompts to clear an expired drink at a service station and blocks serving while far away", () => {
    const player = { id: "u", name: "U", role: "barista" as const, x: 0, z: 0, holding: "drink:espresso", score: 0, color: "#fff" };
    const near = snap({ players: [player] });
    expect(suggestedAction(near, "u")).toBe("serve");
    expect(actionPrompt(near, "u")).toMatch(/Clear unclaimed espresso/);
    const far = snap({ players: [{ ...player, x: 8, z: 8 }] });
    expect(suggestedAction(far, "u")).toBeNull();
    expect(actionPrompt(far, "u")).toMatch(/Carry your drink to pickup/);
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
      customers: [
        {
          id: "c",
          persona: "student",
          name: "Pat",
          budget: 8,
          patience: 80,
          preference: "latte",
          state: "ordering",
          progress: 0,
          x: 0,
          z: 0,
          targetX: 0,
          targetZ: 0,
          satisfaction: 70,
          joinedAt: 0,
        },
      ],
    });
    expect(suggestedAction(s, "u")).toBe("take_order");
    expect(actionPrompt(s, "u")).toMatch(/Take latte order/i);
  });
});
