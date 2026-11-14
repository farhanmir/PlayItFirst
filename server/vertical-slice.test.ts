/**
 * P0 vertical-slice regression coverage (issue #4, fixes for issue #2).
 * Economy, queue, and navigation cases that used to be todos are asserted here.
 */
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import properties from "../data/properties.json";
import type { Customer, PropertyListing, RoomSnapshot } from "../shared/types.ts";
import { qrSvg } from "./qr.ts";
import { CafeRoomServer, requestOrigin } from "./rooms.ts";
import {
  STATION_CLEARANCE,
  addPlayer,
  createRoomSnapshot,
  interact,
  moveFurniture,
  openCafe,
  placeFurniture,
  selectProperty,
  stepSimulation,
  syncTabletop,
} from "./simulation.ts";

const listing = (properties as PropertyListing[])[0];

function customer(partial: Partial<Customer> & Pick<Customer, "id" | "state">): Customer {
  return {
    persona: partial.persona ?? "student",
    name: partial.name ?? "Pat",
    budget: partial.budget ?? 10,
    patience: partial.patience ?? 800,
    preference: partial.preference ?? "latte",
    order: partial.order,
    progress: partial.progress ?? 0,
    x: partial.x ?? 2,
    z: partial.z ?? 2,
    targetX: partial.targetX ?? 2,
    targetZ: partial.targetZ ?? 2,
    satisfaction: partial.satisfaction ?? 70,
    joinedAt: partial.joinedAt ?? 1_700_000_000_000,
    ticketHolder: partial.ticketHolder,
    id: partial.id,
    state: partial.state,
  };
}

/** Stop the room tick so a regression asserts the message, not a 20 Hz race. */
function freeze(rooms: CafeRoomServer, code: string) {
  const room = rooms.getRoom(code) as
    | {
        stepTimer?: ReturnType<typeof setInterval>;
        snapshotTimer?: ReturnType<typeof setInterval>;
        directorTimer?: ReturnType<typeof setInterval>;
      }
    | undefined;
  if (!room) return;
  clearInterval(room.stepTimer);
  clearInterval(room.snapshotTimer);
  clearInterval(room.directorTimer);
  room.stepTimer = undefined;
  room.snapshotTimer = undefined;
  room.directorTimer = undefined;
}

function atStation(snapshot: RoomSnapshot, playerId: string, kind: "counter" | "coffee_machine" | "pickup" | "fridge") {
  const station = snapshot.layout?.furniture.find((item) => item.kind === kind);
  if (!station) throw new Error(`missing ${kind}`);
  return {
    ...snapshot,
    players: snapshot.players.map((player) =>
      player.id === playerId ? { ...player, x: station.x, z: station.z } : player,
    ),
  };
}

/** No random arrivals and no Jamie assists, so path assertions stay deterministic. */
function quietFloor(snapshot: RoomSnapshot): RoomSnapshot {
  return {
    ...snapshot,
    property: snapshot.property ? { ...snapshot.property, footTraffic: 0 } : snapshot.property,
    lastHumanInteractAt: 1e9,
    rushBoost: 0,
    director: null,
  };
}

function sales(snapshot: RoomSnapshot) {
  return snapshot.finance.transactions.filter((tx) => tx.category === "sales");
}

