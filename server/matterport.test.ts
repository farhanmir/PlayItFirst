import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichMeasuredProperty, resolveMatterport } from "./matterport.ts";
import properties from "../data/properties.json";
import type { PropertyListing } from "../shared/types.ts";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Matterport authenticated model reads", () => {
  it("uses server-side Basic auth and the exact model id with GraphQL variables", async () => {
    vi.stubEnv("MATTERPORT_API_KEY", "test-id"); vi.stubEnv("MATTERPORT_TOKEN", "test-secret");
    const listing = { ...properties[0], matterportModelId: "suite-model" } as PropertyListing;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { model: {
      id: "suite-model", name: "Matched suite", floors: [{ id: "f1" }], dimensionEstimates: { area: 120 },
    } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const model = await resolveMatterport(listing);
    expect(model.source).toBe("matterport-live");
    expect(model.scanAreaM2).toBe(120);
    expect(model.floorCount).toBe(1);
    const options = fetcher.mock.calls[0][1];
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from("test-id:test-secret").toString("base64")}`);
    expect(JSON.parse(options.body).variables).toEqual({ id: "suite-model" });
  });
  it("does not call GraphQL errors or a mismatched model live", async () => {
    vi.stubEnv("MATTERPORT_API_KEY", "test-id"); vi.stubEnv("MATTERPORT_TOKEN", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "denied" }] }), { status: 200 })));
    const model = await resolveMatterport(properties[0] as PropertyListing);
    expect(model.source).toBe("matterport-showcase");
    expect(model.detail).toMatch(/unavailable/);
  });
});

function measured(id: string): PropertyListing {
  return { ...properties[0], source: "costar-extract", matterportModelId: id,
    provenance: { listingId: "synthetic", spaceId: "s", suite: "s", askingRate: 1, rateBasis: "USD/sqft/month", geometry: "Synthetic metadata test", assumptions: [] },
    floorPlan: { modelId: id, floorId: "f", units: "meters", entry: { x: 1, z: 1 }, serviceOrigin: { x: 2, z: 2 },
      rooms: [{ id: "room", areaM2: 100, polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }] }],
      walls: [{ id: "wall", a: { x: 0, z: 0 }, b: { x: 10, z: 0 }, thickness: 0.16,
        openings: [{ id: "window", type: "window", center: 0.4, width: 2, height: 2.4 }] }],
    } } as PropertyListing;
}
function metadata(id: string) {
  return { id, floors: [{ id: "f", edges: [{ id: "wall", openings: [{ id: "window", lowerElevation: -1.1 }] }] }],
    rooms: [{ id: "room", label: "Main Dining Room", dimensionEstimates: { height: 4.2, lowerElevation: -2 } }] };
}
function configure() { vi.stubEnv("MATTERPORT_API_KEY", "test-id"); vi.stubEnv("MATTERPORT_TOKEN", "test-secret"); }

describe("matched measured metadata enrichment", () => {
  it("reads once, matches exact IDs and normalizes absolute elevation without changing topology", async () => {
    configure(); const listing = measured("metadata-success");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { model: metadata(listing.matterportModelId!) } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const [a, b] = await Promise.all([enrichMeasuredProperty(listing), enrichMeasuredProperty(listing)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a.floorPlan?.metadataSource).toBe("matterport-live");
    expect(a.floorPlan?.rooms[0].label).toBe("Main Dining Room");
    expect(a.floorPlan?.rooms[0].labelSource).toBe("user-label");
    expect(a.floorPlan?.rooms[0].height).toBe(4.2);
    expect(a.floorPlan?.sourceFloorElevation).toBe(-2);
    expect(a.floorPlan?.walls[0].openings[0].lowerElevation).toBeCloseTo(0.9);
    expect(a.floorPlan?.walls[0].openings[0].sourceLowerElevation).toBe(-1.1);
    expect(a.floorPlan?.rooms[0].polygon).toEqual(listing.floorPlan?.rooms[0].polygon);
    expect(a.floorPlan?.entry).toEqual(listing.floorPlan?.entry);
    expect(a.floorPlan?.walls[0].a).toEqual(listing.floorPlan?.walls[0].a);
    expect(a.floorPlan?.walls[0].openings[0].width).toBe(2);
    expect(b.floorPlan).toEqual(a.floorPlan);
    expect(listing.floorPlan?.metadataSource).toBeUndefined();
    const request = fetcher.mock.calls[0][1];
    expect(request.headers.Authorization).toBe(`Basic ${Buffer.from("test-id:test-secret").toString("base64")}`);
    expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body).variables).toEqual({ id: listing.matterportModelId });
  });
  it.each(["model", "floor", "room", "opening"])("preserves original data if %s IDs do not match", async (kind) => {
    configure(); const listing = measured(`metadata-mismatch-${kind}`); const model = metadata(listing.matterportModelId!);
    if (kind === "model") model.id = "other";
    if (kind === "floor") model.floors[0].id = "other";
    if (kind === "room") model.rooms[0].id = "other";
    if (kind === "opening") model.floors[0].edges[0].openings[0].id = "other";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { model } }), { status: 200 })));
    expect(await enrichMeasuredProperty(listing)).toBe(listing);
  });
  it.each(["rejected", "graphql", "timeout"])("keeps geometry and caches %s failure without retries", async (kind) => {
    configure(); const listing = measured(`metadata-failure-${kind}`);
    const fetcher = kind === "timeout" ? vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")) :
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "denied" }] }), { status: kind === "rejected" ? 403 : 200 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await enrichMeasuredProperty(listing)).toBe(listing);
    expect(await enrichMeasuredProperty(listing)).toBe(listing);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not use raw absolute elevation when the source floor baseline is absent", async () => {
    configure(); const listing = measured("metadata-no-baseline"); const model = metadata(listing.matterportModelId!);
    delete (model.rooms[0].dimensionEstimates as { lowerElevation?: number }).lowerElevation;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { model } }), { status: 200 })));
    const enriched = await enrichMeasuredProperty(listing);
    expect(enriched.floorPlan?.walls[0].openings[0].sourceLowerElevation).toBe(-1.1);
    expect(enriched.floorPlan?.walls[0].openings[0].lowerElevation).toBeUndefined();
  });
  it.each([
    { name: "user-wins", user: "Kitchen", labels: ["Storage"], expected: "Kitchen", source: "user-label" },
    { name: "one-detected", user: "", labels: ["Storage", "Storage"], expected: "Storage", source: "detected-classification" },
    { name: "ambiguous", user: "", labels: ["Kitchen", "Storage"], expected: undefined, source: undefined },
    { name: "empty", user: "", labels: ["", "  ", "Unknown", "Other"], expected: undefined, source: undefined },
  ])("uses only unambiguous provider room labels: $name", async ({ name, user, labels, expected, source }) => {
    configure(); const listing = measured(`metadata-label-${name}`); const model = metadata(listing.matterportModelId!);
    listing.floorPlan!.rooms[0].label = "Stale label";
    Object.assign(model.rooms[0], { label: user, classifications: labels.map((label) => ({ label })) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { model } }), { status: 200 })));
    const enriched = await enrichMeasuredProperty(listing);
    expect(enriched.floorPlan?.rooms[0].label).toBe(expected);
    expect(enriched.floorPlan?.rooms[0].labelSource).toBe(source);
  });
  it("makes no provider request for missing credentials or mock properties", async () => {
    vi.stubEnv("MATTERPORT_API_KEY", ""); vi.stubEnv("MATTERPORT_TOKEN", ""); vi.stubEnv("MATTERPORT_SDK_TOKEN", "");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const listing = measured("metadata-no-key");
    expect(await enrichMeasuredProperty(listing)).toBe(listing);
    configure(); const mock = { ...listing, source: "costar-mock" as const };
    expect(await enrichMeasuredProperty(mock)).toBe(mock);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
