import { describe, expect, it } from "vitest";
import { apiUrl } from "./api";

describe("apiUrl", () => {
  it("keeps relative paths for same-origin defaults", () => {
    expect(apiUrl("/api/rooms")).toBe("/api/rooms");
    expect(apiUrl("api/health")).toBe("/api/health");
  });
});
