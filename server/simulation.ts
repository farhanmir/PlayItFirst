/**
 * Authoritative café simulation — customers, queues, orders, layout throughput.
 * Pattern inspired by Gitzilla's authoritative 30 Hz sim, specialized for PlayFirst.
 */
import { randomUUID } from "node:crypto";
import type {
  CafeLayout,
  Customer,
  CustomerPersona,
  FurnitureItem,
  FurnitureKind,
  Metrics,
  PlayerState,
  PropertyListing,
  RoomSnapshot,
} from "../shared/types.ts";
import { FURNITURE_CATALOG } from "../shared/types.ts";
import { nearestStation } from "../shared/stations.ts";
import { applyTransaction, createFinance } from "./finance.ts";

export { nearestStation };
export type { StationHint } from "../shared/stations.ts";

const AI_PLAYER_ID = "__jamie_ai__";
/** Help when no human interact for this many sim-seconds. */
const AI_IDLE_SEC = 5;
/** Act every N ticks so players still matter (~2s at 20 Hz). */
const AI_PERIOD_TICKS = 40;

const NAMES = ["Ava", "Ben", "Chris", "Dana", "Eli", "Faye", "Gus", "Hana", "Ivan", "Jade", "Kai", "Lina"];
const ORDERS = ["latte", "americano", "cappuccino", "cold brew", "mocha", "espresso"];
const COLORS = ["#c45c26", "#2f6f5e", "#3d5a80", "#b08968", "#7c3a2d", "#4a6741"];

export function createRoomSnapshot(code: string, startingBudget = 20_000): RoomSnapshot {
  return {
    code,
    phase: "lobby",
    businessType: "cafe",
    property: null,
    layout: null,
    startingBudget,
    players: [],
    customers: [],
    finance: createFinance(startingBudget),
    metrics: emptyMetrics(),
    inventory: { milk: 24, cups: 40, beans: 30 },
    director: null,
    photon: [],
    tick: 0,
    simTime: 0,
    open: false,
    eventLog: ["Room created. Choose a property to begin."],
    rushBoost: 0,
    menuReduced: false,
    lastHumanInteractAt: 0,
    aiBarista: { holding: null },
  };
}

function emptyMetrics(): Metrics {
  return {
    customersServed: 0,
    customersLost: 0,
    avgWaitSec: 0,
    satisfaction: 78,
    revenuePerHour: 0,
    queueLength: 0,
  };
}

export function addPlayer(snapshot: RoomSnapshot, id: string, name: string, role: PlayerState["role"]): RoomSnapshot {
  if (snapshot.players.some((p) => p.id === id)) return snapshot;
  const color = COLORS[snapshot.players.length % COLORS.length];
  const player: PlayerState = {
    id,
    name,
    role,
    x: 2 + snapshot.players.length * 1.2,
    z: 2,
    holding: null,
    score: 0,
    color,
  };
  return {
    ...snapshot,
    players: [...snapshot.players, player],
    eventLog: [`${name} joined as ${role}`, ...snapshot.eventLog].slice(0, 30),
  };
}