describe("shared room join", () => {
  const openSockets: WebSocket[] = [];
  let httpServer: ReturnType<typeof createServer> | undefined;
  let wss: WebSocketServer | undefined;

  afterEach(async () => {
    for (const socket of openSockets) socket.close();
    openSockets.length = 0;
    wss?.close();
    wss = undefined;
    if (httpServer) {
      const closing = httpServer;
      httpServer = undefined;
      await new Promise<void>((resolve, reject) => closing.close((err) => (err ? reject(err) : resolve())));
    }
  });

  async function start() {
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });
    const rooms = new CafeRoomServer(wss);
    const created = rooms.createRoom();
    freeze(rooms, created.code);
    await new Promise<void>((resolve) => httpServer!.listen(0, "127.0.0.1", resolve));
    const port = (httpServer.address() as { port: number }).port;
    return { rooms, port, code: created.code };
  }

  async function connect(
    port: number,
    room: string,
    name: string,
    role: string,
    resume?: string,
  ) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    openSockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    const welcomeP = waitFor(ws, (message) => message.t === "welcome");
    ws.send(JSON.stringify({ t: "hello", room, name, role, resume }));
    const welcome = await welcomeP;
    return { ws, welcome };
  }

  it("seats two clients in one room and shares the selected property", async () => {
    const { rooms, port, code } = await start();
    const host = await connect(port, code, "Host", "owner");
    const guest = await connect(port, code, "Barista", "barista");

    expect(host.welcome.snapshot.code).toBe(code);
    expect(guest.welcome.snapshot.code).toBe(code);
    expect(guest.welcome.snapshot.players.map((player: { name: string }) => player.name)).toEqual([
      "Host",
      "Barista",
    ]);
    expect(host.welcome.you).not.toBe(guest.welcome.you);

    const propertyId = rooms.listProperties()[0]?.id;
    expect(propertyId).toBe(listing.id);
    host.ws.send(JSON.stringify({ t: "select_property", propertyId }));
    const shared = await waitForSnapshot(guest.ws, (snapshot) => snapshot.property?.id === propertyId);
    expect(shared.phase).toBe("build");
    expect(shared.players).toHaveLength(2);
    expect(shared.layout.furniture.some((item: { kind: string }) => item.kind === "counter")).toBe(true);
  });

  it("rejoins the same player with the resume token and does not duplicate them", async () => {
    const { port, code } = await start();
    const host = await connect(port, code, "Host", "owner");
    const token = host.welcome.token as string;
    const playerId = host.welcome.you as string;
    host.ws.close();

    const resumed = await connect(port, code, "Host", "owner", token);
    expect(resumed.welcome.you).toBe(playerId);
    expect(resumed.welcome.token).toBe(token);
    expect(resumed.welcome.snapshot.players).toHaveLength(1);
    expect(resumed.welcome.snapshot.players[0].id).toBe(playerId);

    const intruder = await connect(port, code, "Someone", "barista", "not-a-real-token");
    expect(intruder.welcome.you).not.toBe(playerId);
    expect(intruder.welcome.snapshot.players).toHaveLength(2);
  });

  it("builds a join URL from the given origin and renders an SVG for it", () => {
    const socketServer = new WebSocketServer({ noServer: true });
    const local = new CafeRoomServer(socketServer);
    expect(local.joinUrl("http://127.0.0.1:5173", "abc123")).toBe("http://127.0.0.1:5173/?room=abc123");
    expect(local.joinUrl("https://cafe.example", "abc123")).toBe("https://cafe.example/?room=abc123");
    expect(requestOrigin("cafe.example", "https")).toBe("https://cafe.example");
    expect(requestOrigin("cafe.example", "https, http")).toBe("https://cafe.example");
    expect(requestOrigin("127.0.0.1:5173", undefined, false)).toBe("http://127.0.0.1:5173");
    expect(requestOrigin("cafe.example", undefined, true)).toBe("https://cafe.example");
    const svg = qrSvg(local.joinUrl("https://cafe.example", "abc123"));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("fill=");
    socketServer.close();
  });

  it("rejects a game message sent before hello", async () => {
    const { port } = await start();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    openSockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    const errorP = waitFor(ws, (message) => message.t === "error");
    ws.send(JSON.stringify({ t: "open_cafe" }));
    const error = await errorP;
    expect(error.message).toMatch(/hello/i);
  });
});

