/** Shared contracts for Play It First client + authoritative server. */
import type { ManagerView } from "./manager";
import type { MeasuredFloorPlan } from "./floorplan";

export type BusinessType = "cafe" | "restaurant" | "gaming_cafe" | "bookstore" | "retail" | "gym";
export type PlayerRole = "owner" | "barista" | "cashier" | "manager" | "customer" | "builder";
export type GamePhase = "lobby" | "build" | "play" | "blueprint";
export type FurnitureKind =
  | "counter"
  | "coffee_machine"
  | "table"
  | "chair"
  | "fridge"
  | "decoration"
  | "pickup";

export interface Vec2 {
  x: number;
  z: number;
}

export interface PropertyListing {
  id: string;
  name: string;
  city: "Houston" | "Los Angeles";
  neighborhood: string;
  address: string;
  sqft: number;
  monthlyRent: number;
  width: number;
  depth: number;
  capacity: number;
  footTraffic: number;
  matterportHint: string;
  costarId: string;
  imageTone: string;
  description: string;
  /** Matterport model id for showcase / Model API */
  matterportModelId?: string;
  matterportEmbedUrl?: string;
  /** costar-live when COSTAR_API_URL answered; otherwise mock */
  source?: "costar-live" | "costar-extract" | "costar-mock" | "local";
  provenance?: {
    listingId: string; spaceId: string; suite: string; askingRate: number; rateBasis: "USD/sqft/year" | "USD/sqft/month";
    geometry: string; scanAreaM2?: number; assumptions: string[];
  };
  liveFetchedAt?: number;
  floorPlan?: MeasuredFloorPlan;
}

export interface FurnitureItem {
  id: string;
  kind: FurnitureKind;
  label: string;
  x: number;
  z: number;
  rotation: number;
  cost: number;
  /** Capacity / throughput modifiers */
  seats?: number;
  throughput?: number;
}

export interface CatalogItem {
  kind: FurnitureKind;
  label: string;
  cost: number;
  seats?: number;
  throughput?: number;
  description: string;
}

export type CustomerPersona = "student" | "office" | "regular";

export interface Customer {
  route?: Vec2[];
  routeGoal?: Vec2;
  routeVersion?: string;
  id: string;
  persona: CustomerPersona;
  name: string;
  budget: number;
  patience: number;
  preference: string;
  state: "entering" | "queue" | "ordering" | "waiting" | "leaving" | "happy" | "angry";
  order?: string;
  /** Player who took the ticket — prefer this barista for brew/serve matching */
  ticketHolder?: string;
  progress: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  satisfaction: number;
  joinedAt: number;
  /** Sim-seconds spent queueing, ordering, or waiting. Drives avgWaitSec. */
  waitSec?: number;
}

export interface PlayerState {
  id: string;
  name: string;
  role: PlayerRole;
  x: number;
  z: number;
  holding?: string | null;
  score: number;
  color: string;
}

export interface Transaction {
  id: string;
  label: string;
  amount: number;
  category: "sales" | "equipment" | "wages" | "rent" | "inventory" | "other";
  at: number;
}

export interface NessieSync {
  status: "provisioning" | "ready" | "unknown";
  openingCents: number;
  accountId?: string;
  error?: string;
  overflow?: boolean;
  remoteBalanceCents?: number;
  differenceCents?: number;
  checkedAt?: number;
  records: { localId: string; amountCents: number; status: "queued" | "pending" | "confirmed" | "failed" | "unknown"; remoteId?: string }[];
}

export interface FinanceState {
  balance: number;
  revenue: number;
  expenses: number;
  transactions: Transaction[];
  nessieAccountId: string;
  nessieSync?: NessieSync;
}

export interface DirectorEvent {
  id: string;
  title: string;
  body: string;
  choices: { id: string; label: string }[];
  severity: "info" | "warn" | "critical";
  createdAt: number;
  expiresAt: number;
  resolved?: string;
}

export interface PhotonMessage {
  id: string;
  from: string;
  role: string;
  body: string;
  at: number;
  actionable?: boolean;
}

export interface Metrics {
  customersServed: number;
  customersLost: number;
  avgWaitSec: number;
  satisfaction: number;
  revenuePerHour: number;
  queueLength: number;
}