export function selectProperty(snapshot: RoomSnapshot, property: PropertyListing): RoomSnapshot {
  const starter: FurnitureItem[] = [
    { id: randomUUID(), kind: "counter", label: "Service Counter", x: 2, z: 4, rotation: 0, cost: 450 },
    { id: randomUUID(), kind: "coffee_machine", label: "Espresso Machine", x: 1, z: 5.5, rotation: 0, cost: 1800, throughput: 2 },
    { id: randomUUID(), kind: "pickup", label: "Pickup Station", x: Math.min(6.5, property.width - 1.5), z: 5.2, rotation: 0, cost: 300 },
    { id: randomUUID(), kind: "table", label: "Café Table", x: Math.min(8, property.width - 2), z: 3, rotation: 0, cost: 220, seats: 2 },
    { id: randomUUID(), kind: "table", label: "Café Table", x: Math.min(10, property.width - 1.5), z: Math.min(6, property.depth - 2), rotation: 0, cost: 220, seats: 2 },
    { id: randomUUID(), kind: "chair", label: "Chair", x: Math.min(7.2, property.width - 2.5), z: 3, rotation: 0, cost: 80, seats: 1 },
    { id: randomUUID(), kind: "chair", label: "Chair", x: Math.min(8.8, property.width - 1.2), z: 3, rotation: 0, cost: 80, seats: 1 },
    { id: randomUUID(), kind: "decoration", label: "Plant / Decor", x: Math.min(property.width - 1, 12), z: 1.2, rotation: 0, cost: 60 },
    { id: randomUUID(), kind: "fridge", label: "Reach-in Fridge", x: 0.8, z: Math.min(7.5, property.depth - 1), rotation: 0, cost: 900 },
  ];
  const spent = starter.reduce((s, f) => s + f.cost, 0);
  let finance = snapshot.finance;
  finance = applyTransaction(finance, "Starter equipment package", -spent, "equipment");
  finance = applyTransaction(finance, `First month rent · ${property.name}`, -property.monthlyRent, "rent");

  const layout: CafeLayout = {
    propertyId: property.id,
    furniture: starter,
    budgetSpent: spent,
  };

  return {
    ...snapshot,
    property,
    layout,
    phase: "build",
    finance,
    eventLog: [
      `Selected ${property.name} (${property.city}). Build mode unlocked.`,
      ...snapshot.eventLog,
    ].slice(0, 30),
  };
}

export function placeFurniture(
  snapshot: RoomSnapshot,
  kind: FurnitureKind,
  x: number,
  z: number,
  rotation = 0,
): RoomSnapshot {
  if (!snapshot.layout || !snapshot.property) return snapshot;
  const catalog = FURNITURE_CATALOG.find((c) => c.kind === kind);
  if (!catalog) return snapshot;
  if (snapshot.finance.balance < catalog.cost) return snapshot;

  const item: FurnitureItem = {
    id: randomUUID(),
    kind,
    label: catalog.label,
    x: clamp(x, 0.5, snapshot.property.width - 0.5),
    z: clamp(z, 0.5, snapshot.property.depth - 0.5),
    rotation,
    cost: catalog.cost,
    seats: catalog.seats,
    throughput: catalog.throughput,
  };

  const layout = {
    ...snapshot.layout,
    furniture: [...snapshot.layout.furniture, item],
    budgetSpent: snapshot.layout.budgetSpent + catalog.cost,
  };

  return {
    ...snapshot,
    layout,
    finance: applyTransaction(snapshot.finance, catalog.label, -catalog.cost, "equipment"),
    eventLog: [`Placed ${catalog.label}`, ...snapshot.eventLog].slice(0, 30),
  };
}

export function moveFurniture(snapshot: RoomSnapshot, id: string, x: number, z: number, rotation?: number): RoomSnapshot {
  if (!snapshot.layout || !snapshot.property) return snapshot;
  const furniture = snapshot.layout.furniture.map((f) =>
    f.id === id
      ? {
          ...f,
          x: clamp(x, 0.5, snapshot.property!.width - 0.5),
          z: clamp(z, 0.5, snapshot.property!.depth - 0.5),
          rotation: rotation ?? f.rotation,
        }
      : f,
  );
  return { ...snapshot, layout: { ...snapshot.layout, furniture } };
}

export function removeFurniture(snapshot: RoomSnapshot, id: string): RoomSnapshot {
  if (!snapshot.layout) return snapshot;
  const item = snapshot.layout.furniture.find((f) => f.id === id);
  if (!item) return snapshot;
  const refund = Math.round(item.cost * 0.6);
  return {
    ...snapshot,
    layout: {
      ...snapshot.layout,
      furniture: snapshot.layout.furniture.filter((f) => f.id !== id),
      budgetSpent: Math.max(0, snapshot.layout.budgetSpent - item.cost),
    },
    finance: applyTransaction(snapshot.finance, `Sold ${item.label}`, refund, "equipment"),
  };
}