describe("paid order, inventory, and exactly-once revenue", () => {
  it("clears a drink when its customer has left, then accepts the next order without inventing a sale", () => {
    let snap = addPlayer(openCafe(selectProperty(createRoomSnapshot("expired-drink"), listing)), "p1", "Alex", "barista");
    snap = atStation(snap, "p1", "pickup");
    snap = {
      ...snap,
      players: snap.players.map((p) => ({ ...p, holding: "drink:espresso" })),
      customers: [customer({ id: "old", state: "leaving", order: "espresso", ticketHolder: "p1" }),
        customer({ id: "next", state: "ordering", preference: "latte" })],
    };
    const revenue = snap.finance.revenue;
    const inventory = { ...snap.inventory };
    snap = interact(snap, "p1", "serve");
    expect(snap.players[0]?.holding).toBeNull();
    expect(snap.finance.revenue).toBe(revenue);
    expect(sales(snap)).toHaveLength(0);
    expect(snap.inventory).toEqual(inventory);
    expect(snap.eventLog[0]).toMatch(/cleared an unclaimed espresso/i);
    snap = atStation(snap, "p1", "counter");
    snap = interact(snap, "p1", "take_order");
    expect(snap.players[0]?.holding).toBe("ticket:latte");
  });

  it("serves at a valid counter even when the coffee machine is slightly closer", () => {
    let snap = addPlayer(openCafe(selectProperty(createRoomSnapshot("overlap-stations"), listing)), "p1", "Alex", "barista");
    snap = {
      ...snap,
      players: snap.players.map((p) => ({ ...p, x: 1.3, z: 5.1, holding: "drink:espresso" })),
      customers: [customer({ id: "ready", state: "waiting", order: "espresso", ticketHolder: "p1" })],
    };
    snap = interact(snap, "p1", "serve");
    expect(snap.players[0]?.holding).toBeNull();
    expect(sales(snap)).toHaveLength(1);
    expect(snap.metrics.customersServed).toBe(1);
  });

  it("consumes milk, beans, and a cup once, then books one matched sale", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("paid"), listing));
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = atStation(snap, "p1", "counter");
    snap = {
      ...snap,
      simTime: 20,
      lastHumanInteractAt: 20,
      customers: [customer({ id: "c1", state: "ordering", preference: "latte", persona: "student", name: "Pat" })],
    };
    const stock = { ...snap.inventory };
    const revenue = snap.finance.revenue;
    const balance = snap.finance.balance;

    snap = interact(snap, "p1", "take_order");
    expect(snap.players[0]?.holding).toBe("ticket:latte");
    expect(snap.customers[0]?.state).toBe("waiting");
    expect(snap.customers[0]?.ticketHolder).toBe("p1");
    expect(snap.finance.revenue).toBe(revenue);

    snap = atStation(snap, "p1", "coffee_machine");
    snap = interact(snap, "p1", "make_coffee");
    expect(snap.inventory).toEqual({
      beans: stock.beans - 1,
      cups: stock.cups - 1,
      milk: stock.milk - 1,
    });
    expect(snap.players[0]?.holding).toMatch(/^brewing:latte@/);
    const brewing = snap.players[0]?.holding;

    snap = interact(snap, "p1", "make_coffee");
    expect(snap.players[0]?.holding).toBe(brewing);
    expect(snap.inventory.beans).toBe(stock.beans - 1);
    expect(snap.inventory.cups).toBe(stock.cups - 1);
    expect(snap.inventory.milk).toBe(stock.milk - 1);
    expect(snap.eventLog[0]).toMatch(/still brewing/i);

    snap = quietFloor(snap);
    let steps = 0;
    while (snap.players[0]?.holding?.startsWith("brewing") && steps < 20) {
      snap = stepSimulation(snap, 0.2);
      steps++;
    }
    expect(snap.players[0]?.holding).toBe("drink:latte");
    expect(snap.finance.revenue).toBe(revenue);
    expect(sales(snap)).toHaveLength(0);

    snap = atStation(snap, "p1", "pickup");
    snap = interact(snap, "p1", "serve");
    const sale = sales(snap);
    expect(sale).toHaveLength(1);
    expect(sale[0]?.label).toBe("latte · Pat");
    expect(sale[0]?.amount).toBe(7);
    expect(snap.finance.revenue).toBe(revenue + 7);
    expect(snap.finance.balance).toBe(balance + 7);
    expect(snap.metrics.customersServed).toBe(1);
    expect(snap.customers[0]?.state).toBe("happy");
    expect(snap.players[0]?.holding).toBeNull();
    expect(snap.inventory).toEqual({
      beans: stock.beans - 1,
      cups: stock.cups - 1,
      milk: stock.milk - 1,
    });

    snap = interact(snap, "p1", "serve");
    expect(snap.finance.revenue).toBe(revenue + 7);
    expect(snap.metrics.customersServed).toBe(1);
    expect(sales(snap)).toHaveLength(1);
    expect(snap.inventory.beans).toBe(stock.beans - 1);
  });

  it("refuses a brew that would consume beans or milk it does not have", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("stock"), listing));
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = atStation(snap, "p1", "coffee_machine");
    snap = {
      ...snap,
      simTime: 4,
      inventory: { beans: 0, cups: 8, milk: 4 },
      players: snap.players.map((player) => ({ ...player, holding: "ticket:latte" })),
      customers: [customer({ id: "c1", state: "waiting", order: "latte", ticketHolder: "p1" })],
    };
    const revenue = snap.finance.revenue;
    snap = interact(snap, "p1", "make_coffee");
    expect(snap.inventory).toEqual({ beans: 0, cups: 8, milk: 4 });
    expect(snap.players[0]?.holding).toBe("ticket:latte");
    expect(snap.finance.revenue).toBe(revenue);
    expect(snap.eventLog[0]).toMatch(/out of beans or cups/i);

    snap = {
      ...snap,
      inventory: { beans: 3, cups: 8, milk: 0 },
      eventLog: [],
    };
    snap = interact(snap, "p1", "make_coffee");
    expect(snap.inventory).toEqual({ beans: 3, cups: 8, milk: 0 });
    expect(snap.players[0]?.holding).toBe("ticket:latte");
    expect(snap.finance.revenue).toBe(revenue);
    expect(snap.eventLog[0]).toMatch(/needs milk/i);
  });

  it("shows the same inventory drop to the other client and does not sell at brew start", async () => {
    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });
    const rooms = new CafeRoomServer(wss);
    const created = rooms.createRoom();
    freeze(rooms, created.code);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const port = (httpServer.address() as { port: number }).port;
    const sockets: WebSocket[] = [];
    try {
      const host = await connectClient(sockets, port, created.code, "Host", "owner");
      const guest = await connectClient(sockets, port, created.code, "Barista", "barista");
      const propertyId = rooms.listProperties()[0].id;
      host.ws.send(JSON.stringify({ t: "select_property", propertyId }));
      await waitForSnapshot(guest.ws, (snapshot) => snapshot.property?.id === propertyId);
      host.ws.send(JSON.stringify({ t: "open_cafe" }));
      await waitForSnapshot(guest.ws, (snapshot) => snapshot.open === true);
      host.ws.send(JSON.stringify({ t: "demo_boost" }));
      const seeded = await waitForSnapshot(guest.ws, (snapshot) => snapshot.customers.length >= 3);
      const stock = { ...seeded.inventory };

      const machine = seeded.layout.furniture.find((item: { kind: string }) => item.kind === "coffee_machine");
      host.ws.send(JSON.stringify({ t: "interact", action: "take_order" }));
      const taken = await waitForSnapshot(
        guest.ws,
        (snapshot) => snapshot.players.find((player: { name: string }) => player.name === "Host")?.holding?.startsWith("ticket:"),
      );
      expect(taken.finance.revenue).toBe(0);
      expect(taken.inventory).toEqual(stock);
      const ticket = taken.players.find((player: { name: string }) => player.name === "Host").holding as string;
      const order = ticket.slice("ticket:".length);
      const milkUsed = order === "latte" || order === "cappuccino" || order === "mocha" ? 1 : 0;

      host.ws.send(JSON.stringify({ t: "player_move", x: machine.x, z: machine.z }));
      host.ws.send(JSON.stringify({ t: "interact", action: "make_coffee" }));
      const brewed = await waitForSnapshot(guest.ws, (snapshot) => {
        const hostPlayer = snapshot.players.find((player: { name: string }) => player.name === "Host");
        return typeof hostPlayer?.holding === "string" && hostPlayer.holding.startsWith("brewing:");
      });
      expect(brewed.inventory).toEqual({
        beans: stock.beans - 1,
        cups: stock.cups - 1,
        milk: stock.milk - milkUsed,
      });
      expect(brewed.finance.revenue).toBe(0);
      expect(brewed.metrics.customersServed).toBe(0);
      expect(brewed.open).toBe(true);

      host.ws.send(JSON.stringify({ t: "interact", action: "make_coffee" }));
      const again = await waitForSnapshot(guest.ws, (snapshot) =>
        snapshot.eventLog.some((line: string) => /still brewing/i.test(line)),
      );
      expect(again.inventory).toEqual(brewed.inventory);
      expect(again.finance.revenue).toBe(0);
      expect(salesOf(again)).toHaveLength(0);
    } finally {
      freeze(rooms, created.code);
      for (const socket of sockets) socket.close();
      wss.close();
      await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
    }
  });
});

