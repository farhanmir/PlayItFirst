import { randomUUID } from "node:crypto";
import type { RoomSnapshot } from "../shared/types.ts";
import type { ManagerAction, ManagerProposal, ManagerView } from "../shared/manager.ts";
import { adjustStaffing, getCafeState, reorderSupplies } from "./deepagents.ts";
import { createManagerRunner, managerModelConfigured, type ManagerRunner, type ManagerTools } from "./manager-runtime.ts";

/** Snapshot evidence only: no provider call, payment, forecast, or reserved funds. */
function financialContext(snapshot: RoomSnapshot, now: number) {
  const finance = snapshot.finance;
  const sync = finance.nessieSync;
  const bills = sync?.bills ?? [];
  const outstanding = bills.filter((bill) => bill.status === "pending" || bill.status === "recurring");
  const billCents = outstanding.reduce((sum, bill) => sum + bill.amountCents, 0);
  const age = sync?.checkedAt == null ? null : Math.max(0, now - sync.checkedAt);
  return {
    currency: "USD",
    monetaryUnit: "US dollars; sandbox integer cents have already been converted. Do not divide these values by 100.",
    local: {
      source: "authoritative simulated game ledger",
      operatingCashUSD: finance.balance,
      revenueUSD: finance.revenue,
      expensesUSD: finance.expenses,
      netCashFlowUSD: finance.revenue - finance.expenses,
      period: `${snapshot.simTime.toFixed(1)} simulated seconds since room creation; includes opening rent/equipment, not a monthly forecast`,
      restockCostUSD: 35,
      canAffordRestock: finance.balance >= 35,
      monthlyBaseRentUSD: snapshot.property?.monthlyRent ?? null,
    },
    sandbox: {
      source: sync ? "Nessie sandbox; mock banking, not real money" : "simulated-only; no Nessie session",
      status: sync?.status ?? "simulated-only",
      fetchedAt: sync?.checkedAt ?? null,
      freshness: age == null ? "not-fetched" : age > 30_000 ? "stale" : "recent",
      ageMs: age,
      balanceUSD: sync?.remoteBalanceCents == null ? null : sync.remoteBalanceCents / 100,
      availableUSD: sync?.remoteAvailableCents == null ? null : sync.remoteAvailableCents / 100,
      differenceFromLocalUSD: sync?.differenceCents == null ? null : sync.differenceCents / 100,
      error: sync?.error ?? null,
      billSetupStatus: sync?.billSetupStatus ?? "not-configured",
      billsFetchedAt: sync?.billsCheckedAt ?? null,
      billsFreshness: sync?.billsCheckedAt == null ? "not-fetched" : now - sync.billsCheckedAt > 30_000 ? "stale" : "recent",
      billError: sync?.billError ?? null,
      bills: bills.map(({ id, payee, amountCents, dueDate, status }) => ({ id, payee, amountUSD: amountCents / 100, dueDate, status })),
      outstandingScheduledBillsUSD: billCents / 100,
      billCoverage: sync?.billsCheckedAt == null ? "No fetched bill list; absence does not mean no obligations" : "Retrieved sandbox bills only; unmodeled expenses may exist",
      localCashAfterRecordedBillsUSD: bills.length ? finance.balance - billCents / 100 : null,
      receipts: sync?.records.map(({ localId, remoteId, amountCents, status }) => ({ localId, remoteId: remoteId ?? null, amountUSD: amountCents / 100, status })) ?? [],
      interpretation: "Queued, pending, failed, unknown and stale records are not confirmed settlement. Local cash controls gameplay approval; remote available funds and upcoming bills inform discussion only. Bills are future obligations, not extra local charges or automatic payments. Do not claim a bank purchase completed without a confirmed matching receipt.",
    },
  };
}

/** Identity must come from an authenticated WS session or a verified provider pairing. */
export interface ManagerActor { roomCode: string; memberId: string }
export interface ManagerRoom {
  read(): RoomSnapshot;
  update(reducer: (current: RoomSnapshot) => RoomSnapshot): void;
  publish(view: ManagerView): void;
}