/** Physical tabletop → virtual layout. Markers replace matching kinds in-place. */
export function syncTabletop(
  snapshot: RoomSnapshot,
  markers: { kind: FurnitureKind; x: number; z: number; rotation?: number }[],
): RoomSnapshot {
  if (!snapshot.layout || !snapshot.property) return snapshot;
  let next = snapshot;
  for (const marker of markers) {
    const existing = next.layout?.furniture.find((f) => f.kind === marker.kind);
    if (existing) {
      next = moveFurniture(next, existing.id, marker.x, marker.z, marker.rotation);
    } else {
      next = placeFurniture(next, marker.kind, marker.x, marker.z, marker.rotation ?? 0);
    }
  }
  return {
    ...next,
    eventLog: ["Tabletop layout synced into the café", ...next.eventLog].slice(0, 30),
  };
}

export function movePlayer(snapshot: RoomSnapshot, playerId: string, x: number, z: number): RoomSnapshot {
  if (!snapshot.property) return snapshot;
  return {
    ...snapshot,
    players: snapshot.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            x: clamp(x, 0.3, snapshot.property!.width - 0.3),
            z: clamp(z, 0.3, snapshot.property!.depth - 0.3),
          }
        : p,
    ),
  };
}

export function openCafe(snapshot: RoomSnapshot): RoomSnapshot {
  if (!snapshot.property || !snapshot.layout) return snapshot;
  return {
    ...snapshot,
    phase: "play",
    open: true,
    eventLog: ["Doors open. Customers incoming.", ...snapshot.eventLog].slice(0, 30),
  };
}

/** Brew time (sim seconds) before a drink becomes holdable. */
const BREW_SEC = 1.6;

function parseBrewing(holding?: string | null): { order: string; started: number } | null {
  if (!holding?.startsWith("brewing:")) return null;
  const rest = holding.slice("brewing:".length);
  const at = rest.lastIndexOf("@");
  if (at < 0) return { order: rest, started: 0 };
  return { order: rest.slice(0, at), started: Number(rest.slice(at + 1)) || 0 };
}

function stationOk(
  snapshot: RoomSnapshot,
  playerId: string,
  action: "take_order" | "make_coffee" | "serve" | "restock" | "collect",
): boolean {
  if (action === "collect") return true;
  const station = nearestStation(snapshot, playerId);
  if (action === "take_order") return station === "counter";
  if (action === "make_coffee") return station === "machine";
  if (action === "serve") return station === "pickup" || station === "counter";
  if (action === "restock") return station === "fridge";
  return true;
}

