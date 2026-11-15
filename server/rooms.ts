/**
 * Authoritative multiplayer rooms — adapted from Gitzilla's RoomServer pattern
 * (WebSocket hello/resume, snapshot broadcast, tick loop) for SoftOpen cafés.
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
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
import { attachNessieAccount, refreshNessie } from "./finance.ts";
import { getCachedProperties, loadProperties } from "./costar.ts";
import { withMatterportDefaults } from "./matterport.ts";
import { CafeManager } from "./manager.ts";
import type { PhoneOwner } from "./phone-bridge.ts";
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
  manager?: CafeManager;
  code: string;
  snapshot: RoomSnapshot;
  members: Map<string, Member>;
  stepTimer?: ReturnType<typeof setInterval>;
  snapshotTimer?: ReturnType<typeof setInterval>;
  directorTimer?: ReturnType<typeof setInterval>;
}

const TICK_HZ = 20;
const SNAPSHOT_HZ = 20;

function listings(): PropertyListing[] {
  return withMatterportDefaults(getCachedProperties().listings);
}

function send(ws: WebSocket | null, message: ServerMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function roomCode() {
  return randomBytes(3).toString("hex");
}

/**
 * Public join origin. Honors a proxy's X-Forwarded-Proto so an HTTPS deployment
 * prints https (and the page then opens wss). Local requests stay http.
 */
export function requestOrigin(
  host: string | string[] | undefined,
  forwardedProto: string | string[] | undefined,
  encrypted = false,
): string {
  const hostname = (Array.isArray(host) ? host[0] : host)?.trim() || "localhost";
  const raw = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim().toLowerCase();
  const proto =
    raw === "https" || raw === "wss" ? "https" : raw === "http" || raw === "ws" ? "http" : encrypted ? "https" : "http";
  return `${proto}://${hostname}`;
}

export class CafeRoomServer {
  private rooms = new Map<string, Room>();
  private bankProvisioned = 0;
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

  /** Owner resume token is a bearer credential; never send it to a phone provider. */
  phoneOwner(code: string, token: string): PhoneOwner {
    const room = this.rooms.get(code);
    const member = room && [...room.members.values()].find(m => m.role === "owner" && m.token === token);
    if (!room || !member || !token || member.socket?.readyState !== WebSocket.OPEN) throw new Error("Authenticated connected owner required.");
    return { actor: { roomCode: code, memberId: member.id }, manager: this.managerFor(room),
      read: () => room.snapshot, active: () => this.rooms.get(code) === room && room.members.get(member.id) === member && member.socket?.readyState === WebSocket.OPEN };
  }

  private attachRoomBank(room: Room) {
    if (!process.env.NESSIE_KEY?.trim() || room.snapshot.finance.nessieSync) return;
    const property = room.snapshot.property;
    if (!property) throw new Error("Select a café property first.");
    if ((property.source === "costar-extract" || property.source === "costar-live") && process.env.ALLOW_SPONSOR_BANK_CONTEXT !== "true")
      throw new Error("Sponsor-property banking context is not authorized. Use a synthetic room.");
    // Global demo budget: cap provisioning attempts, including uncertain writes.
    const limit = 3;
    if (this.bankProvisioned >= limit) throw new Error("This server reached its sandbox account limit.");
    this.bankProvisioned++;
    attachNessieAccount(room.snapshot.finance, () => this.broadcast(room), { monthlyRent: property.monthlyRent });
    this.broadcast(room);
  }

