import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY_ID, demoStatusFor, isDemoQuery } from "./demo";

describe("judge demo helpers", () => {
  it("detects demo query flags", () => {
    expect(isDemoQuery("?demo=1")).toBe(true);
    expect(isDemoQuery("?demo=true")).toBe(true);
    expect(isDemoQuery("?room=abc")).toBe(false);
  });

  it("uses Midtown as the demo property", () => {
    expect(DEMO_PROPERTY_ID).toBe("hou-midtown-1204");
  });

  it("returns messaging for each phase", () => {
    expect(demoStatusFor("selecting").message).toMatch(/Midtown/i);
    expect(demoStatusFor("opening").message.length).toBeGreaterThan(4);
    expect(demoStatusFor("ready").message).toMatch(/rush|rival/i);
  });
});
