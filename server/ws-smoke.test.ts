import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { CafeRoomServer } from "./rooms.ts";

describe("multiplayer room smoke", () => {
  it("two clients share property selection and play open", async () => {
    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });
    const rooms = new CafeRoomServer(wss);
    const created = rooms.createRoom();

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as { port: number }).port;

    const a = await connectClient(port, created.code, "Host", "owner");
    expect(a.welcome.t).toBe("welcome");

    const propertyId = rooms.listProperties()[0].id;
    a.ws.send(JSON.stringify({ t: "select_property", propertyId }));
    const snap1 = await waitForSnapshot(a.ws, (s) => s.property?.id === propertyId);
    expect(snap1.phase).toBe("build");

    const b = await connectClient(port, created.code, "Barista", "barista");
    expect(b.welcome.snapshot.players.length).toBeGreaterThanOrEqual(2);

    a.ws.send(JSON.stringify({ t: "open_cafe" }));
    const snap2 = await waitForSnapshot(a.ws, (s) => s.open === true);
    expect(snap2.phase).toBe("play");

    a.ws.close();
    b.ws.close();
    wss.close();
    await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
  }, 15000);
});

async function connectClient(port: number, room: string, name: string, role: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  const welcomeP = waitFor(ws, (m) => m.t === "welcome");
  ws.send(JSON.stringify({ t: "hello", room, name, role }));
  const welcome = await welcomeP;
  return { ws, welcome };
}

function waitFor(ws: WebSocket, pred: (m: any) => boolean) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), 8000);
    const onMsg = (data: WebSocket.RawData) => {
      try {
        const m = JSON.parse(String(data));
        if (pred(m)) {
          clearTimeout(timer);
          ws.off("message", onMsg);
          resolve(m);
        }
      } catch {
        /* ignore */
      }
    };
    ws.on("message", onMsg);
  });
}

function waitForSnapshot(ws: WebSocket, pred: (s: any) => boolean) {
  return waitFor(ws, (m) => m.t === "snapshot" && pred(m.snapshot)).then((m) => m.snapshot);
}