export function interact(
  snapshot: RoomSnapshot,
  playerId: string,
  action: "take_order" | "make_coffee" | "serve" | "restock" | "collect",
  opts?: { ai?: boolean },
): RoomSnapshot {
  const player = snapshot.players.find((p) => p.id === playerId);
  if (!player) return snapshot;
  let customers = [...snapshot.customers];
  let finance = snapshot.finance;
  let metrics = { ...snapshot.metrics };
  let players = [...snapshot.players];
  let inventory = { ...(snapshot.inventory ?? { milk: 24, cups: 40, beans: 30 }) };
  const log = [...snapshot.eventLog];
  const needsMilk = (order?: string) => order === "latte" || order === "cappuccino" || order === "mocha";

  if (!opts?.ai && !stationOk(snapshot, playerId, action)) {
    const hint =
      action === "take_order"
        ? "Walk to the counter"
        : action === "make_coffee"
          ? "Walk to the espresso machine"
          : action === "serve"
            ? "Walk to pickup (or counter)"
            : action === "restock"
              ? "Walk to the fridge"
              : "Get closer to the station";
    log.unshift(`${player.name} — ${hint}`);
    return {
      ...snapshot,
      eventLog: log.slice(0, 30),
      lastHumanInteractAt: snapshot.simTime,
    };
  }

  if (action === "take_order") {
    const target = customers.find((c) => c.state === "queue" || c.state === "ordering");
    if (target) {
      const menu = snapshot.menuReduced ? ["americano", "espresso"] : ORDERS;
      const preference =
        target.preference && menu.includes(target.preference)
          ? target.preference
          : menu[Math.floor(Math.random() * menu.length)];
      customers = customers.map((c) =>
        c.id === target.id
          ? { ...c, state: "waiting", order: preference, progress: 0.12, ticketHolder: playerId }
          : c,
      );
      players = players.map((p) =>
        p.id === playerId ? { ...p, holding: `ticket:${preference}`, score: p.score + 1 } : p,
      );
      log.unshift(`${player.name} took a ${preference} order for ${target.name}`);
    }
  }

  if (action === "make_coffee") {
    const brewing = parseBrewing(player.holding);
    if (brewing) {
      // Manual finish if brew completed (or AI finish)
      if (opts?.ai || snapshot.simTime - brewing.started >= BREW_SEC * 0.5) {
        players = players.map((p) =>
          p.id === playerId ? { ...p, holding: `drink:${brewing.order}`, score: p.score + 2 } : p,
        );
        customers = customers.map((c) =>
          c.state === "waiting" && (c.ticketHolder === playerId || c.order === brewing.order)
            ? { ...c, progress: Math.min(1, c.progress + 0.45) }
            : c,
        );
        log.unshift(`${player.name} finished a ${brewing.order}`);
      } else {
        log.unshift(`${player.name} — still brewing ${brewing.order}…`);
      }
    } else {
      if (inventory.beans <= 0 || inventory.cups <= 0) {
        log.unshift(`${player.name} can’t brew — out of beans or cups`);
        return {
          ...snapshot,
          inventory,
          eventLog: log.slice(0, 30),
          lastHumanInteractAt: opts?.ai ? snapshot.lastHumanInteractAt : snapshot.simTime,
        };
      }
      const ticketOrder = player.holding?.startsWith("ticket:") ? player.holding.slice(7) : undefined;
      const waiting =
        customers.find((c) => c.state === "waiting" && c.ticketHolder === playerId) ||
        customers.find((c) => c.state === "waiting");
      const order = ticketOrder || waiting?.order || "espresso";
      if (needsMilk(order) && inventory.milk <= 0) {
        log.unshift(`${player.name} needs milk for a ${order}`);
        return {
          ...snapshot,
          inventory,
          eventLog: log.slice(0, 30),
          lastHumanInteractAt: opts?.ai ? snapshot.lastHumanInteractAt : snapshot.simTime,
        };
      }
      inventory.beans -= 1;
      inventory.cups -= 1;
      if (needsMilk(order)) inventory.milk -= 1;
      // AI completes instantly so assist stays snappy; humans get a short brew timer
      if (opts?.ai) {
        players = players.map((p) =>
          p.id === playerId ? { ...p, holding: `drink:${order}`, score: p.score + 2 } : p,
        );
        customers = customers.map((c) =>
          c.state === "waiting" ? { ...c, progress: Math.min(1, c.progress + 0.45) } : c,
        );
        log.unshift(`${player.name} brewed a ${order}`);
      } else {
        players = players.map((p) =>
          p.id === playerId ? { ...p, holding: `brewing:${order}@${snapshot.simTime}` } : p,
        );
        log.unshift(`${player.name} started brewing a ${order}`);
      }
    }
  }

  if (action === "serve") {
    const holdingDrink = player.holding?.startsWith("drink:");
    const drinkOrder = holdingDrink ? player.holding!.slice(6) : undefined;
    const ready =
      customers.find(
        (c) =>
          c.state === "waiting" &&
          holdingDrink &&
          (c.ticketHolder === playerId || c.order === drinkOrder) &&
          (c.progress >= 0.4 || holdingDrink),
      ) ||
      customers.find((c) => c.state === "waiting" && (c.progress >= 0.45 || holdingDrink));
    if (ready) {
      const tip = ready.persona === "office" ? 4 : ready.persona === "regular" ? 3 : 1;
      const matchBonus = holdingDrink && player.holding === `drink:${ready.order}` ? 1.5 : 0;
      const price = 4.5 + tip + matchBonus;
      finance = applyTransaction(finance, `${ready.order ?? "coffee"} · ${ready.name}`, price, "sales");
      metrics.customersServed += 1;
      metrics.satisfaction = Math.min(100, metrics.satisfaction + (matchBonus ? 4 : 2));
      metrics.revenuePerHour = Math.round(
        (metrics.customersServed / Math.max(1, snapshot.simTime / 3600)) * price,
      );
      customers = customers.map((c) =>
        c.id === ready.id
          ? { ...c, state: "happy", progress: 1, satisfaction: 92, ticketHolder: undefined }
          : c,
      );
      players = players.map((p) => (p.id === playerId ? { ...p, holding: null, score: p.score + 5 } : p));
      log.unshift(`${player.name} served ${ready.name}`);
    }
  }

  if (action === "restock") {
    finance = applyTransaction(finance, "Milk & cups restock", -35, "inventory");
    inventory = {
      milk: inventory.milk + 12,
      cups: inventory.cups + 20,
      beans: inventory.beans + 15,
    };
    metrics.satisfaction = Math.min(100, metrics.satisfaction + 1);
    log.unshift(`${player.name} restocked supplies (−$35)`);
  }

  if (action === "collect") {
    finance = applyTransaction(finance, "Register sweep", 12, "sales");
    log.unshift(`${player.name} collected payments`);
  }

  return {
    ...snapshot,
    customers,
    finance,
    metrics,
    inventory,
    players,
    eventLog: log.slice(0, 30),
    lastHumanInteractAt: opts?.ai ? snapshot.lastHumanInteractAt : snapshot.simTime,
  };
}

