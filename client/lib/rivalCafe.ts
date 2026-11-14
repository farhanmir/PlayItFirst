/**
 * Lightweight rival café score — simulated competitor in another listing.
 * Tuned so a clean demo session can beat them without feeling scripted.
 */
import type { PropertyListing } from "../../shared/types";

export interface RivalCafeProfile {
  name: string;
  manager: string;
  propertyId: string;
  propertyName: string;
  neighborhood: string;
  city: string;
  tone: string;
  costarId: string;
}

export interface RivalScore {
  revenue: number;
  customersServed: number;
  satisfaction: number;
  /** Composite score used for the race bar */
  score: number;
}

const RIVAL_NAMES = [
  { name: "Beacon Roast", manager: "Mira" },
  { name: "Copper & Steam", manager: "Noah" },
  { name: "Block Party Beans", manager: "Sasha" },
];

/** Pick a different listing so the race feels like another real storefront. */
export function pickRivalProperty(
  playerPropertyId: string | null | undefined,
  listings: PropertyListing[],
): PropertyListing | null {
  if (!listings.length) return null;
  const others = listings.filter((p) => p.id !== playerPropertyId);
  const pool = others.length ? others : listings;
  // Prefer similar rent band for a fair-looking matchup
  const player = listings.find((p) => p.id === playerPropertyId);
  if (player) {
    const sorted = [...pool].sort(
      (a, b) => Math.abs(a.monthlyRent - player.monthlyRent) - Math.abs(b.monthlyRent - player.monthlyRent),
    );
    return sorted[0] ?? pool[0];
  }
  return pool[Math.min(1, pool.length - 1)] ?? pool[0];
}

export function createRivalProfile(
  listing: PropertyListing,
  seed = listing.id.length,
): RivalCafeProfile {
  const brand = RIVAL_NAMES[seed % RIVAL_NAMES.length];
  return {
    name: brand.name,
    manager: brand.manager,
    propertyId: listing.id,
    propertyName: listing.name,
    neighborhood: listing.neighborhood,
    city: listing.city,
    tone: listing.imageTone,
    costarId: listing.costarId,
  };
}

/**
 * Simulate rival earnings from elapsed open time.
 * Efficiency ~0.68–0.78 of theoretical street potential so the player can win.
 */
export function simulateRivalScore(
  listing: PropertyListing,
  elapsedSec: number,
  opts?: { open?: boolean },
): RivalScore {
  const open = opts?.open !== false;
  if (!open || elapsedSec <= 0) {
    return { revenue: 0, customersServed: 0, satisfaction: 74, score: 0 };
  }

  const hours = elapsedSec / 3600;
  // Theoretical $/hr from traffic + capacity, then dial back for fairness
  const potentialPerHour = 90 + listing.footTraffic * 220 + listing.capacity * 3.2;
  const efficiency = 0.68 + listing.footTraffic * 0.08;
  const revenue = Math.max(0, potentialPerHour * efficiency * hours);

  const custPerHour = 6 + listing.footTraffic * 18 + listing.capacity * 0.12;
  const customersServed = Math.floor(custPerHour * efficiency * hours);
  const satisfaction = Math.min(92, 72 + listing.footTraffic * 14);

  // Score weights revenue and guests so a busy floor can catch up
  const score = Math.round(revenue + customersServed * 4.5);

  return {
    revenue: Math.round(revenue),
    customersServed,
    satisfaction: Math.round(satisfaction),
    score,
  };
}

export function playerRaceScore(revenue: number, customersServed: number): number {
  return Math.round(Math.max(0, revenue) + Math.max(0, customersServed) * 4.5);
}
