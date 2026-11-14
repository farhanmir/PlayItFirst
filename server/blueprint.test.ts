import { describe, expect, it } from "vitest";
import properties from "../data/properties.json";
import type { PropertyListing } from "../shared/types";
import { createRoomSnapshot, selectProperty } from "./simulation";
import { buildBlueprint } from "./blueprint";

const listing = (properties as PropertyListing[])[0];
describe("business blueprint evidence", () => {
  it("distinguishes real asking terms from fixture assumptions and preserves cents", () => {
    const property: PropertyListing = { ...listing, source: "costar-extract", monthlyRent: 11047.5,
      provenance: { listingId: "synthetic", spaceId: "synthetic", suite: "104", askingRate: 45, rateBasis: "USD/sqft/year", geometry: "assumed", scanAreaM2: 228.0032, assumptions: ["Entrance selected for gameplay"] } };
    const state = selectProperty(createRoomSnapshot("test"), property);
    const output = buildBlueprint(state);
    expect(output).toContain("$11,047.50; additional charges require confirmation");
    expect(output).toContain("228.00 m²; distinct from rentable listing area");
    expect(output).toContain("Entrance selected for gameplay");
    expect(output).toContain("not a measured reconstruction");
    expect(output).not.toContain("3 ft");
  });
  it("exports actual receipts and executed decisions without claiming pending proposals happened", () => {
    const state = selectProperty(createRoomSnapshot("test"), listing);
    state.manager = { runtime: "local", providerVerified: false, busy: false, summary: "", trace: [], proposals: [
      { id: "executed-one", action: "reorder_supplies", cost: 35, reason: "stock", requestedBy: "owner", expiresAt: 0, status: "executed", transactionId: "receipt-one", result: "Added supplies" },
      { id: "not-executed", action: "simplify_menu", cost: 0, reason: "queue", requestedBy: "owner", expiresAt: 0, status: "pending" },
    ] };
    const output = buildBlueprint(state);
    expect(output).toContain("receipt-one");
    expect(output).toContain(state.finance.transactions[0].id);
    expect(output).not.toContain("not-executed");
    expect(output).toContain("No completed service is recorded");
    expect(output).toContain("makes no quantified improvement claim");
  });
  it("discloses truncated accounting evidence instead of treating receipts as all expenses", () => {
    const state = selectProperty(createRoomSnapshot("test"), listing);
    state.finance.transactions = [];
    expect(buildBlueprint(state)).toContain("not a complete accounting history");
    expect(buildBlueprint(createRoomSnapshot("empty"))).toContain("Blueprint unavailable");
  });
});