/** Complete finished brews on the sim clock. */
export function advanceBrewing(snapshot: RoomSnapshot): RoomSnapshot {
  let changed = false;
  const players = snapshot.players.map((p) => {
    const brewing = parseBrewing(p.holding);
    if (!brewing) return p;
    if (snapshot.simTime - brewing.started < BREW_SEC) return p;
    changed = true;
    return { ...p, holding: `drink:${brewing.order}`, score: p.score + 2 };
  });
  if (!changed) return snapshot;
  const finished = players.filter((p, i) => p.holding !== snapshot.players[i]?.holding);
  const log = [...snapshot.eventLog];
  for (const p of finished) {
    const order = p.holding?.startsWith("drink:") ? p.holding.slice(6) : "drink";
    log.unshift(`${p.name} finished brewing a ${order}`);
  }
  return { ...snapshot, players, eventLog: log.slice(0, 30) };
}

/** NPC barista — one action per call; keeps holding across ticks. */
export function runAiBaristaAssist(snapshot: RoomSnapshot): RoomSnapshot {
  const holding = snapshot.aiBarista?.holding ?? null;
  const hasQueue = snapshot.customers.some((c) => c.state === "queue" || c.state === "ordering");
  const hasWaiting = snapshot.customers.some((c) => c.state === "waiting");

  let action: "take_order" | "make_coffee" | "serve" | null = null;
  if (holding?.startsWith("drink:") && hasWaiting) action = "serve";
  else if (holding?.startsWith("ticket:")) action = "make_coffee";
  else if (hasQueue) action = "take_order";
  else if (hasWaiting && !holding) action = "make_coffee";
  else if (holding?.startsWith("drink:")) action = "serve";
  else return snapshot;

  const jamie: PlayerState = {
    id: AI_PLAYER_ID,
    name: "Jamie (AI)",
    role: "barista",
    x: 0,
    z: 0,
    holding,
    score: 0,
    color: "#6b7280",
  };

  const withJamie = { ...snapshot, players: [...snapshot.players, jamie] };
  const after = interact(withJamie, AI_PLAYER_ID, action, { ai: true });
  const jamieAfter = after.players.find((p) => p.id === AI_PLAYER_ID);

  return {
    ...after,
    players: after.players.filter((p) => p.id !== AI_PLAYER_ID),
    aiBarista: { holding: jamieAfter?.holding ?? null },
  };
}