describe("counter and pickup move during active service", () => {
  it("keeps the open ticket and retargets the line when the counter and pickup move", () => {
    let snap = quietFloor(openCafe(selectProperty(createRoomSnapshot("move"), listing)));
    snap = addPlayer(snap, "p1", "Alex", "barista");
    const counter = snap.layout!.furniture.find((item) => item.kind === "counter")!;
    const pickup = snap.layout!.furniture.find((item) => item.kind === "pickup")!;
    snap = {
      ...snap,
      simTime: 12,
      inventory: { beans: 29, cups: 39, milk: 23 },
      players: snap.players.map((player) =>
        player.id === "p1" ? { ...player, x: counter.x, z: counter.z, holding: "brewing:latte@12" } : player,
      ),
      customers: [
        customer({
          id: "line",
          state: "ordering",
          x: counter.x + 4,
          z: counter.z,
          name: "Line",
        }),
        customer({
          id: "wait",
          state: "waiting",
          order: "latte",
          ticketHolder: "p1",
          progress: 0.2,
          x: 1,
          z: 1,
          name: "Wait",
        }),
      ],
    };

    const nextCounter = { x: Math.min(listing.width - 1, counter.x + 6), z: Math.min(listing.depth - 1, counter.z + 2) };
    const nextPickup = { x: Math.min(listing.width - 1, pickup.x + 3), z: Math.max(1, pickup.z - 2) };
    snap = syncTabletop(snap, [
      { kind: "counter", x: nextCounter.x, z: nextCounter.z },
      { kind: "pickup", x: nextPickup.x, z: nextPickup.z },
    ]);
    expect(snap.layout!.furniture.find((item) => item.kind === "counter")).toMatchObject(nextCounter);
    expect(snap.layout!.furniture.find((item) => item.kind === "pickup")).toMatchObject(nextPickup);
    expect(snap.players[0]?.holding).toBe("brewing:latte@12");
    expect(snap.inventory).toEqual({ beans: 29, cups: 39, milk: 23 });
    expect(snap.finance.revenue).toBe(0);
    expect(snap.open).toBe(true);
    expect(snap.customers.find((item) => item.id === "wait")?.ticketHolder).toBe("p1");

    const lineBefore = snap.customers.find((item) => item.id === "line")!;
    const distanceBefore = Math.hypot(lineBefore.x - (nextCounter.x + 0.2), lineBefore.z - (nextCounter.z - 1.2));
    for (let i = 0; i < 12; i++) snap = stepSimulation(snap, 0.25);
    const line = snap.customers.find((item) => item.id === "line")!;
    const distanceAfter = Math.hypot(line.x - (nextCounter.x + 0.2), line.z - Math.max(0.8, nextCounter.z - 1.2));
    expect(line.state === "ordering" || line.state === "queue").toBe(true);
    expect(line.targetX).toBeCloseTo(nextCounter.x + 0.2, 5);
    expect(distanceAfter).toBeLessThan(distanceBefore);

    const waiting = snap.customers.find((item) => item.id === "wait")!;
    expect(waiting.state).toBe("waiting");
    expect(waiting.targetX).toBeCloseTo(nextPickup.x + 0.8, 5);
    expect(waiting.targetZ).toBeCloseTo(nextPickup.z, 5);
  });

  it("broadcasts a live counter and pickup move to the other client while the café is open", async () => {
    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });
    const rooms = new CafeRoomServer(wss);
    const created = rooms.createRoom();
    freeze(rooms, created.code);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const port = (httpServer.address() as { port: number }).port;
    const sockets: WebSocket[] = [];
    try {
      const host = await connectClient(sockets, port, created.code, "Host", "owner");
      const guest = await connectClient(sockets, port, created.code, "Barista", "barista");
      const propertyId = rooms.listProperties()[0].id;
      host.ws.send(JSON.stringify({ t: "select_property", propertyId }));
      await waitForSnapshot(guest.ws, (snapshot) => snapshot.phase === "build");
      host.ws.send(JSON.stringify({ t: "open_cafe" }));
      host.ws.send(JSON.stringify({ t: "demo_boost" }));
      const live = await waitForSnapshot(
        guest.ws,
        (snapshot) => snapshot.open === true && snapshot.customers.length >= 3,
      );
      const counter = live.layout.furniture.find((item: { kind: string }) => item.kind === "counter");
      const pickup = live.layout.furniture.find((item: { kind: string }) => item.kind === "pickup");
      const counterAt = { x: counter.x + 4, z: counter.z + 1 };
      const pickupAt = { x: pickup.x + 2, z: Math.max(0.6, pickup.z - 1.5) };

      // Vacate pickup first: the counter destination overlaps its old clearance.
      host.ws.send(JSON.stringify({ t: "move_furniture", id: pickup.id, x: pickupAt.x, z: pickupAt.z }));
      host.ws.send(JSON.stringify({ t: "move_furniture", id: counter.id, x: counterAt.x, z: counterAt.z }));
      const moved = await waitForSnapshot(guest.ws, (snapshot) => {
        const nextCounter = snapshot.layout.furniture.find((item: { kind: string }) => item.kind === "counter");
        const nextPickup = snapshot.layout.furniture.find((item: { kind: string }) => item.kind === "pickup");
        return (
          Math.abs(nextCounter.x - counterAt.x) < 0.01 &&
          Math.abs(nextCounter.z - counterAt.z) < 0.01 &&
          Math.abs(nextPickup.x - pickupAt.x) < 0.01 &&
          Math.abs(nextPickup.z - pickupAt.z) < 0.01
        );
      });
      expect(moved.open).toBe(true);
      expect(moved.phase).toBe("play");
      expect(moved.customers.length).toBeGreaterThanOrEqual(3);
      const hostView = rooms.getRoom(created.code)?.snapshot;
      expect(hostView?.layout?.furniture.find((item) => item.kind === "counter")).toMatchObject(counterAt);
      expect(hostView?.layout?.furniture.find((item) => item.kind === "pickup")).toMatchObject(pickupAt);
    } finally {
      freeze(rooms, created.code);
      for (const socket of sockets) socket.close();
      wss.close();
      await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
    }
  });
});

