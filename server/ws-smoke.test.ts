import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { CafeRoomServer } from "./rooms.ts";
import { seedDemoCrowd } from "./simulation.ts";

describe("multiplayer room smoke", () => {
  it("preserves the banking session on duplicate selection and owner resume", async () => {
    vi.stubEnv("NESSIE_KEY", "");
    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });
    const rooms = new CafeRoomServer(wss);
    const created = rooms.createRoom();
    const room = rooms.getRoom(created.code)!;
    const clients: WebSocket[] = [];
    try {
      await new Promise<void>((resolve) => httpServer.listen(0, resolve));
      const port = (httpServer.address() as { port: number }).port;
      const owner = await connectClient(port, created.code, "Owner", "owner");
      clients.push(owner.ws);
      const propertyId = rooms.listProperties()[0].id;
      const selected = waitForSnapshot(owner.ws, (s) => s.property?.id === propertyId);
      owner.ws.send(JSON.stringify({ t: "select_property", propertyId }));
      await selected;
      clearInterval(room.stepTimer); clearInterval(room.snapshotTimer); clearInterval(room.directorTimer);
      const finance = room.snapshot.finance;
      // A pending external receipt must remain the SAME session object; creating
      // another finance session would permit duplicate account provisioning.
      const sync = finance.nessieSync = { status: "ready", accountId: "sandbox-test-account", openingCents: Math.round(finance.balance * 100), records: [] };
      const duplicate = waitForSnapshot(owner.ws, () => true);
      owner.ws.send(JSON.stringify({ t: "select_property", propertyId }));
      await duplicate;
      expect(room.snapshot.finance).toBe(finance);
      expect(room.snapshot.finance.nessieSync).toBe(sync);

      const guest = await connectClient(port, created.code, "Guest", "barista");
      clients.push(guest.ws);
      const denied = waitFor(guest.ws, (m) => m.t === "error");
      guest.ws.send(JSON.stringify({ t: "select_property", propertyId }));
      expect((await denied).message).toMatch(/Only the owner/);
      expect(room.snapshot.finance).toBe(finance);

      const resumed = await connectClient(port, created.code, "Owner", "owner", owner.welcome.token);
      clients.push(resumed.ws);
      expect(resumed.welcome.you).toBe(owner.welcome.you);
      owner.ws.terminate();
      // Deliver the old socket close after the replacement has taken ownership.
      await new Promise((resolve) => setTimeout(resolve, 20));
      const afterResume = waitForSnapshot(resumed.ws, () => true);
      resumed.ws.send(JSON.stringify({ t: "select_property", propertyId }));
      await afterResume;
      expect(room.snapshot.finance).toBe(finance);
      expect(room.snapshot.finance.nessieSync).toBe(sync);
      expect(room.snapshot.finance.transactions).toEqual(finance.transactions);
    } finally {
      clearInterval(room.stepTimer); clearInterval(room.snapshotTimer); clearInterval(room.directorTimer);
      clients.forEach((ws) => ws.terminate()); wss.close();
      await new Promise<void>((resolve, reject) => httpServer.close((err) => err ? reject(err) : resolve()));
      vi.unstubAllEnvs();
    }
  }, 15000);

  it("exports an owner's blueprint without interrupting another player's order", async () => {
    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });
    const rooms = new CafeRoomServer(wss);
    const created = rooms.createRoom();
    const room = rooms.getRoom(created.code)!;
    const clients: WebSocket[] = [];
    try {
      await new Promise<void>((resolve) => httpServer.listen(0, resolve));
      const port = (httpServer.address() as { port: number }).port;
      const host = await connectClient(port, created.code, "Host", "owner");
      clients.push(host.ws);
      const propertyId = rooms.listProperties()[0].id;
      const selected = waitForSnapshot(host.ws, (s) => s.property?.id === propertyId);
      host.ws.send(JSON.stringify({ t: "select_property", propertyId }));
      await selected;
      const guest = await connectClient(port, created.code, "Barista", "barista");
      clients.push(guest.ws);
      const opened = waitForSnapshot(guest.ws, (s) => s.open);
      host.ws.send(JSON.stringify({ t: "open_cafe" }));
      await opened;

      // Freeze incidental arrivals/patience so this asserts only the requested export.
      clearInterval(room.stepTimer);
      clearInterval(room.snapshotTimer);
      clearInterval(room.directorTimer);
      room.snapshot = seedDemoCrowd(room.snapshot);
      const counter = room.snapshot.layout!.furniture.find((f) => f.kind === "counter")!;
      room.snapshot = { ...room.snapshot, players: room.snapshot.players.map((p) =>
        p.id === guest.welcome.you ? { ...p, x: counter.x, z: counter.z } : p) };
      const before = structuredClone(room.snapshot);
      const blueprint = waitFor(host.ws, (m) => m.t === "blueprint");
      const hostShared = waitForSnapshot(host.ws, () => true);
      const guestShared = waitForSnapshot(guest.ws, () => true);
      host.ws.send(JSON.stringify({ t: "request_blueprint" }));
      expect((await blueprint).markdown).toContain("# Play It First Business Launch Blueprint");
      expect((await hostShared).phase).toBe("play");
      expect((await guestShared).phase).toBe("play");
      expect(room.snapshot).toEqual(before);

      const claimedByGuest = (s: any) => s.customers.some((c: any) => c.ticketHolder === guest.welcome.you);
      const ownerOrder = waitForSnapshot(host.ws, claimedByGuest);
      const guestOrder = waitForSnapshot(guest.ws, claimedByGuest);
      guest.ws.send(JSON.stringify({ t: "interact", action: "take_order" }));
      const shared = await ownerOrder;
      expect((await guestOrder).phase).toBe("play");
      expect(shared.players.find((p: any) => p.id === guest.welcome.you).holding).toMatch(/^ticket:/);
      expect(shared.customers.filter((c: any) => c.ticketHolder === guest.welcome.you)).toHaveLength(1);
      expect(shared.finance).toEqual(before.finance);
    } finally {
      clearInterval(room.stepTimer);
      clearInterval(room.snapshotTimer);
      clearInterval(room.directorTimer);
      for (const ws of clients) ws.terminate();
      wss.close();
      await new Promise<void>((resolve, reject) => httpServer.close((err) => err ? reject(err) : resolve()));
    }
  }, 15000);

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

async function connectClient(port: number, room: string, name: string, role: string, resume?: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  const welcomeP = waitFor(ws, (m) => m.t === "welcome");
  ws.send(JSON.stringify({ t: "hello", room, name, role, resume }));
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
