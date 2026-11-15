import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { CafeRoomServer } from "./rooms.ts";
import type { RoomSnapshot, ServerMsg } from "../shared/types.ts";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function selectFictional(): Promise<RoomSnapshot> {
  const http = createServer();
  const rooms = new CafeRoomServer(new WebSocketServer({ server: http }));
  const room = rooms.createRoom();
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const ws = new WebSocket(`ws://127.0.0.1:${(http.address() as { port: number }).port}`);
  try {
    await new Promise<void>((resolve) => ws.once("open", resolve));
    const selected = new Promise<RoomSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 3000);
      ws.on("message", (bytes) => {
        const msg = JSON.parse(String(bytes)) as ServerMsg;
        if (msg.t === "welcome") ws.send(JSON.stringify({ t: "select_property", propertyId: "hou-eaado-41" }));
        if (msg.t === "snapshot" && msg.snapshot.property?.id === "hou-eaado-41") { clearTimeout(timer); resolve(msg.snapshot); }
      });
    });
    ws.send(JSON.stringify({ t: "hello", room: room.code, name: "Owner", role: "owner" }));
    return await selected;
  } finally { ws.close(); http.close(); }
}

describe("Nessie sandbox auto-connect on Render", () => {
  const stubProvider = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "sandbox-id" }), { status: 200 })));

  it("attaches a sandbox account when a fictional property is selected", async () => {
    vi.stubEnv("RENDER", "true"); vi.stubEnv("NESSIE_KEY", "nsk_test"); vi.stubEnv("NESSIE_REQUIRE_ACTIVATION", "");
    stubProvider();
    expect((await selectFictional()).finance.nessieSync).toBeDefined();
  });

  it("keeps the activation-code flow when NESSIE_REQUIRE_ACTIVATION=true", async () => {
    vi.stubEnv("RENDER", "true"); vi.stubEnv("NESSIE_KEY", "nsk_test"); vi.stubEnv("NESSIE_REQUIRE_ACTIVATION", "true");
    stubProvider();
    expect((await selectFictional()).finance.nessieSync).toBeUndefined();
  });
});
