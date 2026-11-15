/**
 * Customer minds — each café customer can be driven by its own Grok (xAI) persona.
 *
 * The authoritative simulation keeps ticking with its scripted behaviour. Grok is
 * consulted at a few decision moments (arrive, counter, impatient, exit) plus a
 * periodic "look" where the customer sizes up the café itself (seating, decor,
 * stock, staff, queue and any layout change the players just made), and
 * its answers are applied when they arrive. Any failure, timeout, missing key or
 * malformed reply simply leaves the scripted behaviour in place.
 *
 * Only generic café context (menu, queue, wait time, furniture counts) is sent to the model —
 * never property, sponsor, finance or player data.
 */
import { z } from "zod";
import type { CafeFeedback, CafeLayout, Customer, CustomerPersona, FeedbackTopic, RoomSnapshot } from "../shared/types.ts";
import { applyTransaction } from "./finance.ts";

export type MindMoment = "arrive" | "counter" | "impatient" | "look" | "exit";

/** What a customer can see of the café. Counts only; no property or sponsor data. */
export interface CafeView {
  seats: { free: number; total: number };
  decorations: number;
  coffeeMachines: number;
  staffOnFloor: number;
  waitingForDrinks: number;
  walkoutsThisShift: number;
  outOf: string[];
  overallMood: number;
  /** Layout edits the players made in the last ~30 seconds */
  recentChanges: string[];
}

export const FEEDBACK_TOPICS: readonly FeedbackTopic[] = ["seating", "decor", "queue", "staff", "stock", "layout", "vibe"];

export interface MindContext {
  menu: string[];
  queueLength: number;
  waitSec: number;
  order?: string;
  outcome?: "served" | "walked_out";
  cafe?: CafeView;
}

export interface MindDecision {
  customerId: string;
  moment: MindMoment;
  name?: string;
  persona?: CustomerPersona;
  order?: string;
  /** Seconds added to (or removed from) remaining patience */
  patienceDelta?: number;
  /** Extra tip in dollars, exit moment only */
  tip?: number;
  /** Short in-character speech bubble */
  line?: string;
  /** One-line review, exit moment only */
  review?: string;
  /** How the café made them feel, -2..2 (look and exit) */
  mood?: number;
  /** What they noticed (look and exit) */
  notice?: FeedbackTopic;
}

export type MindCustomer = Pick<Customer, "id" | "name" | "persona" | "preference" | "budget">;

/** Returns the model's raw text reply. */
export type MindCompleter = (system: string, user: string, signal: AbortSignal) => Promise<string>;

export const DEFAULT_XAI_MODEL = "grok-4.20-non-reasoning";
export const XAI_BASE_URL = "https://api.x.ai/v1";

export function customerMindsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.XAI_API_KEY?.trim()) && env.CUSTOMER_MINDS !== "off";
}

