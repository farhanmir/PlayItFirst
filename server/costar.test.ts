import { describe, expect, it } from "vitest";
import { correctImportedCoordinates, getCachedProperties, loadProperties } from "./costar.ts";
import { withMatterportDefaults, resolveMatterport } from "./matterport.ts";
import { deepagentsConfigured } from "./deepagents.ts";
import properties from "../data/properties.json";
import type { PropertyListing } from "../shared/types.ts";

describe("stretch integrations", () => {
  it("migrates only known legacy imports, not arbitrary or already-corrected floor plans", () => {
    const legacy = {
      ...properties[0], width: 16, depth: 12, source: "costar-extract", matterportModelId: "synthetic",
      provenance: { listingId: "synthetic", spaceId: "s", suite: "s", askingRate: 1, rateBasis: "USD/sqft/month", assumptions: [],
        geometry: "Measured single-floor room polygons, walls and openings; API x/y translated to game x/z in meters" },
      floorPlan: { modelId: "synthetic", floorId: "floor", units: "meters", entry: { x: 1, z: 3 }, serviceOrigin: { x: 4, z: 4 },
        rooms: [{ id: "room", areaM2: 192, polygon: [{ x: 0, z: 0 }, { x: 16, z: 0 }, { x: 16, z: 12 }, { x: 0, z: 12 }] }], walls: [] },
    } as PropertyListing;
    const corrected = correctImportedCoordinates(legacy);
    expect(corrected.floorPlan?.entry).toEqual({ x: 1, z: 9 });
    expect(corrected.floorPlan?.coordinateConvention).toBe("matterport-api-x-neg-y-v1");
    expect(correctImportedCoordinates(corrected)).toBe(corrected);
    const manual = { ...legacy, provenance: { ...legacy.provenance!, geometry: "Manually measured" } };
    expect(correctImportedCoordinates(manual)).toBe(manual);
    const mock = { ...legacy, source: "costar-mock" as const };
    expect(correctImportedCoordinates(mock)).toBe(mock);
    const mismatched = { ...legacy, matterportModelId: "other" };
    expect(correctImportedCoordinates(mismatched)).toBe(mismatched);
  });
  it("loads CoStar mock listings when no live URL", async () => {
    delete process.env.COSTAR_API_URL;
    const bundle = await loadProperties(true);
    expect(bundle.source).toBe("costar-mock");
    expect(bundle.listings.length).toBeGreaterThan(3);
    expect(bundle.listings[0].costarId).toMatch(/^CS-/);
    expect(getCachedProperties().listings[0].source).toBe("costar-mock");
  });

  it("attaches Matterport showcase models", async () => {
    const withMp = withMatterportDefaults(getCachedProperties().listings);
    const midtown = withMp.find((p) => p.id === "hou-midtown-1204");
    expect(midtown?.matterportModelId).toBeTruthy();
    const model = await resolveMatterport(midtown!);
    expect(model.embedUrl).toContain("matterport.com");
    expect(model.source).toMatch(/matterport/);
  });

  it("reports deepagents off without keys", () => {
    delete process.env.DEEPAGENTS_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEEPAGENTS_URL;
    expect(deepagentsConfigured()).toBe(false);
  });
});