describe("customer path and queue", () => {
  it("walks an entering guest up to the counter and holds a spaced queue", () => {
    let snap = quietFloor(openCafe(selectProperty(createRoomSnapshot("queue"), listing)));
    const counter = snap.layout!.furniture.find((item) => item.kind === "counter")!;
    snap = {
      ...snap,
      customers: [
        customer({
          id: "arrive",
          state: "entering",
          name: "Ari",
          x: 0,
          z: 1,
          targetX: counter.x,
          targetZ: Math.max(1, counter.z - 1),
        }),
      ],
    };
    for (let i = 0; i < 20; i++) snap = stepSimulation(snap, 0.25);
    const arrived = snap.customers.find((item) => item.id === "arrive")!;
    expect(arrived.state).toBe("ordering");
    expect(arrived.targetX).toBeCloseTo(counter.x + 0.2, 5);
    expect(Math.hypot(arrived.x - arrived.targetX, arrived.z - arrived.targetZ)).toBeLessThan(0.5);

    snap = quietFloor(openCafe(selectProperty(createRoomSnapshot("queue-2"), listing)));
    const line = snap.layout!.furniture.find((item) => item.kind === "counter")!;
    snap = {
      ...snap,
      customers: [
        customer({ id: "head", state: "queue", name: "Head", x: line.x + 5, z: 1 }),
        customer({ id: "second", state: "queue", name: "Second", x: line.x + 5, z: 1 }),
      ],
    };
    for (let i = 0; i < 16; i++) snap = stepSimulation(snap, 0.25);
    const head = snap.customers.find((item) => item.id === "head")!;
    const second = snap.customers.find((item) => item.id === "second")!;
    expect(head.state).toBe("ordering");
    expect(second.state).toBe("queue");
    expect(head.targetX).toBeCloseTo(line.x + 0.2, 5);
    expect(head.targetZ).toBeCloseTo(Math.max(0.8, line.z - 1.2), 5);
    expect(second.targetZ).toBeCloseTo(Math.max(0.8, line.z - 1.2 - 0.7), 5);
    expect(Math.abs(head.targetZ - second.targetZ)).toBeGreaterThan(0.6);
    expect(Math.hypot(head.x - head.targetX, head.z - head.targetZ)).toBeLessThan(0.5);
    expect(Math.hypot(second.x - second.targetX, second.z - second.targetZ)).toBeLessThan(0.5);
  });

  it("retargets the queue when the counter moves and a waiting guest when pickup moves", () => {
    let snap = quietFloor(openCafe(selectProperty(createRoomSnapshot("reroute"), listing)));
    const counter = snap.layout!.furniture.find((item) => item.kind === "counter")!;
    const pickup = snap.layout!.furniture.find((item) => item.kind === "pickup")!;
    snap = {
      ...snap,
      customers: [
        customer({ id: "head", state: "queue", name: "Head", x: counter.x + 6, z: 1 }),
        customer({
          id: "wait",
          state: "waiting",
          name: "Rin",
          order: "espresso",
          progress: 0,
          x: 1,
          z: 1,
        }),
      ],
    };

    for (let i = 0; i < 8; i++) snap = stepSimulation(snap, 0.25);
    expect(snap.customers.find((item) => item.id === "head")?.state).toBe("ordering");

    const farCounter = { x: 11, z: 8 };
    const farPickup = { x: 12, z: 2 };
    snap = moveFurniture(snap, counter.id, farCounter.x, farCounter.z);
    snap = moveFurniture(snap, pickup.id, farPickup.x, farPickup.z);
    const waitingBefore = snap.customers.find((item) => item.id === "wait")!;
    const pickupDistanceBefore = Math.hypot(waitingBefore.x - (farPickup.x + 0.8), waitingBefore.z - farPickup.z);

    for (let i = 0; i < 12; i++) snap = stepSimulation(snap, 0.25);
    const head = snap.customers.find((item) => item.id === "head")!;
    const waiting = snap.customers.find((item) => item.id === "wait")!;
    expect(head.state === "ordering" || head.state === "queue").toBe(true);
    expect(head.targetX).toBeCloseTo(farCounter.x + 0.2, 5);
    expect(head.targetZ).toBeCloseTo(Math.max(0.8, farCounter.z - 1.2), 5);
    expect(Math.hypot(head.x - head.targetX, head.z - head.targetZ)).toBeLessThan(2);
    expect(waiting.state).toBe("waiting");
    expect(waiting.targetX).toBeCloseTo(farPickup.x + 0.8, 5);
    expect(waiting.targetZ).toBeCloseTo(farPickup.z, 5);
    expect(Math.hypot(waiting.x - waiting.targetX, waiting.z - waiting.targetZ)).toBeLessThan(pickupDistanceBefore);
  });
});