export function stepSimulation(snapshot: RoomSnapshot, dt: number): RoomSnapshot {
  if (!snapshot.open || !snapshot.property || !snapshot.layout) {
    return advanceBrewing({
      ...snapshot,
      tick: snapshot.tick + 1,
      simTime: snapshot.simTime + dt,
    });
  }

  const property = snapshot.property;
  const layout = snapshot.layout;

  snapshot = advanceBrewing({
    ...snapshot,
    tick: snapshot.tick + 1,
    simTime: snapshot.simTime + dt,
  });

  const machines = layout.furniture.filter((f) => f.kind === "coffee_machine").length;
  const throughput = Math.max(1, machines);
  const seats = layout.furniture.reduce((s, f) => s + (f.seats ?? 0), 0);
  const counter = layout.furniture.find((f) => f.kind === "counter");
  const pickup = layout.furniture.find((f) => f.kind === "pickup");
  const queueAnchor = counter ?? { x: 2, z: 3 };

  let customers = [...snapshot.customers];
  let metrics = { ...snapshot.metrics };
  let finance = snapshot.finance;
  const log = [...snapshot.eventLog];

  const plants = layout.furniture.filter((f) => f.kind === "decoration").length;
  const ambience = Math.min(8, plants * 1.5);

  // Spawn based on foot traffic + capacity pressure (tuned for playable demo pacing)
  const openSlots = Math.max(0, Math.min(10, property.capacity) - customers.length);
  const rush = snapshot.rushBoost ?? 0;
  const spawnChance = property.footTraffic * (0.1 + rush * 0.06) * dt;
  if (openSlots > 0 && Math.random() < spawnChance) {
    customers.push(spawnCustomer(property, queueAnchor.x, queueAnchor.z));
  }

  // Rush boost from unresolved director events (keep dramatic but not unmanageable)
  if (snapshot.director && !snapshot.director.resolved && snapshot.director.title.includes("rush")) {
    if (openSlots > 0 && Math.random() < 0.12 * dt) customers.push(spawnCustomer(property, queueAnchor.x, queueAnchor.z));
  }

  const queue: Customer[] = [];
  customers = customers.map((c, index) => {
    let next = { ...c };
    // Softer drain — office still impatient, but demo rushes stay recoverable
    const baseDrain = c.persona === "office" ? 6.5 : c.persona === "student" ? 2.6 : 4.2;
    const rushEase = rush > 0.4 ? 0.85 : 1;
    next.patience -= dt * Math.max(1.2, (baseDrain - ambience * 0.2) * rushEase);
    const brewRate = snapshot.menuReduced ? 0.14 : 0.1;
    next.progress = Math.min(1, next.progress + dt * brewRate * throughput);

    if (next.state === "entering") {
      next.x += (next.targetX - next.x) * Math.min(1, dt * 2);
      next.z += (next.targetZ - next.z) * Math.min(1, dt * 2);
      if (Math.hypot(next.x - next.targetX, next.z - next.targetZ) < 0.2) next.state = "queue";
    }

    if (next.state === "queue" || next.state === "ordering") {
      queue.push(next);
      const slot = queue.length - 1;
      next.targetX = queueAnchor.x + 0.2;
      next.targetZ = Math.max(0.8, queueAnchor.z - 1.2 - slot * 0.7);
      next.x += (next.targetX - next.x) * Math.min(1, dt * 3);
      next.z += (next.targetZ - next.z) * Math.min(1, dt * 3);
      if (slot === 0 && next.state === "queue") next.state = "ordering";
    }

    if (next.state === "waiting") {
      const dest = pickup ?? queueAnchor;
      next.targetX = dest.x + 0.8;
      next.targetZ = dest.z;
      next.x += (next.targetX - next.x) * Math.min(1, dt * 2);
      next.z += (next.targetZ - next.z) * Math.min(1, dt * 2);
      // AI auto-serve assist when players are idle
      if (next.progress >= 1 && Math.random() < 0.22 * dt * throughput) {
        const price = next.persona === "office" ? 7.5 : next.persona === "regular" ? 6.25 : 4.75;
        finance = applyTransaction(finance, `${next.order ?? "coffee"} · ${next.name}`, price, "sales");
        metrics.customersServed += 1;
        metrics.satisfaction = Math.min(100, metrics.satisfaction + 2.2);
        next.state = "happy";
        next.progress = 1;
      }
    }

    if (next.patience <= 0 && next.state !== "happy" && next.state !== "leaving" && next.state !== "angry") {
      next.state = "angry";
      metrics.customersLost += 1;
      metrics.satisfaction = Math.max(28, metrics.satisfaction - 2.5);
      log.unshift(`${next.name} left — wait too long`);
    }

    if (next.state === "happy" || next.state === "angry") {
      next.state = next.state === "happy" ? "leaving" : "leaving";
      next.targetX = property.width + 1;
      next.targetZ = 1;
    }

    if (next.state === "leaving") {
      next.x += (next.targetX - next.x) * Math.min(1, dt * 2);
      next.z += (next.targetZ - next.z) * Math.min(1, dt * 2);
    }

    // Light seating use
    if (next.state === "waiting" && seats > 0 && index % 3 === 0) {
      const table = layout.furniture.find((f) => f.kind === "table");
      if (table) {
        next.targetX = table.x;
        next.targetZ = table.z;
      }
    }

    return next;
  });

  customers = customers.filter((c) => !(c.state === "leaving" && c.x > property.width + 0.5));

  const queueLength = customers.filter((c) => c.state === "queue" || c.state === "ordering").length;
  const waiting = customers.filter((c) => c.state === "waiting" || c.state === "ordering");
  const avgWait =
    waiting.length === 0
      ? metrics.avgWaitSec * 0.95
      : waiting.reduce((s, c) => s + (Date.now() - c.joinedAt) / 1000, 0) / waiting.length;

  // Overlap penalty: counter and pickup too close near entrance
  if (counter && pickup) {
    const dist = Math.hypot(counter.x - pickup.x, counter.z - pickup.z);
    if (dist < 1.5 && queueLength > 2) {
      metrics.satisfaction = Math.max(30, metrics.satisfaction - dt * 1.2);
    }
  }

  metrics.queueLength = queueLength;
  metrics.avgWaitSec = Math.round(avgWait * 10) / 10;
  metrics.revenuePerHour = Math.round(finance.revenue / Math.max(0.05, snapshot.simTime / 3600));
  if (ambience > 0 && metrics.satisfaction < 94) {
    metrics.satisfaction = Math.min(94, metrics.satisfaction + dt * 0.22 * ambience);
  }
  // Soft floor during early open / active rush so the pitch stays upbeat
  if (snapshot.simTime < 90 || rush > 0.35) {
    metrics.satisfaction = Math.max(55, metrics.satisfaction);
  }
  // Decay residual rush boost
  const rushBoost = Math.max(0, (snapshot.rushBoost ?? 0) - dt * 0.05);

  // Wage drip (~every ~15s at 20 Hz)
  if (snapshot.tick > 0 && snapshot.tick % 300 === 0 && snapshot.players.length) {
    const wages = snapshot.players.length * 8;
    finance = applyTransaction(finance, "Staff wages", -wages, "wages");
  }

  let next: RoomSnapshot = {
    ...snapshot,
    customers,
    finance,
    metrics,
    rushBoost,
    eventLog: log.slice(0, 30),
  };

  // Jamie (AI) barista: help on long queues or when humans go idle — paced so players still matter
  const humanIdle = next.simTime - (next.lastHumanInteractAt ?? 0) >= AI_IDLE_SEC;
  const needsHelp = queueLength >= 3 || humanIdle;
  const period = queueLength >= 5 || rush > 0.5 ? Math.floor(AI_PERIOD_TICKS / 2) : AI_PERIOD_TICKS;
  if (needsHelp && next.tick % period === 0) {
    next = runAiBaristaAssist(next);
  }

  return next;
}

