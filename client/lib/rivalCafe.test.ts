import { describe, expect, it } from "vitest";
import properties from "../../data/properties.json";
import type { PropertyListing } from "../../shared/types";
import {
  createRivalProfile,
  pickRivalProperty,
  playerRaceScore,
  simulateRivalScore,
} from "./rivalCafe";

const listings = properties as PropertyListing[];

describe("rival café", () => {
  it("picks a different listing than the player", () => {
    const player = listings[0];
    const rival = pickRivalProperty(player.id, listings);
    expect(rival).toBeTruthy();
    expect(rival!.id).not.toBe(player.id);
  });

  it("earns revenue over time when open", () => {
    const listing = listings[1];
    const closed = simulateRivalScore(listing, 120, { open: false });
    expect(closed.revenue).toBe(0);

    const open = simulateRivalScore(listing, 600, { open: true });
    expect(open.revenue).toBeGreaterThan(0);
    expect(open.customersServed).toBeGreaterThan(0);
    expect(open.score).toBeGreaterThan(0);
  });

  it("stays beatable vs a solid player hour", () => {
    const listing = listings[0];
    const rival = simulateRivalScore(listing, 3600, { open: true });
    // Player serving ~25 guests with ~$900 revenue should outpace efficiency dial
    const you = playerRaceScore(900, 25);
    expect(you).toBeGreaterThan(rival.score * 0.55);
  });

  it("builds a named rival profile", () => {
    const profile = createRivalProfile(listings[0]);
    expect(profile.name.length).toBeGreaterThan(2);
    expect(profile.propertyId).toBe(listings[0].id);
    expect(profile.costarId).toBe(listings[0].costarId);
  });
});