describe("exactly-once fulfillment", () => {
  it("does not book revenue when the player is not holding the brewed drink", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("empty-serve"), listing));
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = atStation(snap, "p1", "pickup");
    snap = {
      ...snap,
      simTime: 3,
      inventory: { beans: 30, cups: 40, milk: 24 },
      customers: [
        customer({
          id: "w1",
          state: "waiting",
          order: "latte",
          progress: 0.5,
          persona: "office",
          name: "Nia",
          ticketHolder: "p1",
        }),
      ],
    };
    const revenue = snap.finance.revenue;
    const stock = { ...snap.inventory };
    snap = interact(snap, "p1", "serve");
    expect(snap.finance.revenue).toBe(revenue);
    expect(snap.metrics.customersServed).toBe(0);
    expect(snap.inventory).toEqual(stock);
    expect(snap.customers[0]?.state).toBe("waiting");
    expect(sales(snap)).toHaveLength(0);
    expect(snap.eventLog[0]).toMatch(/brew a drink/i);
  });

  it("does not auto-sell a waiting guest when progress reaches 1", () => {
    let snap = quietFloor(openCafe(selectProperty(createRoomSnapshot("no-autosale"), listing)));
    snap = {
      ...snap,
      simTime: 1,
      customers: [
        customer({
          id: "w2",
          state: "waiting",
          order: "espresso",
          progress: 0.85,
          persona: "regular",
          name: "Omar",
          patience: 5000,
        }),
      ],
    };
    const revenue = snap.finance.revenue;
    const stock = { ...snap.inventory };
    for (let i = 0; i < 80; i++) snap = stepSimulation(snap, 0.25);
    expect(snap.metrics.customersServed).toBe(0);
    expect(snap.finance.revenue).toBe(revenue);
    expect(snap.inventory).toEqual(stock);
    expect(sales(snap)).toHaveLength(0);
    expect(snap.customers.find((item) => item.id === "w2")?.state).toBe("waiting");
  });

  it("does not mint revenue when collect is pressed twice", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("collect"), listing));
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = atStation(snap, "p1", "counter");
    const revenue = snap.finance.revenue;
    const balance = snap.finance.balance;
    const salesBefore = sales(snap).length;
    snap = interact(snap, "p1", "collect");
    snap = interact(snap, "p1", "collect");
    expect(snap.finance.revenue).toBe(revenue);
    expect(snap.finance.balance).toBe(balance);
    expect(snap.metrics.customersServed).toBe(0);
    expect(sales(snap)).toHaveLength(salesBefore);
  });

  it("refuses a restock that the balance cannot cover and still restocks when it can", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("restock"), listing));
    snap = addPlayer(snap, "p1", "Alex", "barista");
    snap = atStation(snap, "p1", "fridge");
    const stock = { ...snap.inventory };
    snap = { ...snap, finance: { ...snap.finance, balance: 10 } };
    snap = interact(snap, "p1", "restock");
    expect(snap.finance.balance).toBe(10);
    expect(snap.inventory).toEqual(stock);
    expect(snap.eventLog[0]).toMatch(/need \$35/i);

    snap = { ...snap, finance: { ...snap.finance, balance: 100 } };
    snap = interact(snap, "p1", "restock");
    expect(snap.finance.balance).toBe(65);
    expect(snap.inventory).toEqual({
      milk: stock.milk + 12,
      cups: stock.cups + 20,
      beans: stock.beans + 15,
    });
  });
});