/** Seed a visible queue for judge demo — deterministic enough for live pitches. */
export function seedDemoCrowd(snapshot: RoomSnapshot): RoomSnapshot {
  if (!snapshot.property || !snapshot.layout) return snapshot;
  const counter = snapshot.layout.furniture.find((f) => f.kind === "counter") ?? { x: 2, z: 3 };
  const extras: Customer[] = [];
  const states: Customer["state"][] = ["ordering", "queue", "queue", "entering", "entering"];
  for (let i = 0; i < states.length; i++) {
    const c = spawnCustomer(snapshot.property, counter.x, counter.z);
    c.state = states[i];
    // Generous patience so the judge pitch stays playable under the rush
    c.patience = 280;
    c.x = counter.x + 0.2;
    c.z = Math.max(0.8, counter.z - 1.2 - i * 0.7);
    c.targetX = c.x;
    c.targetZ = c.z;
    if (states[i] === "ordering" || states[i] === "queue") {
      c.progress = states[i] === "ordering" ? 0.15 : 0;
    }
    extras.push(c);
  }
  return {
    ...snapshot,
    customers: [...snapshot.customers, ...extras].slice(0, 12),
    metrics: {
      ...snapshot.metrics,
      queueLength: snapshot.metrics.queueLength + 3,
    },
  };
}

