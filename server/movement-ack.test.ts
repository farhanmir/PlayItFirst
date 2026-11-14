import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { CafeRoomServer } from "./rooms";
import type { ServerMsg } from "../shared/types";

function waitFor(ws: WebSocket, predicate: (m: ServerMsg) => boolean): Promise<ServerMsg> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off("message", read); reject(new Error("Movement snapshot timeout")); }, 3000);
    const read = (bytes: WebSocket.RawData) => {
      const message = JSON.parse(String(bytes)) as ServerMsg;
      if (predicate(message)) { clearTimeout(timer); ws.off("message", read); resolve(message); }
    };
    ws.on("message", read);
  });
}
describe("authoritative movement acknowledgements", () => {
  it("acknowledges rejected input and ignores duplicate sequence positions", async () => {
    const http = createServer(); const wss = new WebSocketServer({ server: http });
    const rooms = new CafeRoomServer(wss); const room = rooms.createRoom();
    await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
    const ws = new WebSocket(`ws://127.0.0.1:${(http.address() as {port:number}).port}`);
    try {
      await new Promise<void>(resolve => ws.once("open", resolve));
      const welcomePromise = waitFor(ws, m => m.t === "welcome");
      ws.send(JSON.stringify({t:"hello",room:room.code,name:"Player"}));
      const welcome = await welcomePromise;
      if (welcome.t !== "welcome") throw Error("No welcome");
      const initial = welcome.snapshot.players.find(p => p.id === welcome.you)!;
      expect(initial.moveAck).toBe(0);
      const ack = waitFor(ws, m => m.t === "snapshot" && m.snapshot.players.some(p=>p.id===welcome.you&&p.moveAck===1));
      // No property is selected: movement is rejected by the authoritative simulation.
      ws.send(JSON.stringify({t:"player_move",x:8,z:8,seq:1}));
      ws.send(JSON.stringify({t:"player_move",x:9,z:9,seq:1}));
      ws.send(JSON.stringify({t:"interact",action:"serve"})); // Requests a normal broadcast while still in setup.
      const result = await ack;
      if (result.t !== "snapshot") throw Error("No snapshot");
      expect(result.snapshot.players.find(p=>p.id===welcome.you)).toMatchObject({x:initial.x,z:initial.z,moveAck:1});
    } finally {
      const running = rooms.getRoom(room.code);
      clearInterval(running?.stepTimer);clearInterval(running?.snapshotTimer);clearInterval(running?.directorTimer);
      ws.terminate();wss.close();await new Promise<void>(resolve=>http.close(()=>resolve()));
    }
  });
});
