/**
 * CoStar listing provider — live HTTP when COSTAR_API_URL (+ optional key) is set,
 * otherwise enriched local listings stamped as costar-mock.
 */
import local from "../data/properties.json";
import { readFile } from "node:fs/promises";
import type { PropertyListing } from "../shared/types.ts";

export type ListingSource = "costar-live" | "costar-extract" | "costar-mock";

export interface CoStarBundle {
  source: ListingSource;
  fetchedAt: number;
  listings: PropertyListing[];
  detail?: string;
}

let cache: CoStarBundle | null = null;
let inflight: Promise<CoStarBundle> | null = null;

function stamp(listings: PropertyListing[], source: ListingSource, detail?: string): CoStarBundle {
  const fetchedAt = Date.now();
  return {
    source,
    fetchedAt,
    detail,
    listings: listings.map((p) => ({
      ...p,
      source,
      liveFetchedAt: fetchedAt,
    })),
  };
}

/** Map a remote CoStar-shaped payload into PropertyListing. */
function normalizeRemote(raw: unknown): PropertyListing[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PropertyListing[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? r.listingId ?? "");
    if (!id) continue;
    out.push({
      id,
      name: String(r.name ?? r.propertyName ?? "Untitled listing"),
      city: (r.city === "Los Angeles" ? "Los Angeles" : "Houston") as PropertyListing["city"],
      neighborhood: String(r.neighborhood ?? r.submarket ?? ""),
      address: String(r.address ?? r.streetAddress ?? ""),
      sqft: Number(r.sqft ?? r.rentableArea ?? 1000),
      monthlyRent: Number(r.monthlyRent ?? r.askingRent ?? 4000),
      width: Number(r.width ?? Math.max(8, Math.round(Math.sqrt(Number(r.sqft ?? 1000)) * 0.45))),
      depth: Number(r.depth ?? Math.max(7, Math.round(Math.sqrt(Number(r.sqft ?? 1000)) * 0.35))),
      capacity: Number(r.capacity ?? Math.max(12, Math.floor(Number(r.sqft ?? 1000) / 35))),
      footTraffic: Number(r.footTraffic ?? 0.6),
      matterportHint: String(r.matterportHint ?? r.floorplanNotes ?? "Commercial floorplate"),
      costarId: String(r.costarId ?? r.costar_id ?? `CS-${id}`),
      imageTone: String(r.imageTone ?? "#6b4f3a"),
      description: String(r.description ?? ""),
      matterportModelId: r.matterportModelId ? String(r.matterportModelId) : undefined,
      matterportEmbedUrl: r.matterportEmbedUrl ? String(r.matterportEmbedUrl) : undefined,
      source: "costar-live",
    });
  }
  return out.length ? out : null;
}

async function fetchLive(): Promise<CoStarBundle | null> {
  const base = process.env.COSTAR_API_URL?.trim();
  if (!base) return null;
  const key = process.env.COSTAR_API_KEY?.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers["X-Api-Key"] = key;
  }
  const url = base.includes("?") ? base : `${base.replace(/\/$/, "")}/listings`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CoStar HTTP ${res.status}`);
  const body = await res.json();
  const rows = Array.isArray(body) ? body : (body as { listings?: unknown }).listings;
  const listings = normalizeRemote(rows);
  if (!listings) throw new Error("CoStar payload missing listings[]");
  return stamp(listings, "costar-live", `Fetched ${listings.length} listings from COSTAR_API_URL`);
}

export async function loadProperties(force = false): Promise<CoStarBundle> {
  if (!force && cache && Date.now() - cache.fetchedAt < 60_000) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const file = process.env.COSTAR_DATA_FILE?.trim();
      if (file) {
        const rows: unknown = JSON.parse(await readFile(file, "utf8"));
        if (!Array.isArray(rows) || !rows.length || rows.some((p) => !p?.id || !p?.matterportModelId || !p?.provenance ||
          ![p.sqft, p.monthlyRent, p.width, p.depth].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0))) {
          throw new Error("Invalid authorized CoStar extract file");
        }
        cache = stamp(rows as PropertyListing[], "costar-extract", "Authorized hackathon extract; asking terms, not an executed lease. See per-property assumptions.");
        return cache;
      }
      const live = await fetchLive();
      cache = live ?? stamp(local as PropertyListing[], "costar-mock", "Using bundled Houston/LA listings (set COSTAR_API_URL for live)");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CoStar fetch failed";
      cache = stamp(local as PropertyListing[], "costar-mock", `Live CoStar unavailable (${msg}) — mock fallback`);
    } finally {
      inflight = null;
    }
    return cache!;
  })();
  return inflight;
}

export function getCachedProperties(): CoStarBundle {
  return cache ?? stamp(local as PropertyListing[], "costar-mock", "Cold start mock");
}
