import { describe, expect, it } from "vitest";
import { getCachedProperties, loadProperties } from "./costar.ts";
import { withMatterportDefaults, resolveMatterport } from "./matterport.ts";
import { deepagentsConfigured } from "./deepagents.ts";

describe("stretch integrations", () => {
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