/** Allowlisted diagnostics only: provider messages/URLs can contain secrets. */
function failureHint(error: unknown, timedOut: boolean): string {
  if (timedOut) return "Manager timed out (deadline reached); no automatic retry.";
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    const e = current as { statusCode?: unknown; status?: unknown; name?: unknown; cause?: unknown };
    const status = e.statusCode ?? e.status;
    if (status === 429) return "Model rate limit or quota reached (HTTP 429); no automatic retry.";
    if (status === 401 || status === 403) return "Model authentication or permission refused (HTTP 401/403).";
    if (status === 404) return "Configured model or endpoint unavailable (HTTP 404).";
    if (status === 400) return "Model rejected the request or tool schema (HTTP 400).";
    if (typeof status === "number" && status >= 500 && status <= 599) return "Model service temporarily unavailable (HTTP 5xx).";
    if (e.name === "NoCandidatesError" || e.name === "MalformedOutputError") return "Model returned no usable response or malformed output.";
    if (e.name === "InvalidToolError" || e.name === "ToolCallNotFoundError" || e.name === "InvalidInputError") return "Model tool-call format was rejected.";
    if (e.name === "AbortError" || e.name === "TimeoutError") return "Model request aborted or timed out.";
    current = e.cause;
  }
  return "Model or tool run failed; no automatic retry.";
}

export class CafeManager {
  private view: ManagerView = { runtime: "local", providerVerified: false, busy: false, summary: "Ask Jamie to inspect the café. Purchases always need owner approval.", proposals: [], trace: [] };
  private history: string[] = [];
  private activeRun: string | null = null;
  private lastRequestAt = -Infinity;