export function grokCompleter(opts: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): MindCompleter {
  const doFetch = opts.fetchImpl ?? fetch;
  const model = opts.model?.trim() || DEFAULT_XAI_MODEL;
  const url = `${(opts.baseUrl ?? XAI_BASE_URL).replace(/\/$/, "")}/chat/completions`;
  return async (system, user, signal) => {
    const res = await doFetch(url, {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        max_tokens: 160,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`xAI request failed with HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("xAI reply had no message content");
    return text;
  };
}

const SYSTEM = [
  "You play one customer in a cozy café simulation game. Stay in character, be brief and family friendly.",
  "Reply with a single JSON object only, no prose. Unknown fields are ignored.",
  'Fields: "line" (string, at most 12 words, what you say out loud).',
  'On "arrive" also give "name" (a fresh, distinctive first name from any culture; avoid defaults like Alex), "persona" ("student" | "office" | "regular") and "order" (exactly one item from the menu).',
  'On "counter" you may change "order" (must be on the menu).',
  'On "impatient" give "patienceDelta" (integer -30..30 seconds: negative if you are fed up, positive if you will wait).',
  'On "look" you are glancing around the café. React honestly to ONE thing that matters to you right now, using only facts in "cafe": free seats, number of decorations, staff on the floor, items out of stock, the queue and walkouts, or recentChanges the owners just made (react to those first if present). Never invent details that are not in "cafe". Be a real customer: a long wait, no seats, no staff or missing stock should annoy you; a slow day with nothing new is just neutral. Do not repeat anything in "youAlreadySaid".',
  'For "look" give "notice" (one of seating | decor | queue | staff | stock | layout | vibe), "mood" (integer -2..2) and "patienceDelta" (integer -15..5). Say what you noticed in "line".',
  'On "exit" give "tip" (0..5 dollars, 0 if you walked out), "review" (at most 15 words, mention something about the café itself), "notice" and "mood".',
].join("\n");

export function mindPrompt(customer: MindCustomer, moment: MindMoment, ctx: MindContext, memory: string[] = []): string {
  return JSON.stringify({
    moment,
    ...(memory.length ? { youAlreadySaid: memory } : {}),
    ...(moment === "arrive" ? { varietySeed: Math.floor(Math.random() * 10_000) } : {}),
    you: { name: customer.name, persona: customer.persona, budget: customer.budget, usualOrder: customer.preference },
    cafe: { menu: ctx.menu, queueLength: ctx.queueLength, ...(ctx.cafe ?? {}) },
    yourWaitSeconds: Math.round(ctx.waitSec),
    ...(ctx.order ? { yourOrder: ctx.order } : {}),
    ...(ctx.outcome ? { outcome: ctx.outcome } : {}),
  });
}

const raw = z
  .object({
    name: z.string().optional(),
    persona: z.string().optional(),
    order: z.string().optional(),
    patienceDelta: z.number().optional(),
    tip: z.number().optional(),
    line: z.string().optional(),
    review: z.string().optional(),
    mood: z.number().optional(),
    notice: z.string().optional(),
  })
  .passthrough();

const PERSONAS: CustomerPersona[] = ["student", "office", "regular"];

function clip(text: string | undefined, max: number): string | undefined {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Validate and clamp a model reply. Returns null when nothing usable came back. */
export function parseDecision(customerId: string, moment: MindMoment, text: string, menu: string[]): MindDecision | null {
  const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!jsonText) return null;
  let parsed: z.infer<typeof raw>;
  try {
    parsed = raw.parse(JSON.parse(jsonText));
  } catch {
    return null;
  }
  const decision: MindDecision = { customerId, moment };
  const line = clip(parsed.line, 80);
  if (line) decision.line = line;
  if (moment === "arrive") {
    const name = parsed.name?.trim().match(/^[\p{L}][\p{L}' -]{0,15}/u)?.[0]?.trim();
    if (name) decision.name = name;
    const persona = parsed.persona?.toLowerCase() as CustomerPersona | undefined;
    if (persona && PERSONAS.includes(persona)) decision.persona = persona;
  }
  if ((moment === "arrive" || moment === "counter") && parsed.order) {
    const order = parsed.order.trim().toLowerCase();
    if (menu.includes(order)) decision.order = order;
  }
  if (moment === "impatient" && Number.isFinite(parsed.patienceDelta)) {
    decision.patienceDelta = Math.round(Math.max(-30, Math.min(30, parsed.patienceDelta!)));
  }
  if (moment === "look" && Number.isFinite(parsed.patienceDelta)) {
    decision.patienceDelta = Math.round(Math.max(-15, Math.min(5, parsed.patienceDelta!)));
  }
  if (moment === "look" || moment === "exit") {
    if (Number.isFinite(parsed.mood)) decision.mood = Math.round(Math.max(-2, Math.min(2, parsed.mood!)));
    const notice = parsed.notice?.trim().toLowerCase() as FeedbackTopic | undefined;
    if (notice && FEEDBACK_TOPICS.includes(notice)) decision.notice = notice;
  }
  if (moment === "exit") {
    if (Number.isFinite(parsed.tip)) decision.tip = Math.round(Math.max(0, Math.min(5, parsed.tip!)) * 100) / 100;
    const review = clip(parsed.review, 100);
    if (review) decision.review = review;
  }
  return Object.keys(decision).length > 2 ? decision : null;
}

export interface MindStats {
  asked: number;
  answered: number;
  failed: number;
  skipped: number;
}

export interface MindLogEntry {
  at: number;
  customerId: string;
  moment: MindMoment;
  ok: boolean;
  ms: number;
  decision?: MindDecision;
  error?: string;
}

/**
 * Per-room pool of customer minds. `ask` starts a background request; finished
 * decisions are collected with `drain` from the simulation loop.
 */
export class CustomerMinds {
  private readonly complete: MindCompleter;
  private readonly maxInFlight: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private inFlight = 0;
  private readonly asked = new Set<string>();
  private ready: MindDecision[] = [];
  /** What each customer has already said, so they stay consistent and do not repeat. */
  private readonly memory = new Map<string, string[]>();
  private readonly controllers = new Set<AbortController>();
  readonly log: MindLogEntry[] = [];
  readonly stats: MindStats = { asked: 0, answered: 0, failed: 0, skipped: 0 };

  constructor(opts: { complete: MindCompleter; maxInFlight?: number; timeoutMs?: number; now?: () => number }) {
    this.complete = opts.complete;
    this.maxInFlight = opts.maxInFlight ?? 3;
    this.timeoutMs = opts.timeoutMs ?? 6_000;
    this.now = opts.now ?? Date.now;
  }

  /**
   * Returns the pending request, or null when skipped (busy, or this moment was already asked).
   * `round` lets a repeating moment such as "look" be asked more than once.
   */
  ask(customer: MindCustomer, moment: MindMoment, ctx: MindContext, round?: number): Promise<void> | null {
    const key = `${customer.id}:${moment}${round == null ? "" : `:${round}`}`;
    if (this.asked.has(key) || this.inFlight >= this.maxInFlight) {
      this.stats.skipped += 1;
      return null;
    }
    this.asked.add(key);
    this.inFlight += 1;
    this.stats.asked += 1;
    const started = this.now();
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    return this.complete(SYSTEM, mindPrompt(customer, moment, ctx, this.memory.get(customer.id)), controller.signal)
      .then((text) => {
        const decision = parseDecision(customer.id, moment, text, ctx.menu);
        if (!decision) throw new Error("unusable reply");
        if (decision.line) this.memory.set(customer.id, [...(this.memory.get(customer.id) ?? []), decision.line].slice(-4));
        this.ready.push(decision);
        this.stats.answered += 1;
        this.record({ at: started, customerId: customer.id, moment, ok: true, ms: this.now() - started, decision });
      })
      .catch((err: unknown) => {
        this.stats.failed += 1;
        const error = controller.signal.aborted ? "timeout" : err instanceof Error ? err.message : "error";
        this.record({ at: started, customerId: customer.id, moment, ok: false, ms: this.now() - started, error });
      })
      .finally(() => {
        clearTimeout(timer);
        this.controllers.delete(controller);
        this.inFlight -= 1;
      });
  }

  /** Take every decision that has arrived since the last drain. */
  drain(): MindDecision[] {
    const out = this.ready;
    this.ready = [];
    return out;
  }

  /** Forget a customer who has left so the dedupe set does not grow forever. */
  forget(customerId: string): void {
    for (const key of this.asked) if (key.startsWith(`${customerId}:`)) this.asked.delete(key);
    this.memory.delete(customerId);
  }

  /** Abort outstanding requests (room closed). */
  close(): void {
    for (const c of this.controllers) c.abort();
  }

  private record(entry: MindLogEntry) {
    this.log.push(entry);
    if (this.log.length > 200) this.log.shift();
  }
}

/** Build a pool from the environment, or null when Grok minds are not configured. */
export function createCustomerMindsFromEnv(env: NodeJS.ProcessEnv = process.env): CustomerMinds | null {
  if (!customerMindsConfigured(env)) return null;
  return new CustomerMinds({
    complete: grokCompleter({ apiKey: env.XAI_API_KEY!.trim(), model: env.XAI_MODEL }),
    maxInFlight: Number(env.CUSTOMER_MINDS_MAX_IN_FLIGHT) || 3,
  });
}

// ---------------------------------------------------------------------------
// Simulation glue: detect decision moments between ticks and apply answers.
// ---------------------------------------------------------------------------

const MENU = ["latte", "americano", "cappuccino", "cold brew", "mocha", "espresso"];
const REDUCED_MENU = ["americano", "espresso"];
/** Ask an "impatient" question once remaining patience drops below this. */
export const IMPATIENT_AT = 30;
/** Seconds of sim time a speech bubble stays up. */
export const SAY_SECONDS = 6;
/** Satisfaction the simulation assigns to a served customer. */
const SERVED_SATISFACTION = 90;

export interface MindRequest {
  customer: MindCustomer;
  moment: MindMoment;
  ctx: MindContext;
  /** For repeating moments ("look") */
  round?: number;
}

/** Sim seconds between a waiting customer's looks around the café. */
export const LOOK_EVERY = 15;
/** Sim seconds a layout edit stays "recent" for customers. */
export const CHANGE_MEMORY = 30;
/** Customers who react straight away to a layout edit. */
const REACT_TO_CHANGE = 3;

export interface LayoutChange {
  at: number;
  text: string;
}

const KIND_NAMES: Record<string, string> = {
  counter: "counter", coffee_machine: "coffee machine", table: "table", chair: "chair",
  fridge: "fridge", decoration: "plant or decoration", pickup: "pickup shelf",
};

/** Describe what the players changed between two layouts, in plain words. */
export function describeLayoutChanges(prev: CafeLayout | null | undefined, next: CafeLayout | null | undefined): string[] {
  if (!prev || !next || prev === next) return [];
  const before = new Map(prev.furniture.map((f) => [f.id, f]));
  const after = new Map(next.furniture.map((f) => [f.id, f]));
  const out: string[] = [];
  for (const f of next.furniture) {
    const was = before.get(f.id);
    const name = KIND_NAMES[f.kind] ?? f.kind;
    if (!was) out.push(`added a ${name}`);
    else if (Math.hypot(was.x - f.x, was.z - f.z) > 0.3 || was.rotation !== f.rotation) out.push(`moved the ${name}`);
  }
  for (const f of prev.furniture) if (!after.has(f.id)) out.push(`removed a ${KIND_NAMES[f.kind] ?? f.kind}`);
  return [...new Set(out)].slice(0, 4);
}

/** Build what customers can see of the café right now. */
export function cafeView(snapshot: RoomSnapshot, changes: LayoutChange[] = []): CafeView {
  const furniture = snapshot.layout?.furniture ?? [];
  const totalSeats = furniture.filter((f) => f.kind === "table").reduce((n, f) => n + (f.seats ?? 0), 0)
    + furniture.filter((f) => f.kind === "chair").length;
  const waiting = snapshot.customers.filter((c) => c.state === "waiting").length;
  const staffRoles = new Set(["owner", "manager", "barista", "cashier"]);
  const staff = snapshot.players.filter((p) => p.connected !== false && staffRoles.has(p.role)).length + (snapshot.aiBarista ? 1 : 0);
  const outOf = (Object.entries(snapshot.inventory) as [string, number][]).filter(([, n]) => n <= 0).map(([k]) => k);
  return {
    seats: { free: Math.max(0, totalSeats - Math.ceil(waiting / 3)), total: totalSeats },
    decorations: furniture.filter((f) => f.kind === "decoration").length,
    coffeeMachines: furniture.filter((f) => f.kind === "coffee_machine").length,
    staffOnFloor: staff,
    waitingForDrinks: waiting,
    walkoutsThisShift: snapshot.metrics.customersLost,
    outOf,
    overallMood: Math.round(snapshot.metrics.satisfaction),
    recentChanges: changes.filter((c) => snapshot.simTime - c.at <= CHANGE_MEMORY).map((c) => c.text),
  };
}

/** Per-customer look schedule, kept by the room across ticks. */
export type LookSchedule = Map<string, { next: number; round: number }>;

/**
 * Customers due to look around the café. Each active customer looks shortly after
 * joining the line and then every LOOK_EVERY seconds; a fresh layout edit pulls the
 * next look forward for a few of them so they react to it.
 */
export function dueLooks(snapshot: RoomSnapshot, schedule: LookSchedule, cafe: CafeView, layoutJustChanged = false): MindRequest[] {
  const now = snapshot.simTime;
  const menu = menuFor(snapshot);
  const queueLength = snapshot.customers.filter((c) => c.state === "queue" || c.state === "ordering").length;
  const active = snapshot.customers.filter((c) => ACTIVE.includes(c.state));
  if (layoutJustChanged) {
    for (const c of active.slice(0, REACT_TO_CHANGE)) {
      const slot = schedule.get(c.id);
      if (slot) slot.next = Math.min(slot.next, now);
      else schedule.set(c.id, { next: now, round: 0 });
    }
  }
  const out: MindRequest[] = [];
  for (const c of active) {
    const slot = schedule.get(c.id) ?? { next: now + 2, round: 0 };
    schedule.set(c.id, slot);
    if (now < slot.next) continue;
    out.push({
      customer: c, moment: "look", round: slot.round,
      ctx: { menu, queueLength, waitSec: c.waitSec ?? 0, ...(c.order ? { order: c.order } : {}), cafe },
    });
    slot.round += 1;
    slot.next = now + LOOK_EVERY;
  }
  return out;
}

export function menuFor(snapshot: RoomSnapshot): string[] {
  return snapshot.menuReduced ? REDUCED_MENU : MENU;
}

const ACTIVE: Customer["state"][] = ["queue", "ordering", "waiting"];

/**
 * Compare two consecutive snapshots and list the moments worth asking Grok about.
 * Pass `seen` (kept across ticks) so customers added outside the step loop, such
 * as a director rush, still count as arrivals.
 */
export function detectMindMoments(prev: RoomSnapshot, next: RoomSnapshot, seen?: Set<string>, cafe?: CafeView): MindRequest[] {
  const menu = menuFor(next);
  const before = new Map(prev.customers.map((c) => [c.id, c]));
  const queueLength = next.customers.filter((c) => c.state === "queue" || c.state === "ordering").length;
  const out: MindRequest[] = [];
  for (const c of next.customers) {
    const was = before.get(c.id);
    const ctx = (extra: Partial<MindContext> = {}): MindContext => ({
      menu, queueLength, waitSec: c.waitSec ?? 0, ...(c.order ? { order: c.order } : {}), ...(cafe ? { cafe } : {}), ...extra,
    });
    const isNew = seen ? !seen.has(c.id) : !was;
    if (isNew) {
      seen?.add(c.id);
      out.push({ customer: c, moment: "arrive", ctx: ctx() });
      continue;
    }
    if (!was) continue;
    if (c.state === "ordering" && was.state !== "ordering") out.push({ customer: c, moment: "counter", ctx: ctx() });
    if (ACTIVE.includes(c.state) && c.patience < IMPATIENT_AT && was.patience >= IMPATIENT_AT) {
      out.push({ customer: c, moment: "impatient", ctx: ctx() });
    }
    if (c.state === "leaving" && was.state !== "leaving") {
      const served = was.state === "happy" || c.satisfaction >= SERVED_SATISFACTION;
      out.push({ customer: c, moment: "exit", ctx: ctx({ outcome: served ? "served" : "walked_out" }) });
    }
  }
  return out;
}

/** Customers who left the room since the previous snapshot. */
export function departedCustomers(prev: RoomSnapshot, next: RoomSnapshot): string[] {
  const now = new Set(next.customers.map((c) => c.id));
  return prev.customers.filter((c) => !now.has(c.id)).map((c) => c.id);
}

/**
 * Apply Grok decisions to the authoritative snapshot and expire old speech bubbles.
 * Every change stays inside the game's own rules: orders must be on the menu and not
 * yet ticketed, patience stays positive, and tips only follow a real served sale.
 * `servedIds` lists customers the simulation actually served (they may already have left).
 */
export function applyMindDecisions(snapshot: RoomSnapshot, decisions: MindDecision[], servedIds: ReadonlySet<string> = new Set()): RoomSnapshot {
  const now = snapshot.simTime;
  let changed = false;
  let customers = snapshot.customers.map((c) => {
    if (c.say && (c.sayUntil ?? 0) <= now) {
      changed = true;
      return { ...c, say: undefined, sayUntil: undefined };
    }
    return c;
  });
  if (!decisions.length) return changed ? { ...snapshot, customers } : snapshot;

  let finance = snapshot.finance;
  let reviews = snapshot.reviews ?? [];
  let feedback: CafeFeedback = snapshot.feedback ?? {};
  let satisfaction = snapshot.metrics.satisfaction;
  const log = [...snapshot.eventLog];
  const menu = menuFor(snapshot);

  for (const d of decisions) {
    const idx = customers.findIndex((c) => c.id === d.customerId);
    const current = idx >= 0 ? customers[idx] : undefined;
    if (d.moment === "exit") {
      const name = current?.name ?? d.name ?? "A customer";
      const served = servedIds.has(d.customerId) || (current?.satisfaction ?? 0) >= SERVED_SATISFACTION;
      const tip = served && d.tip && d.tip > 0 ? d.tip : undefined;
      if (tip) {
        finance = applyTransaction(finance, `tip · ${name}`, tip, "sales");
        log.unshift(`${name} tipped $${tip.toFixed(2)}`);
      }
      if (d.review) {
        reviews = [{ name, text: d.review, tip, outcome: served ? "served" as const : "walked_out" as const, at: Date.now() }, ...reviews].slice(0, 12);
        log.unshift(`${name}: “${d.review}”`);
      }
    }
    if ((d.moment === "look" || d.moment === "exit") && d.notice && d.mood != null && d.mood !== 0) {
      const tally = feedback[d.notice] ?? { liked: 0, disliked: 0 };
      feedback = {
        ...feedback,
        [d.notice]: {
          liked: tally.liked + (d.mood > 0 ? 1 : 0),
          disliked: tally.disliked + (d.mood < 0 ? 1 : 0),
          last: d.moment === "exit" ? d.review ?? d.line ?? tally.last : d.line ?? tally.last,
        },
      };
    }
    if (d.moment === "look" && d.mood && current) satisfaction = Math.max(0, Math.min(100, satisfaction + d.mood * 0.75));
    if (!current) continue;
    const next: Customer = { ...current, mind: "grok" };
    if (d.line) {
      next.say = d.line;
      next.sayUntil = now + SAY_SECONDS;
    }
    if (d.moment === "arrive") {
      if (d.name) next.name = d.name;
      if (d.persona) next.persona = d.persona;
    }
    const stillChoosing = !current.order && (current.state === "entering" || current.state === "queue" || current.state === "ordering");
    if ((d.moment === "arrive" || d.moment === "counter") && d.order && stillChoosing && menu.includes(d.order)) {
      next.preference = d.order;
    }
    if ((d.moment === "impatient" || d.moment === "look") && d.patienceDelta && ACTIVE.includes(current.state)) {
      next.patience = Math.max(1, current.patience + d.patienceDelta);
    }
    customers = customers.map((c, i) => (i === idx ? next : c));
  }
  return {
    ...snapshot, customers, finance, reviews, feedback,
    metrics: satisfaction === snapshot.metrics.satisfaction ? snapshot.metrics : { ...snapshot.metrics, satisfaction },
    eventLog: log.slice(0, 30),
  };
}
