/**
 * Capital One Nessie-backed simulated banking.
 * Uses the public Nessie sandbox when NESSIE_KEY is set; otherwise a deterministic local ledger.
 */
import { randomUUID } from "node:crypto";
import type { FinanceState, Transaction } from "../shared/types.ts";

const NESSIE_BASE = "http://api.nessieisreal.com";

export function createFinance(startingBalance: number): FinanceState {
  return {
    balance: startingBalance,
    revenue: 0,
    expenses: 0,
    transactions: [],
    nessieAccountId: `sim-${randomUUID().slice(0, 8)}`,
  };
}

export function applyTransaction(
  finance: FinanceState,
  label: string,
  amount: number,
  category: Transaction["category"],
): FinanceState {
  const tx: Transaction = {
    id: randomUUID(),
    label,
    amount,
    category,
    at: Date.now(),
  };
  const balance = finance.balance + amount;
  const revenue = amount > 0 ? finance.revenue + amount : finance.revenue;
  const expenses = amount < 0 ? finance.expenses + Math.abs(amount) : finance.expenses;
  return {
    ...finance,
    balance,
    revenue,
    expenses,
    transactions: [tx, ...finance.transactions].slice(0, 40),
  };
}

/** Optional live Nessie create — fails soft so demos never block. */
export async function provisionNessieAccount(customerName: string): Promise<string | null> {
  const key = process.env.NESSIE_KEY;
  if (!key) return null;
  try {
    const customerRes = await fetch(`${NESSIE_BASE}/customers?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: customerName.split(" ")[0] || "Play",
        last_name: customerName.split(" ").slice(1).join(" ") || "First",
        address: {
          street_number: "1",
          street_name: "Demo Ave",
          city: "Houston",
          state: "TX",
          zip: "77002",
        },
      }),
    });
    if (!customerRes.ok) return null;
    const customer = (await customerRes.json()) as { objectCreated?: { _id?: string } };
    const customerId = customer.objectCreated?._id;
    if (!customerId) return null;
    const acctRes = await fetch(`${NESSIE_BASE}/customers/${customerId}/accounts?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "Checking",
        nickname: "PlayFirst Café",
        balance: 20000,
        rewards: 0,
      }),
    });
    if (!acctRes.ok) return null;
    const acct = (await acctRes.json()) as { objectCreated?: { _id?: string } };
    return acct.objectCreated?._id ?? null;
  } catch {
    return null;
  }
}