function spawnCustomer(property: PropertyListing, qx: number, qz: number): Customer {
  const personas: CustomerPersona[] = ["student", "office", "regular"];
  const persona = personas[Math.floor(Math.random() * personas.length)];
  const budgets = { student: 6, office: 14, regular: 10 };
  const patience = { student: 120, office: 70, regular: 95 };
  return {
    id: randomUUID(),
    persona,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    budget: budgets[persona],
    patience: patience[persona],
    preference: ORDERS[Math.floor(Math.random() * ORDERS.length)],
    state: "entering",
    progress: 0,
    x: -1,
    z: 1 + Math.random() * 2,
    targetX: qx,
    targetZ: Math.max(1, qz - 1),
    satisfaction: 70,
    joinedAt: Date.now(),
  };
}

export function buildBlueprint(snapshot: RoomSnapshot): string {
  const p = snapshot.property;
  const layout = snapshot.layout;
  const m = snapshot.metrics;
  const f = snapshot.finance;
  if (!p || !layout) return "# Blueprint unavailable\n\nSelect a property and build first.";

  const equipment = layout.furniture
    .map((item) => `- ${item.label} @ (${item.x.toFixed(1)}, ${item.z.toFixed(1)}) — $${item.cost}`)
    .join("\n");

  const sourceLabel =
    p.source === "costar-live"
      ? "CoStar live feed (verify with broker)"
      : p.source === "local"
        ? "Local fixture listing"
        : "CoStar-shaped mock listing (set COSTAR_API_URL for live)";

  return `# PlayFirst Business Launch Blueprint

Generated from your gameplay at **${p.name}**

## Data provenance
- **Property source:** ${sourceLabel}
- **Listing id:** ${p.costarId}
- **Gameplay assumptions:** starting capital, menu prices, spawn rates, and wages are simulated — not market forecasts.
- **Matterport:** floorplate notes + optional showcase embed; playable room is a reconstruction from listing dimensions.

## Selected commercial property
- **Listing:** ${p.name} (${p.costarId})
- **Address:** ${p.address}
- **Size:** ${p.sqft} sqft · capacity ${p.capacity}
- **Monthly rent:** $${p.monthlyRent.toLocaleString()} ${p.source === "costar-live" ? "(from listing)" : "(fixture / assumption)"}
- **Matterport notes:** ${p.matterportHint}

## Customized floor plan & equipment
${equipment}

**Budget spent on build-out (simulated):** $${layout.budgetSpent.toLocaleString()}

## Estimated startup budget & operating expenses
- Starting capital *(gameplay assumption)*: $${snapshot.startingBudget.toLocaleString()}
- Current simulated balance: $${Math.round(f.balance).toLocaleString()}
- Simulated revenue *(session)*: $${Math.round(f.revenue).toLocaleString()}
- Simulated expenses *(session)*: $${Math.round(f.expenses).toLocaleString()}

## Staffing & operational plan
- Roles observed: ${snapshot.players.map((pl) => `${pl.name} (${pl.role})`).join(", ") || "Owner-operated"}
- Customers served (session): ${m.customersServed}
- Customers lost: ${m.customersLost}
- Avg wait: ${m.avgWaitSec}s · Satisfaction: ${Math.round(m.satisfaction)}%

## Accessibility & layout considerations
- Entrance queue should not block the door — keep ordering and pickup separated.
- Leave at least one clear circulation lane (~3 ft) between stations.
- Verify ADA counter height and aisle widths with a licensed designer before build-out.

## Scenario results & lessons
${snapshot.eventLog
  .slice(0, 8)
  .map((e) => `- ${e}`)
  .join("\n")}

## Next steps for a real launch
1. Validate this CoStar listing with a broker and tour the Matterport / in-person space.
2. Get contractor bids against the equipment list above.
3. Run a soft-open staffing plan from your PlayFirst roles.
4. Confirm permits, health codes, and insurance for ${p.city}.

> **Disclaimer:** PlayFirst is an educational simulation. A real launch still needs professional validation — market research, permits, insurance, contractor bids, and real financial planning. This blueprint is a starting conversation, not advice.
`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
