import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { CafeRoomServer } from "./rooms.ts";
import type { RoomSnapshot, ServerMsg } from "../shared/types.ts";

function waitFor(ws: WebSocket, predicate: (m: ServerMsg) => boolean): Promise<ServerMsg> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off("message", onMessage); reject(new Error("Manager WS timeout")); }, 3000);
    const onMessage = (bytes: WebSocket.RawData) => {
      const msg = JSON.parse(String(bytes)) as ServerMsg;
      if (predicate(msg)) { clearTimeout(timer); ws.off("message", onMessage); resolve(msg); }
    };
    ws.on("message", onMessage);
  });
}
function snapshot(ws: WebSocket, predicate: (s: RoomSnapshot) => boolean) {
  return waitFor(ws, (m) => m.t === "snapshot" && predicate(m.snapshot)).then((m) => {
    if (m.t !== "snapshot") throw new Error("Expected snapshot");
    return m.snapshot;
  });
}

describe("manager through authenticated shared room messages", () => {
  it("rejects an owner-role spoof and shares an exactly-once approved purchase with two clients", async () => {
    const http = createServer();
    const wss = new WebSocketServer({ server: http });
    const rooms = new CafeRoomServer(wss);
    const room = rooms.createRoom();
    const sockets: WebSocket[] = [];
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const port = (http.address() as { port: number }).port;
    const connect = async (name: string) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      sockets.push(ws);
      await new Promise<void>((resolve) => ws.once("open", resolve));
      const welcome = waitFor(ws, (m) => m.t === "welcome");
      ws.send(JSON.stringify({ t: "hello", room: room.code, name, role: "owner" }));
      const result = await welcome;
      if (result.t !== "welcome") throw new Error("No welcome");
      return { ws, welcome: result };
    };
    try {
      const owner = await connect("Owner");
      const guest = await connect("Spoofed owner");
      expect(guest.welcome.snapshot.players.find((p) => p.id === guest.welcome.you)?.role).toBe("barista");
      const selected = snapshot(guest.ws, (s) => !!s.property);
      owner.ws.send(JSON.stringify({ t: "select_property", propertyId: rooms.listProperties()[0].id }));
      const initial = await selected;
      const denied = waitFor(guest.ws, (m) => m.t === "manager_error");
      guest.ws.send(JSON.stringify({ t: "manager_request", prompt: "Restock" }));
      expect(await denied).toMatchObject({ t: "manager_error", message: expect.stringMatching(/owner/) });
      const proposed = snapshot(guest.ws, (s) => !!s.manager?.proposals.length && !s.manager.busy);
      owner.ws.send(JSON.stringify({ t: "manager_request", prompt: "Restock milk" }));
      const plan = await proposed;
      expect(plan.finance.balance).toBe(initial.finance.balance);
      expect(plan.inventory).toEqual(initial.inventory);
      const id = plan.manager!.proposals[0].id;
      const deniedApproval = waitFor(guest.ws, (m) => m.t === "manager_error");
      guest.ws.send(JSON.stringify({ t: "manager_approve", proposalId: id }));
      await deniedApproval;
      const accepted = snapshot(guest.ws, (s) => s.manager?.proposals[0].status === "executed" && !s.manager.busy);
      owner.ws.send(JSON.stringify({ t: "manager_approve", proposalId: id }));
      owner.ws.send(JSON.stringify({ t: "manager_approve", proposalId: id }));
      const result = await accepted;
      expect(result.finance.balance).toBe(initial.finance.balance - 35);
      expect(result.inventory.milk).toBe(initial.inventory.milk + 12);
      expect(result.finance.transactions.filter((t) => t.category === "inventory")).toHaveLength(1);
      expect(rooms.getRoom(room.code)?.snapshot.finance).toEqual(result.finance);
    } finally {
      const running = rooms.getRoom(room.code);
      clearInterval(running?.stepTimer); clearInterval(running?.snapshotTimer); clearInterval(running?.directorTimer);
      for (const ws of sockets) ws.close();
      wss.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
});