  activateNessie(code: string, token: string, activationCode: string) {
    this.phoneOwner(code, token); // same active-owner authentication, not a phone requirement
    const room = this.rooms.get(code)!;
    const secret = process.env.NESSIE_ACTIVATION_CODE?.trim() || "";
    const a = Buffer.from(activationCode), b = Buffer.from(secret);
    if (secret.length < 32 || a.length !== b.length || !timingSafeEqual(a,b)) throw new Error("Valid sandbox activation code required.");
    if (!process.env.NESSIE_KEY?.trim()) throw new Error("Sandbox key is not configured.");
    this.attachRoomBank(room);
    return { status: room.snapshot.finance.nessieSync?.status || "not-configured" };
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
    if (!session || session.member.socket !== socket) {
      send(socket, { t: "error", message: "Send hello first or reconnect" });
      return;
    }
    const { room, member } = session;

    switch (msg.t) {
      case "manager_request":
      case "manager_approve":
      case "manager_decline":
      case "photon_reply": {
        const manager = this.managerFor(room);
        const actor = { roomCode: room.code, memberId: member.id };
        try {
          if (msg.t === "manager_request" || msg.t === "photon_reply") await manager.request(actor, msg.t === "photon_reply" ? msg.body : msg.prompt);
          else if (msg.t === "manager_approve") await manager.approve(actor, msg.proposalId);
          else manager.decline(actor, msg.proposalId);
        } catch (error) {
          send(socket, { t: "manager_error", message: error instanceof Error ? error.message : "Manager request refused" });
        }
        break;
      }
      case "select_property": {
        if (member.role !== "owner") {
          send(socket, { t: "error", message: "Only the owner can select a property" });
          return;
        }
        // Retransmission or a resumed client's repeated selection must not reset
        // the played ledger or create a second external sandbox account.
        if (room.snapshot.property?.id === msg.propertyId) {
          this.broadcast(room);
          return;
        }
        const property = listings().find((p) => p.id === msg.propertyId);
        if (!property) {
          send(socket, { t: "error", message: "Unknown property" });
          return;
        }
        room.snapshot = selectProperty(room.snapshot, property);
        // Public judges must not create external accounts just by opening a room.
        // Retain automatic attachment for local development only without an activation code.
        if (!process.env.NESSIE_ACTIVATION_CODE && !process.env.RENDER) {
          try { this.attachRoomBank(room); } catch { /* local simulation remains playable */ }
        }
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
      case "player_move": {
        const player = room.snapshot.players.find((p) => p.id === member.id);
        if (msg.seq !== undefined && (!Number.isSafeInteger(msg.seq) || msg.seq <= (player?.moveAck ?? 0))) break;
        room.snapshot = movePlayer(room.snapshot, member.id, msg.x, msg.z);
        // A rejection is acknowledged too, so prediction cannot hide collisions.
        if (msg.seq !== undefined) room.snapshot = {
          ...room.snapshot,
          players: room.snapshot.players.map((p) => p.id === member.id ? { ...p, moveAck: msg.seq } : p),
        };
        break;
      }
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
        if (room.snapshot.director.resolved) return;
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
      case "request_blueprint":
        // Export is private UI state; it must not take the shared floor out of play.
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
      // Claiming "owner" in a hello packet cannot grant purchase authorization.
      const role: PlayerRole = room.members.size === 0 ? "owner" : msg.role === "owner" ? "barista" : msg.role ?? "barista";
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
      const previous = member.socket;
      if (previous && previous !== socket) { this.sessions.delete(previous); previous.close(4001, "Session resumed"); }
      member.socket = socket;
      member.name = msg.name || member.name;
    }

    this.sessions.set(socket, { room, member });
    room.snapshot = { ...room.snapshot, players: room.snapshot.players.map((p) => p.id === member.id ? { ...p, moveAck: p.moveAck ?? 0 } : p) };
    send(socket, { t: "welcome", token: member.token, you: member.id, snapshot: room.snapshot });
    this.broadcast(room);
  }

  private disconnect(socket: WebSocket) {
    const session = this.sessions.get(socket);
    if (!session) return;
    // A resumed connection can already own this member when the old socket closes.
    if (session.member.socket === socket) session.member.socket = null;
    this.sessions.delete(socket);
  }

  private broadcast(room: Room) {
    const message: ServerMsg = { t: "snapshot", snapshot: room.snapshot };
    for (const member of room.members.values()) send(member.socket, message);
  }

  private managerFor(room: Room): CafeManager {
    return room.manager ??= new CafeManager({
      read: () => room.snapshot,
      update: (reducer) => { room.snapshot = reducer(room.snapshot); },
      publish: (manager) => {
        room.snapshot = { ...room.snapshot, manager };
        this.broadcast(room);
      },
    });
  }

  private startLoops(room: Room) {
    if (room.stepTimer) return;
    room.stepTimer = setInterval(() => {
      room.snapshot = stepSimulation(room.snapshot, 1 / TICK_HZ);
      refreshNessie(room.snapshot.finance);
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
        const event = maybeSpawnDirectorEvent(room.snapshot, now);
        if (!event || event.id === room.snapshot.director?.id) return;
        room.snapshot = {
          ...room.snapshot,
          director: event,
          photon: [
            {
              id: randomUUID(),
              from: "Jamie",
              role: "Café Manager",
              body: `hey — ${event.title.toLowerCase()}. check the director panel.`,
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
