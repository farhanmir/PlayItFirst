/** Local authoritative ledger with optional Nessie v2 sandbox mirroring.
 * Contract: https://v2.nessieisreal.com/openapi.json (v2.1.3).
 * Network writes are never retried automatically, including ambiguous failures.
 */
import { randomUUID } from "node:crypto";
import type { FinanceState, Transaction, NessieSync } from "../shared/types.ts";
const BASE = "https://v2-prod-api.nessieisreal.com";
const LIMIT = 40;
const workers = new WeakSet<NessieSync>();
class NessieHttpError extends Error { constructor(readonly status: number) { super(`Nessie HTTP ${status}`); } }

async function request(path: string, body?: object) {
  const response = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.NESSIE_KEY}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new NessieHttpError(response.status);
  return response.json();
}
export function createFinance(startingBalance: number): FinanceState {
  return { balance: startingBalance, revenue: 0, expenses: 0, transactions: [], nessieAccountId: `sim-${randomUUID().slice(0, 8)}` };
}
export function applyTransaction(finance: FinanceState, label: string, amount: number, category: Transaction["category"]): FinanceState {
  const tx: Transaction = { id: randomUUID(), label, amount, category, at: Date.now() };
  const next = { ...finance, balance: finance.balance + amount,
    revenue: finance.revenue + (amount > 0 ? amount : 0),
    expenses: finance.expenses + (amount < 0 ? -amount : 0),
    transactions: [tx, ...finance.transactions].slice(0, 40) };
  const sync = finance.nessieSync;
  if (sync && amount !== 0) {
    if (sync.records.length >= LIMIT) {
      sync.error = "Sandbox sync capacity reached; later transactions remain local.";
      sync.overflow = true;
    } else {
      sync.records.push({ localId: tx.id, amountCents: Math.round(amount * 100), status: "queued" });
      void drain(sync);
    }
  }
  return next;
}

/** Initialize once from current opening funds, excluding already-booked rent/equipment.
 * Attach before awaiting so transactions accepted during provisioning are retained.
 * A new finance object after property change has a separate synchronization session.
 */
export function attachNessieAccount(finance: FinanceState, onChange: () => void = () => {}) {
  if (!process.env.NESSIE_KEY || finance.nessieSync) return;
  const sync: NessieSync = { status: "provisioning", records: [], openingCents: Math.round(finance.balance * 100) };
  finance.nessieSync = sync;
  void (async () => {
    try {
      // Synthetic identity only; player names are not sent to the banking provider.
      const customer = await request("/customers", { first_name: "Cafe", last_name: "Simulation", address: {
        street_number: "1", street_name: "Demo Ave", city: "Houston", state: "TX", zip: "77002" } });
      if (typeof customer.id !== "string") throw new Error("Invalid customer response");
      const account = await request(`/customers/${encodeURIComponent(customer.id)}/accounts`, {
        type: "Checking", nickname: "Play It First Cafe", balance_cents: sync.openingCents, rewards: 0 });
      if (typeof account.id !== "string") throw new Error("Invalid account response");
      sync.accountId = account.id;
      sync.status = "ready";
      onChange();
      await drain(sync);
    } catch {
      sync.status = "unknown";
      sync.error = "Account setup was not confirmed. No automatic retry; check the sandbox before retrying.";
    }
    onChange();
  })();
}

async function drain(sync: NessieSync) {
  if (!sync.accountId || sync.status !== "ready" || workers.has(sync) || sync.records.some((r) => r.status === "unknown")) return;
  workers.add(sync);
  try {
    for (const record of sync.records) {
      if (record.status !== "queued") continue;
      record.status = "unknown"; // A lost response must never cause an automatic duplicate.
      try {
        const data = await request(`/accounts/${encodeURIComponent(sync.accountId)}/${record.amountCents > 0 ? "deposits" : "withdrawals"}`, {
          amount_cents: Math.abs(record.amountCents), medium: "balance", description: `playitfirst:${record.localId}` });
        if (typeof data.id !== "string" || data.amount_cents !== Math.abs(record.amountCents) || !["pending", "completed", "declined", "cancelled"].includes(data.status)) throw new Error("Invalid transaction response");
        record.remoteId = data.id;
        record.status = data.status === "completed" ? "confirmed" : data.status === "pending" ? "pending" : "failed";
      } catch (error) {
        if (error instanceof NessieHttpError && error.status >= 400 && error.status < 500 && error.status !== 408) {
          record.status = "failed";
          sync.error = `Sandbox rejected a transaction (HTTP ${error.status}). Local funds are unchanged.`;
        } else sync.error = "A sandbox write is unconfirmed. Reconcile before any retry.";
        // Stop dependent writes until an operator reconciles this ambiguous result.
        break;
      }
    }
  } finally { workers.delete(sync); }
}

/** Read-only reconciliation. Never replays an ambiguous POST or overwrites game cash. */
export async function reconcileNessie(finance: FinanceState) {
  const sync = finance.nessieSync;
  if (!sync?.accountId || !process.env.NESSIE_KEY) return;
  try {
    const accountId = encodeURIComponent(sync.accountId);
    const [account, history] = await Promise.all([
      request(`/accounts/${accountId}`), request(`/accounts/${accountId}/transactions?limit=100`),
    ]);
    if (!Number.isSafeInteger(account.balance_cents) || !Array.isArray(history.items)) throw new Error("Invalid reconciliation response");
    for (const record of sync.records) {
      const matches = history.items.filter((tx: { description?: string }) => tx.description === `playitfirst:${record.localId}`);
      if (matches.length !== 1) {
        if (matches.length > 1) { record.status = "failed"; sync.error = "Duplicate sandbox transaction detected."; }
        continue;
      }
      const tx = matches[0];
      if (tx.amount_cents !== Math.abs(record.amountCents) || tx.kind !== (record.amountCents > 0 ? "deposit" : "withdrawal")) {
        record.status = "failed"; sync.error = "Sandbox transaction does not match the local receipt."; continue;
      }
      record.remoteId = tx.id;
      record.status = tx.status === "completed" ? "confirmed" : tx.status === "pending" ? "pending" : "failed";
    }
    if (!sync.overflow && sync.records.every((r) => r.status !== "unknown" && r.status !== "failed")) delete sync.error;
    sync.remoteBalanceCents = account.balance_cents;
    sync.differenceCents = account.balance_cents - Math.round(finance.balance * 100);
    sync.checkedAt = Date.now();
  } catch { sync.error = "Sandbox reconciliation failed; local funds are unchanged."; }
}

const refreshTimes = new WeakMap<NessieSync, number>();
/** At most one read-only reconciliation per 15 seconds per active room. */
export function refreshNessie(finance: FinanceState) {
  const sync = finance.nessieSync;
  if (!sync?.accountId || Date.now() - (refreshTimes.get(sync) ?? 0) < 15000) return;
  refreshTimes.set(sync, Date.now());
  void reconcileNessie(finance).then(() => drain(sync));
}
