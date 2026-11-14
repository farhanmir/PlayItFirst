/**
 * Authoritative multiplayer rooms — adapted from Gitzilla's RoomServer pattern
 * (WebSocket hello/resume, snapshot broadcast, tick loop) for PlayFirst cafés.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import type {
  ClientMsg,
  FurnitureKind,
  PlayerRole,
  RoomSnapshot,
  ServerMsg,
} from "../shared/types.ts";
import type { PropertyListing } from "../shared/types.ts";
import { qrSvg } from "./qr.ts";
import { applyDirectorChoice, forceDemoRushEvent, maybeSpawnDirectorEvent } from "./director.ts";
import { provisionNessieAccount } from "./finance.ts";
import { getCachedProperties, loadProperties } from "./costar.ts";
import { withMatterportDefaults } from "./matterport.ts";
import { deepagentsConfigured, planDirectorEvent } from "./deepagents.ts";
import {
  addPlayer,
  buildBlueprint,
  createRoomSnapshot,
  interact,
  moveFurniture,
  movePlayer,
  openCafe,
  placeFurniture,
  removeFurniture,
  selectProperty,
  seedDemoCrowd,
  stepSimulation,
  syncTabletop,
} from "./simulation.ts";

interface Member {
  id: string;
  token: string;
  name: string;
  role: PlayerRole;
  socket: WebSocket | null;
}

interface Room {
  code: string;
  snapshot: RoomSnapshot;
  members: Map<string, Member>;
  stepTimer?: ReturnType<typeof setInterval>;
  snapshotTimer?: ReturnType<typeof setInterval>;
  directorTimer?: ReturnType<typeof setInterval>;
}

const TICK_HZ = 20;
const SNAPSHOT_HZ = 10;

function listings(): PropertyListing[] {
  return withMatterportDefaults(getCachedProperties().listings);
}

function send(ws: WebSocket | null, message: ServerMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function roomCode() {
  return randomBytes(3).toString("hex");
}

export class CafeRoomServer {
  private rooms = new Map<string, Room>();
  private sessions = new WeakMap<WebSocket, { room: Room; member: Member }>();

  constructor(private wss: WebSocketServer) {
    wss.on("connection", (socket, request) => this.onConnection(socket, request));
  }

  listProperties() {
    return listings();
  }

  async refreshProperties() {
    await loadProperties(true);
    return listings();
  }

  createRoom(): { code: string; snapshot: RoomSnapshot } {
    const code = roomCode();
    const room: Room = {
      code,
      snapshot: createRoomSnapshot(code),
      members: new Map(),
    };
    this.rooms.set(code, room);
    this.startLoops(room);
    return { code, snapshot: room.snapshot };
  }

  getRoom(code: string) {
    return this.rooms.get(code);
  }

  joinUrl(base: string, code: string) {
    return `${base}/?room=${code}`;
  }

  private onConnection(socket: WebSocket, _request: IncomingMessage) {
    socket.on("message", (bytes) => {
      void this.handle(socket, bytes).catch((error) => {
        send(socket, { t: "error", message: error instanceof Error ? error.message : "Request failed" });
      });
    });
    socket.on("close", () => this.disconnect(socket));
    socket.on("error", () => this.disconnect(socket));
  }

  private async handle(socket: WebSocket, bytes: RawData) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof bytes === "string" ? bytes : bytes.toString("utf8"));
    } catch {
      return;
    }

    if (msg.t === "hello") {
      await this.hello(socket, msg);
      return;
    }

    const session = this.sessions.get(socket);
    if (!session) {
      send(socket, { t: "error", message: "Send hello first" });
      return;
    }
    const { room, member } = session;

    switch (msg.t) {
      case "select_property": {
        const property = listings().find((p) => p.id === msg.propertyId);
        if (!property) {
          send(socket, { t: "error", message: "Unknown property" });
          return;
        }
        room.snapshot = selectProperty(room.snapshot, property);
        void provisionNessieAccount(`${member.name} Café`).then((id) => {
          if (id) {
            room.snapshot = {
              ...room.snapshot,
              finance: { ...room.snapshot.finance, nessieAccountId: id },
            };
            this.broadcast(room);
          }
        });
        this.broadcast(room);
        break;
      }
      case "set_phase":
        room.snapshot = { ...room.snapshot, phase: msg.phase };
        this.broadcast(room);
        break;
      case "place_furniture":
        room.snapshot = placeFurniture(room.snapshot, msg.kind, msg.x, msg.z, msg.rotation ?? 0);
        this.broadcast(room);
        break;
      case "move_furniture":
        room.snapshot = moveFurniture(room.snapshot, msg.id, msg.x, msg.z, msg.rotation);
        this.broadcast(room);
        break;
      case "remove_furniture":
        room.snapshot = removeFurniture(room.snapshot, msg.id);
        this.broadcast(room);
        break;
      case "tabletop_sync": {
        const before = room.snapshot.layout?.furniture.map((f) => `${f.kind}:${f.x.toFixed(1)},${f.z.toFixed(1)}`).join("|");
        room.snapshot = syncTabletop(room.snapshot, msg.markers);
        const after = room.snapshot.layout?.furniture.map((f) => `${f.kind}:${f.x.toFixed(1)},${f.z.toFixed(1)}`).join("|");
        const moved = before !== after;
        const lastPhoton = room.snapshot.photon[0];
        const recentlyNoted = lastPhoton?.body.includes("rerouting") && Date.now() - lastPhoton.at < 4000;
        if (moved && !recentlyNoted) {
          room.snapshot = {
            ...room.snapshot,
            photon: [
              {
                id: randomUUID(),
                from: "Jamie",
                role: "Café Manager",
                body: "layout just changed live — customers are rerouting around the new counter path.",
                at: Date.now(),
              },
              ...room.snapshot.photon,
            ].slice(0, 20),
          };
        }
        this.broadcast(room);
        break;
      }
      case "player_move":
        room.snapshot = movePlayer(room.snapshot, member.id, msg.x, msg.z);
        break;
      case "interact":
        room.snapshot = interact(room.snapshot, member.id, msg.action);
        this.broadcast(room);
        break;
      case "open_cafe":
        room.snapshot = openCafe(room.snapshot);
        room.snapshot = {
          ...room.snapshot,
          photon: [
            {
              id: randomUUID(),
              from: "Jamie",
              role: "Café Manager",
              body: "doors are open. i'll ping you if the queue gets ugly.",
              at: Date.now(),
              actionable: true,
            },
            ...room.snapshot.photon,
          ].slice(0, 20),
        };
        this.broadcast(room);
        break;
      case "director_choice": {
        if (!room.snapshot.director || room.snapshot.director.id !== msg.eventId) return;
        const result = applyDirectorChoice(room.snapshot, msg.choiceId);
        room.snapshot = result.snapshot;
        if (result.photon) {
          const message = {
            id: randomUUID(),
            from: "Jamie",
            role: "Café Manager",
            body: result.photon,
            at: Date.now(),
            actionable: true,
          };
          room.snapshot = {
            ...room.snapshot,
            photon: [message, ...room.snapshot.photon].slice(0, 20),
          };
          for (const m of room.members.values()) send(m.socket, { t: "photon_ping", message });
        }
        this.broadcast(room);
        break;
      }
      case "photon_reply": {
        const lower = msg.body.toLowerCase();
        let reply =
          "got it. i'll keep an eye on the floor and ping you if anything breaks.";
        if (lower.includes("milk") || lower.includes("restock")) {
          room.snapshot = interact(room.snapshot, member.id, "restock");
          reply = "done — milk order placed in the simulated inventory. alex is covering drinks.";
        } else if (lower.includes("alex") || lower.includes("drinks")) {
          reply = "done, alex is on drinks. want me to temporarily stop taking large orders?";
        } else if (lower.includes("stop") || lower.includes("large")) {
          reply = "paused large orders for 5 simulated minutes. queue should breathe.";
          room.snapshot = {
            ...room.snapshot,
            metrics: {
              ...room.snapshot.metrics,
              queueLength: Math.max(0, room.snapshot.metrics.queueLength - 1),
            },
          };
        }
        room.snapshot = {
          ...room.snapshot,
          photon: [
            {
              id: randomUUID(),
              from: member.name,
              role: "Owner",
              body: msg.body,
              at: Date.now(),
            },
            {
              id: randomUUID(),
              from: "Jamie",
              role: "Café Manager",
              body: reply,
              at: Date.now() + 1,
              actionable: true,
            },
            ...room.snapshot.photon,
          ].slice(0, 20),
        };
        this.broadcast(room);
        break;
      }
      case "request_blueprint":
        room.snapshot = { ...room.snapshot, phase: "blueprint" };
        send(socket, { t: "blueprint", markdown: buildBlueprint(room.snapshot) });
        this.broadcast(room);
        break;
      case "demo_boost": {
        if (!room.snapshot.open) room.snapshot = openCafe(room.snapshot);
        room.snapshot = seedDemoCrowd(room.snapshot);
        const rush = forceDemoRushEvent(Date.now());
        const ping = {
          id: randomUUID(),
          from: "Jamie",
          role: "Café Manager",
          body: "judge demo boost — office rush hitting the door. pick a director call.",
          at: Date.now(),
          actionable: true,
        };
        room.snapshot = {
          ...room.snapshot,
          director: rush,
          rushBoost: Math.max(room.snapshot.rushBoost ?? 0, 0.85),
          photon: [ping, ...room.snapshot.photon].slice(0, 20),
          eventLog: ["Judge demo: rush seeded", ...room.snapshot.eventLog].slice(0, 30),
        };
        for (const m of room.members.values()) send(m.socket, { t: "photon_ping", message: ping });
        this.broadcast(room);
        break;
      }
      case "voice_signal": {
        const payload: ServerMsg = {
          t: "voice_signal",
          from: member.id,
          fromName: member.name,
          kind: msg.kind,
          sdp: msg.sdp,
          candidate: msg.candidate,
        };
        if (msg.to) {
          const target = room.members.get(msg.to);
          send(target?.socket ?? null, payload);
        } else {
          for (const m of room.members.values()) {
            if (m.id === member.id) continue;
            send(m.socket, payload);
          }
        }
        break;
      }
    }
  }

  private async hello(
    socket: WebSocket,
    msg: Extract<ClientMsg, { t: "hello" }>,
  ) {
    let room = this.rooms.get(msg.room);
    if (!room) {
      room = {
        code: msg.room,
        snapshot: createRoomSnapshot(msg.room),
        members: new Map(),
      };
      this.rooms.set(msg.room, room);
      this.startLoops(room);
    }

    let member: Member | undefined;
    if (msg.resume) {
      member = [...room.members.values()].find((m) => m.token === msg.resume);
    }

    if (!member) {
      const role: PlayerRole = msg.role ?? (room.members.size === 0 ? "owner" : "barista");
      member = {
        id: randomUUID(),
        token: createHash("sha256").update(randomBytes(16)).digest("hex").slice(0, 24),
        name: msg.name || `Player ${room.members.size + 1}`,
        role,
        socket,
      };
      room.members.set(member.id, member);
      room.snapshot = addPlayer(room.snapshot, member.id, member.name, role);
    } else {
      member.socket = socket;
      member.name = msg.name || member.name;
    }

    this.sessions.set(socket, { room, member });
    send(socket, { t: "welcome", token: member.token, you: member.id, snapshot: room.snapshot });
    this.broadcast(room);
  }

  private disconnect(socket: WebSocket) {
    const session = this.sessions.get(socket);
    if (!session) return;
    session.member.socket = null;
    this.sessions.delete(socket);
  }

  private broadcast(room: Room) {
    const message: ServerMsg = { t: "snapshot", snapshot: room.snapshot };
    for (const member of room.members.values()) send(member.socket, message);
  }

  private startLoops(room: Room) {
    if (room.stepTimer) return;
    room.stepTimer = setInterval(() => {
      room.snapshot = stepSimulation(room.snapshot, 1 / TICK_HZ);
    }, 1000 / TICK_HZ);

    room.snapshotTimer = setInterval(() => {
      if (room.snapshot.phase === "play" || room.snapshot.players.length > 1) {
        this.broadcast(room);
      }
    }, 1000 / SNAPSHOT_HZ);

    room.directorTimer = setInterval(() => {
      void (async () => {
        if (room.snapshot.phase !== "play") return;
        if (room.snapshot.director && !room.snapshot.director.resolved) return;
        const now = Date.now();
        let event = deepagentsConfigured() ? await planDirectorEvent(room.snapshot, now) : null;
        if (!event) event = maybeSpawnDirectorEvent(room.snapshot, now);
        if (!event || event.id === room.snapshot.director?.id) return;
        const hosted = deepagentsConfigured();
        room.snapshot = {
          ...room.snapshot,
          director: event,
          photon: [
            {
              id: randomUUID(),
              from: "Jamie",
              role: "Café Manager",
              body: hosted
                ? `deepagents ping — ${event.title.toLowerCase()}. director panel has your options.`
                : `hey — ${event.title.toLowerCase()}. check the director panel.`,
              at: Date.now(),
              actionable: true,
            },
            ...room.snapshot.photon,
          ].slice(0, 20),
        };
        this.broadcast(room);
      })().catch(() => undefined);
    }, 14000);
  }
}

export function furnitureKinds(): FurnitureKind[] {
  return ["counter", "coffee_machine", "table", "chair", "fridge", "decoration", "pickup"];
}