describe("collision-aware navigation", () => {
  it("walks around a station on the queue path and still reaches the counter", () => {
    let layout = quietFloor(openCafe(selectProperty(createRoomSnapshot("path-clear"), listing)));
    const counter = layout.layout!.furniture.find((item) => item.kind === "counter")!;
    const machine = layout.layout!.furniture.find((item) => item.kind === "coffee_machine")!;
    layout = moveFurniture(layout, counter.id, 2, 8);
    const slot = { x: 2.2, z: Math.max(0.8, 8 - 1.2) };
    const start = { x: slot.x, z: 1 };
    const withGuest = (base: RoomSnapshot) =>
      quietFloor({
        ...base,
        customers: [customer({ id: "walk", state: "queue", name: "Walk", x: start.x, z: start.z, patience: 5000 })],
      });

    const clearSteps = stepsUntilNear(withGuest(layout), "walk", slot, 0.5);
    let blocked = moveFurniture(layout, machine.id, slot.x, (start.z + slot.z) / 2);
    expect(blocked.layout!.furniture.find((item) => item.kind === "coffee_machine")).toMatchObject({
      x: slot.x,
      z: (start.z + slot.z) / 2,
    });
    blocked = withGuest(blocked);
    const obstacle = blocked.layout!.furniture.find((item) => item.kind === "coffee_machine")!;
    const samples: { x: number; z: number }[] = [{ ...start }];
    let steps = 0;
    for (; steps < 40; steps++) {
      blocked = stepSimulation(blocked, 0.25);
      const walker = blocked.customers.find((item) => item.id === "walk")!;
      samples.push({ x: walker.x, z: walker.z });
      if (Math.hypot(walker.x - slot.x, walker.z - slot.z) < 0.5) break;
    }
    expect(steps).toBeGreaterThan(clearSteps);
    expect(steps).toBeLessThan(40);
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1]!;
      const next = samples[i]!;
      expect(segmentDistance(prev.x, prev.z, next.x, next.z, obstacle.x, obstacle.z)).toBeGreaterThanOrEqual(
        STATION_CLEARANCE - 0.05,
      );
    }
    const arrived = blocked.customers.find((item) => item.id === "walk")!;
    expect(arrived.state === "ordering" || arrived.state === "queue").toBe(true);

    const waited = quietFloor({
      ...layout,
      customers: [customer({ id: "line", state: "ordering", name: "Line", x: slot.x, z: slot.z })],
    });
    let measured = waited;
    for (let i = 0; i < 8; i++) measured = stepSimulation(measured, 0.25);
    expect(measured.metrics.avgWaitSec).toBeCloseTo(2, 1);
  });

  it("reroutes after a station is moved onto the remaining path", () => {
    let snap = quietFloor(openCafe(selectProperty(createRoomSnapshot("reroute-live"), listing)));
    const counter = snap.layout!.furniture.find((item) => item.kind === "counter")!;
    const machine = snap.layout!.furniture.find((item) => item.kind === "coffee_machine")!;
    const slot = { x: counter.x + 0.2, z: Math.max(0.8, counter.z - 1.2) };
    snap = {
      ...snap,
      customers: [customer({ id: "walk", state: "queue", name: "Walk", x: slot.x, z: 8, patience: 5000 })],
    };
    snap = stepSimulation(snap, 0.25);
    const mid = snap.customers.find((item) => item.id === "walk")!;
    snap = moveFurniture(snap, machine.id, slot.x, (mid.z + slot.z) / 2);
    const obstacle = snap.layout!.furniture.find((item) => item.kind === "coffee_machine")!;
    let previous = { x: mid.x, z: mid.z };
    let arrived = false;
    for (let i = 0; i < 40; i++) {
      snap = stepSimulation(snap, 0.25);
      const walker = snap.customers.find((item) => item.id === "walk")!;
      expect(segmentDistance(previous.x, previous.z, walker.x, walker.z, obstacle.x, obstacle.z)).toBeGreaterThanOrEqual(
        STATION_CLEARANCE - 0.05,
      );
      previous = { x: walker.x, z: walker.z };
      if (Math.hypot(walker.x - slot.x, walker.z - slot.z) < 0.5) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
  });

  it("rejects a furniture line that would seal the entrance off from the counter", () => {
    let snap = openCafe(selectProperty(createRoomSnapshot("seal"), listing));
    let rejected = false;
    for (let x = 0.6; x <= listing.width - 0.6; x += 1) {
      const before = snap.layout!.furniture.length;
      const balance = snap.finance.balance;
      const next = placeFurniture(snap, "chair", x, 2);
      if (next.layout!.furniture.length === before) {
        expect(next.finance.balance).toBe(balance);
        expect(next.eventLog[0]).toMatch(/block the service path/i);
        rejected = true;
        break;
      }
      snap = next;
    }
    expect(rejected).toBe(true);
  });
});

