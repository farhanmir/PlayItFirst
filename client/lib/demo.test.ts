import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY_ID, demoPropertyId, demoStatusFor, isDemoQuery } from "./demo";

describe("judge demo helpers", () => {
  it("detects demo query flags", () => {
    expect(isDemoQuery("?demo=1")).toBe(true);
    expect(isDemoQuery("?demo=true")).toBe(true);
    expect(isDemoQuery("?room=abc")).toBe(false);
  });

  it("retains Midtown as the fallback demo property", () => {
    expect(DEMO_PROPERTY_ID).toBe("hou-midtown-1204");
  });

  it("returns messaging for each phase", () => {
    expect(demoStatusFor("selecting").message).toMatch(/property/i);
    expect(demoStatusFor("opening").message.length).toBeGreaterThan(4);
    expect(demoStatusFor("ready").message).toMatch(/Jamie/i);
  });
});

describe("demo property choice", () => {
  it("prefers the known measured suite and retains an explicit practice mode", () => {
    const properties = [{ id: DEMO_PROPERTY_ID, source: "costar-mock" }, { id: "costar-other", source: "costar-extract", floorPlan: {} }, { id: "costar-1018657-21963212", source: "costar-extract", floorPlan: {} }];
    expect(demoPropertyId(properties)).toBe("costar-1018657-21963212");
    expect(demoPropertyId(properties, true)).toBe(DEMO_PROPERTY_ID);
    expect(demoPropertyId(properties.slice(0,2))).toBe("costar-other");
    expect(demoPropertyId([{id:"unmeasured",source:"costar-extract"},{id:DEMO_PROPERTY_ID,source:"costar-mock"}])).toBe(DEMO_PROPERTY_ID);
  });
  it("falls back to the first listing, then the default id", () => {
    expect(demoPropertyId([{ id: "only-suite" }])).toBe("only-suite");
    expect(demoPropertyId([])).toBe(DEMO_PROPERTY_ID);
  });
});
