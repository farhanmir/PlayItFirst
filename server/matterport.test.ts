import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMatterport } from "./matterport.ts";
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