function stepsUntilNear(snapshot: RoomSnapshot, id: string, slot: { x: number; z: number }, radius: number) {
  let steps = 0;
  let snap = snapshot;
  for (; steps < 40; steps++) {
    const guest = snap.customers.find((item) => item.id === id);
    if (guest && Math.hypot(guest.x - slot.x, guest.z - slot.z) < radius) return steps;
    snap = stepSimulation(snap, 0.25);
  }
  return steps;
}

function segmentDistance(x1: number, z1: number, x2: number, z2: number, cx: number, cz: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - x1) * dx + (cz - z1) * dz) / len2));
  return Math.hypot(x1 + t * dx - cx, z1 + t * dz - cz);
}

function salesOf(snapshot: { finance: { transactions: { category: string }[] } }) {
  return snapshot.finance.transactions.filter((tx) => tx.category === "sales");
}

async function connectClient(
  sockets: WebSocket[],
  port: number,
  room: string,
  name: string,
  role: string,
) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  sockets.push(ws);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  const welcomeP = waitFor(ws, (message) => message.t === "welcome");
  ws.send(JSON.stringify({ t: "hello", room, name, role }));
  const welcome = await welcomeP;
  return { ws, welcome };
}

function waitFor(ws: WebSocket, pred: (message: { t: string; [key: string]: any }) => boolean) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), 8000);
    const onMessage = (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(String(data));
        if (pred(message)) {
          clearTimeout(timer);
          ws.off("message", onMessage);
          resolve(message);
        }
      } catch {
        /* ignore non-json */
      }
    };
    ws.on("message", onMessage);
  });
}

function waitForSnapshot(ws: WebSocket, pred: (snapshot: any) => boolean) {
  return waitFor(ws, (message) => message.t === "snapshot" && pred(message.snapshot)).then(
    (message) => message.snapshot,
  );
}