export interface InventoryState {
  milk: number;
  cups: number;
  beans: number;
}

export interface CafeLayout {
  propertyId: string;
  furniture: FurnitureItem[];
  budgetSpent: number;
}

export interface RoomSnapshot {
  manager?: ManagerView;
  code: string;
  phase: GamePhase;
  businessType: BusinessType;
  property: PropertyListing | null;
  layout: CafeLayout | null;
  startingBudget: number;
  players: PlayerState[];
  customers: Customer[];
  finance: FinanceState;
  metrics: Metrics;
  inventory: InventoryState;
  director: DirectorEvent | null;
  photon: PhotonMessage[];
  tick: number;
  simTime: number;
  open: boolean;
  eventLog: string[];
  /** Soft difficulty modifier from director choices */
  rushBoost?: number;
  menuReduced?: boolean;
  /** simTime of last human interact — AI barista helps when stale or queue is long */
  lastHumanInteractAt?: number;
  /** NPC barista helper holding state (Jamie AI) */
  aiBarista?: { holding: string | null };
}

export type ClientMsg =
  | { t: "manager_request"; prompt: string }
  | { t: "manager_approve"; proposalId: string }
  | { t: "manager_decline"; proposalId: string }
  | { t: "hello"; room: string; name: string; role?: PlayerRole; resume?: string }
  | { t: "select_property"; propertyId: string }
  | { t: "set_phase"; phase: GamePhase }
  | { t: "place_furniture"; kind: FurnitureKind; x: number; z: number; rotation?: number }
  | { t: "move_furniture"; id: string; x: number; z: number; rotation?: number }
  | { t: "remove_furniture"; id: string }
  | { t: "tabletop_sync"; markers: { kind: FurnitureKind; x: number; z: number; rotation?: number }[] }
  | { t: "player_move"; x: number; z: number }
  | { t: "interact"; action: "take_order" | "make_coffee" | "serve" | "restock" | "collect" }
  | { t: "open_cafe" }
  | { t: "director_choice"; eventId: string; choiceId: string }
  | { t: "photon_reply"; body: string }
  | { t: "request_blueprint" }
  /** Judge-demo: seed rush customers + director event + Photon ping */
  | { t: "demo_boost" }
  /** Photon Voice WebRTC signaling (relayed peer-to-peer) */
  | { t: "voice_signal"; to?: string; kind: "offer" | "answer" | "ice" | "hangup"; sdp?: string; candidate?: string };

export type ServerMsg =
  | { t: "manager_error"; message: string }
  | { t: "welcome"; token: string; you: string; snapshot: RoomSnapshot }
  | { t: "snapshot"; snapshot: RoomSnapshot }
  | { t: "qr"; svg: string; url: string }
  | { t: "blueprint"; markdown: string }
  | { t: "error"; message: string }
  | { t: "photon_ping"; message: PhotonMessage }
  | {
      t: "voice_signal";
      from: string;
      fromName: string;
      kind: "offer" | "answer" | "ice" | "hangup";
      sdp?: string;
      candidate?: string;
    };

export const FURNITURE_CATALOG: CatalogItem[] = [
  {
    kind: "counter",
    label: "Service Counter",
    cost: 450,
    description: "Where orders are taken. Placement shapes the queue path.",
  },
  {
    kind: "coffee_machine",
    label: "Espresso Machine",
    cost: 1800,
    throughput: 2,
    description: "Adds drink production capacity.",
  },
  {
    kind: "table",
    label: "Café Table",
    cost: 220,
    seats: 2,
    description: "Increases seating; too many block circulation.",
  },
  {
    kind: "chair",
    label: "Chair",
    cost: 80,
    seats: 1,
    description: "Pairs with tables for seating capacity.",
  },
  {
    kind: "fridge",
    label: "Reach-in Fridge",
    cost: 900,
    description: "Inventory buffer for milk and perishables.",
  },
  {
    kind: "pickup",
    label: "Pickup Station",
    cost: 300,
    description: "Separates ordering from pickup to reduce entrance bottlenecks.",
  },
  {
    kind: "decoration",
    label: "Plant / Decor",
    cost: 60,
    description: "Boosts ambience and regular satisfaction.",
  },
];
