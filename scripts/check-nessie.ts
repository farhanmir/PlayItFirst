/** One explicit live sandbox acceptance run. No real money, no provider writes
 * without a key and --live. Never automatically rerun after failure. */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { applyTransaction, attachNessieAccount, createFinance, reconcileNessie } from "../server/finance.ts";

if (existsSync(".env")) loadEnvFile(".env");
if (!process.argv.includes("--live") || !process.env.NESSIE_KEY?.trim()) {
  console.error("Set NESSIE_KEY in ignored .env, then run with --live. No calls made.");
  process.exit(1);
}
let finance = createFinance(1000);
attachNessieAccount(finance, undefined, { monthlyRent: 300 });
const started = Date.now();
while (finance.nessieSync?.status === "provisioning" && Date.now() - started < 20000) await sleep(500);
if (finance.nessieSync?.status !== "ready") {
  console.error("Sandbox account was not confirmed. Inspect provider records before another run.");
  process.exit(1);
}
// Synthetic sale and supply purchase through the SAME production ledger adapter.
// This verifies the provider contract, not a physical game order/manager approval.
finance = applyTransaction(finance, "Synthetic acceptance coffee", 9, "sales");
finance = applyTransaction(finance, "Synthetic acceptance supplies", -35, "inventory");
const deadline = Date.now() + 60000;
let success = false;
while (Date.now() < deadline) {
  await reconcileNessie(finance);
  const sync = finance.nessieSync!;
  if (sync.records.some(r => r.status === "failed") || sync.billSetupStatus === "failed" || sync.billSetupStatus === "unknown") break;
  const bill = sync.bills?.find(b => b.amountCents === 30000 && b.status === "recurring");
  if (sync.records.length === 2 && sync.records.every(r => r.status === "confirmed" && r.remoteId) &&
      sync.remoteBalanceCents === 97400 && sync.differenceCents === 0 && sync.billSetupStatus === "confirmed" && bill) { success = true; break; }
  await sleep(3000);
}
const sync = finance.nessieSync!;
console.log(JSON.stringify({ syntheticOnly:true, liveSandbox:true, passed:success, localBalanceUSD:finance.balance,
  remoteBalanceCents:sync.remoteBalanceCents, differenceCents:sync.differenceCents, accountId:sync.accountId,
  records:sync.records, bills:sync.bills, billSetupStatus:sync.billSetupStatus, error:sync.error, billError:sync.billError }, null, 2));
if (!success) { console.error("Live settlement not established. Do not rerun ambiguous writes; inspect this account first."); process.exitCode = 1; }
