import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBase, apiUrl, publicOrigin, wsUrl } from "./api";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("same-origin networking", () => {
  it("keeps API paths relative", () => {
    expect(apiUrl("/api/rooms")).toBe("/api/rooms");
    expect(apiUrl("api/health")).toBe("/api/health");
  });

  it("ignores retired split-host overrides and uses the Render origin", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://old.example");
    vi.stubEnv("VITE_WS_URL", "wss://old.example/ws");
    vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://old.example");
    vi.stubGlobal("location", { protocol: "https:", host: "playitfirst.onrender.com", origin: "https://playitfirst.onrender.com" });
    expect(apiBase()).toBe("");
    expect(apiUrl("/api/health")).toBe("/api/health");
    expect(wsUrl()).toBe("wss://playitfirst.onrender.com/ws");
    expect(publicOrigin()).toBe("https://playitfirst.onrender.com");
  });

  it("preserves local development sockets", () => {
    vi.stubGlobal("location", { protocol: "http:", host: "localhost:5173", origin: "http://localhost:5173" });
    expect(wsUrl()).toBe("ws://localhost:5173/ws");
    expect(publicOrigin()).toBe("http://localhost:5173");
  });
});
