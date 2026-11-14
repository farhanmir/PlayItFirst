import { randomUUID } from "node:crypto";
import type { RoomSnapshot } from "../shared/types.ts";
import type { ManagerAction, ManagerProposal, ManagerView } from "../shared/manager.ts";
import { adjustStaffing, getCafeState, reorderSupplies } from "./deepagents.ts";
import { createManagerRunner, managerModelConfigured, type ManagerRunner, type ManagerTools } from "./manager-runtime.ts";

/** Identity must come from an authenticated WS session or a verified provider pairing. */
export interface ManagerActor { roomCode: string; memberId: string }
export interface ManagerRoom {
  read(): RoomSnapshot;
  update(reducer: (current: RoomSnapshot) => RoomSnapshot): void;
  publish(view: ManagerView): void;
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
        width: p.width, depth: p.depth, coordinateUnit: "simulation units; not verified survey measurements", areaSqft: p.sqft,
        monthlyRentUSD: p.monthlyRent, capacity: p.capacity,
        provenance: p.source === "costar-live" ? "Live listing feed; scan pairing and geometry still require independent verification" : "Bundled mock listing and stand-in scan; not a verified matched property" } : null,
      stations: s.layout?.furniture.map(({ id, kind, x, z }) => ({ id, kind, x, z })) ?? [],
      ledger: s.finance.transactions.slice(0, 6).map(({ id, label, amount, category }) => ({ id, label, amount, category })),
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
    const configured = (this.options.configured ?? managerModelConfigured)();
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
        this.view.summary = await Promise.race([(this.options.runner ?? createManagerRunner())({ prompt, history: this.history, approvedId, tools, signal: controller.signal }), timeout]);
        guard();
        this.view.providerVerified = this.view.trace.at(-1) !== traceStart;
      } else {
        this.localPlan(actor, prompt, tools, approvedId);
      }
      this.history = [...this.history, `Owner: ${prompt}`, `Jamie: ${this.view.summary}`].slice(-6);
    } catch {
      // Provider error text may contain credentials/URLs. Never broadcast it.
      this.view.summary = "Manager run failed or timed out. Check recorded receipts before retrying; completed actions are not rolled back.";
      this.trace("run_failed", "Provider unavailable or run limit reached; no automatic retry.");
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
    this.view.summary = `Local rules (no model call): $${state.finance.balance.toFixed(2)} available, ${state.metrics.queueLength} in line, milk ${state.inventory.milk}. Review any proposed actions below. Nothing has been purchased.`;
  }
}