  constructor(private room: ManagerRoom, private options: { runner?: ManagerRunner; configured?: () => boolean; now?: () => number; timeoutMs?: number; cooldownMs?: number } = {}) {}
  private now() { return (this.options.now ?? Date.now)(); }
  getView(): ManagerView { return structuredClone(this.view); }
  private publish() { this.room.publish(this.getView()); }
  private authorize(actor: ManagerActor) {
    const snapshot = this.room.read();
    if (snapshot.code !== actor.roomCode || !snapshot.players.some((p) => p.id === actor.memberId && p.role === "owner")) {
      throw new Error("Only the authenticated owner of this café can direct Jamie");
    }
  }
  private trace(tool: string, detail: string) {
    this.view.trace = [...this.view.trace, { tool, detail: detail.slice(0, 400), at: this.now() }].slice(-20);
  }
  private inspect() {
    const s = this.room.read();
    const p = s.property;
    this.trace("get_cafe_state", `Read tick ${s.tick}: $${s.finance.balance}, ${s.metrics.queueLength} in line`);
    return {
      roomCode: s.code, tick: s.tick, simTime: s.simTime, ...getCafeState(s),
      property: p ? { id: p.id, name: p.name, source: p.source ?? "local", costarId: p.costarId, matterportModelId: p.matterportModelId,
        width: p.width, depth: p.depth, coordinateUnit: p.floorPlan ? "meters; translated Matterport planar coordinates" : "simulation units; not verified survey measurements", areaSqft: p.sqft,
        monthlyRentUSD: p.monthlyRent, capacity: p.capacity,
        measuredLayout: p.floorPlan ? { floorId: p.floorPlan.floorId, roomCount: p.floorPlan.rooms.length, wallCount: p.floorPlan.walls.length,
          entry: p.floorPlan.entry, rooms: p.floorPlan.rooms.map((r) => ({ id: r.id, areaM2: r.areaM2 })) } : null,
        provenance: p.provenance ?? (p.source === "costar-live" ? "Live listing feed; scan pairing and geometry still require independent verification" : "Bundled mock listing and stand-in scan; not a verified matched property") } : null,
      stations: s.layout?.furniture.map(({ id, kind, x, z }) => ({ id, kind, x, z })) ?? [],
      ledger: s.finance.transactions.slice(0, 6).map(({ id, label, amount, category }) => ({ id, label, amount, category })),
      financialContext: financialContext(s, this.now()),
      approvedActionCosts: { reorder_supplies: 35, simplify_menu: 0 },
    };
  }
  private propose(actor: ManagerActor, action: ManagerAction, reason: string) {
    this.authorize(actor);
    if (!["reorder_supplies", "simplify_menu"].includes(action) || typeof reason !== "string" || !reason.trim() || reason.length > 300) throw new Error("Invalid business proposal");
    const existing = this.view.proposals.find((p) => p.action === action && p.requestedBy === actor.memberId && p.status === "pending" && p.expiresAt > this.now());
    if (existing) return structuredClone(existing);
    const proposal: ManagerProposal = { id: randomUUID(), action, reason: reason.trim(), cost: action === "reorder_supplies" ? 35 : 0,
      requestedBy: actor.memberId, expiresAt: this.now() + 120_000, status: "pending" };
    this.view.proposals = [...this.view.proposals, proposal].slice(-10);
    this.trace("propose_action", `${action}: $${proposal.cost}; awaiting owner approval`);
    return structuredClone(proposal);
  }
  private execute(actor: ManagerActor, proposalId: string, approvedId?: string) {
    this.authorize(actor);
    const proposal = this.view.proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.requestedBy !== actor.memberId || approvedId !== proposalId) throw new Error("No owner approval for that proposal");
    if (proposal.status === "executed") return structuredClone(proposal);
    if (proposal.status !== "approved") throw new Error("Proposal is not approved");
    if (proposal.expiresAt <= this.now()) { proposal.status = "expired"; throw new Error("Proposal expired; ask for a fresh plan"); }
    // Synchronous reducer reads the latest tick and commits once. Never write the
    // snapshot that was captured before a model/network await.
    this.room.update((current) => {
      const result = proposal.action === "reorder_supplies" ? reorderSupplies(current) : adjustStaffing(current, "simplify_menu");
      proposal.status = result.ok ? "executed" : "failed";
      proposal.result = result.ok ? (proposal.action === "reorder_supplies" ? "Supplies delivered; $35 recorded in the game ledger." : "Menu simplified; future orders use the reduced menu.") : result.detail;
      if (result.ok && proposal.cost > 0) proposal.transactionId = result.snapshot.finance.transactions[0]?.id;
      return result.snapshot;
    });
    this.trace("execute_approved_action", `${proposal.action}: ${proposal.result}`);
    return structuredClone(proposal);
  }
  private outcome() {
    const current = this.inspect();
    const receipts = this.view.proposals.filter((p) => p.status === "executed" || p.status === "failed").map((p) => structuredClone(p));
    this.trace("read_outcome", `Observed tick ${current.tick}; ${receipts.length} action receipts. No causal improvement inferred.`);
    return { current, receipts };
  }
  async request(actor: ManagerActor, prompt: string): Promise<ManagerView> {
    this.authorize(actor);
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1200) throw new Error("Ask Jamie a question of 1–1200 characters");
    if (this.view.busy || this.now() - this.lastRequestAt < (this.options.cooldownMs ?? 3000)) throw new Error("Jamie is busy; please wait a moment");
    this.lastRequestAt = this.now();
    return this.run(actor, prompt.trim());
  }
  async approve(actor: ManagerActor, proposalId: string): Promise<ManagerView> {
    this.authorize(actor);
    const proposal = this.view.proposals.find((p) => p.id === proposalId && p.requestedBy === actor.memberId);
    if (!proposal) throw new Error("Unknown proposal for this owner and room");
    if (proposal.status === "executed" || proposal.status === "approved") return this.getView();
    if (proposal.status !== "pending") throw new Error("Proposal is no longer pending");
    if (proposal.expiresAt <= this.now()) { proposal.status = "expired"; this.publish(); throw new Error("Proposal expired; ask for a fresh plan"); }
    if (this.view.busy) throw new Error("Jamie is busy; wait before approving");
    proposal.status = "approved";
    return this.run(actor, `The owner approved proposal ${proposalId}. Execute it, inspect the outcome, and explain the result.`, proposalId);
  }
  decline(actor: ManagerActor, proposalId: string): ManagerView {
    this.authorize(actor);
    const proposal = this.view.proposals.find((p) => p.id === proposalId && p.requestedBy === actor.memberId);
    if (!proposal || proposal.status !== "pending") throw new Error("No pending proposal to decline");
    proposal.status = "declined";
    this.publish();
    return this.getView();
  }
  private async run(actor: ManagerActor, prompt: string, approvedId?: string): Promise<ManagerView> {
    const controller = new AbortController();
    const id = randomUUID();
    this.activeRun = id;
    this.view.busy = true;
    // Verification describes this run, never a previous successful provider call.
    this.view.providerVerified = false;
    delete this.view.providerIdentity;
    const modelKeyConfigured = (this.options.configured ?? managerModelConfigured)();
    const source = this.room.read().property?.source;
    const restricted = source === "costar-extract" || source === "costar-live";
    const contextBlocked = restricted && process.env.ALLOW_SPONSOR_MODEL_CONTEXT !== "true";
    const configured = modelKeyConfigured && !contextBlocked;
    if (modelKeyConfigured && contextBlocked) this.trace("model_context_blocked", "Using local rules: external processing of sponsor property context has not been authorized.");
    this.view.runtime = configured ? "deepagents" : "local";
    this.publish();
    const guard = () => {
      controller.signal.throwIfAborted();
      if (this.activeRun !== id) throw new Error("Manager run ended");
      this.authorize(actor);
    };
    const tools: ManagerTools = {
      inspect: () => { guard(); return this.inspect(); },
      propose: (action, reason) => { guard(); return this.propose(actor, action, reason); },
      execute: (proposalId) => { guard(); return this.execute(actor, proposalId, approvedId); },
      outcome: () => { guard(); return this.outcome(); },
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (configured) {
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Manager timed out")); }, this.options.timeoutMs ?? 20_000); });
        const traceStart = this.view.trace.at(-1);
        const result = await Promise.race([(this.options.runner ?? createManagerRunner())({ prompt, history: this.history, approvedId, tools, signal: controller.signal }), timeout]);
        guard();
        this.view.summary = typeof result === "string" ? result : result.summary;
        this.view.providerVerified = this.view.trace.at(-1) !== traceStart;
        if (this.view.providerVerified && typeof result !== "string" && result.providerIdentity) {
          this.view.providerIdentity = result.providerIdentity;
        }
      } else {
        this.localPlan(actor, prompt, tools, approvedId);
      }
      this.history = [...this.history, `Owner: ${prompt}`, `Jamie: ${this.view.summary}`].slice(-6);
    } catch (error) {
      // Provider error text may contain credentials/URLs. Never broadcast it.
      const hint = failureHint(error, controller.signal.aborted);
      this.view.summary = `Manager run failed. ${hint} Check recorded receipts before retrying; completed actions are not rolled back.`;
      this.trace("run_failed", hint);
    } finally {
      controller.abort();
      if (timer) clearTimeout(timer);
      this.activeRun = null;
      this.view.busy = false;
      const pending = this.view.proposals.find((p) => p.id === approvedId && p.status === "approved");
      if (pending) { pending.status = "failed"; pending.result = "No execution receipt. Ask for a new proposal."; }
      this.publish();
    }
    return this.getView();
  }
  private localPlan(actor: ManagerActor, prompt: string, tools: ManagerTools, approvedId?: string) {
    const state = this.room.read();
    tools.inspect();
    if (approvedId) {
      const result = tools.execute(approvedId) as ManagerProposal;
      tools.outcome();
      this.view.summary = `Local rules (no model call): ${result.result} Keep serving to measure any wait-time change.`;
      return;
    }
    if (state.inventory.milk < 4 || state.inventory.beans < 5 || state.inventory.cups < 6 || /milk|suppl|restock|reorder/i.test(prompt)) {
      tools.propose("reorder_supplies", `Stock is milk ${state.inventory.milk}, beans ${state.inventory.beans}, cups ${state.inventory.cups}; delivery costs $35.`);
    }
    if ((state.metrics.queueLength >= 4 || /menu|rush/i.test(prompt)) && !state.menuReduced) {
      tools.propose("simplify_menu", "A reduced menu changes future orders; no wait-time improvement has been measured yet.");
    }
    tools.outcome();
    const finances = financialContext(state, this.now());
    const banking = finances.sandbox;
    const bankNote = banking.availableUSD == null
      ? "Nessie available funds have not been fetched."
      : `Nessie last fetched available funds: $${banking.availableUSD.toFixed(2)} (${banking.freshness}${banking.error ? "; reconciliation error, do not treat as current" : ""}).`;
    const billsNote = banking.bills.length
      ? `Recorded outstanding sandbox bills: $${banking.outstandingScheduledBillsUSD.toFixed(2)} (${banking.billsFreshness}${banking.billError ? "; bill retrieval/setup error" : ""}); local cash after those obligations would be $${banking.localCashAfterRecordedBillsUSD!.toFixed(2)}. This does not reserve or pay them.`
      : "Upcoming sandbox bills are not verified; absence is not proof of no expenses.";
    this.view.summary = `Local rules (no model call): $${state.finance.balance.toFixed(2)} game cash, ${state.metrics.queueLength} in line, milk ${state.inventory.milk}. ${bankNote} ${billsNote} Review proposed actions; nothing has been purchased.`;
  }
}
