// Explicit opt-in live provider test. Never loads the sponsor property importer.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { CafeManager } from "../server/manager.ts";
import { addPlayer, createRoomSnapshot, openCafe, selectProperty } from "../server/simulation.ts";
import type { PropertyListing } from "../shared/types.ts";

if (existsSync(".env")) loadEnvFile(".env");
assert(process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim(), "Set GOOGLE_API_KEY or GEMINI_API_KEY in ignored .env first");
const property: PropertyListing = {
  id: "synthetic-manager-test", name: "Synthetic Test Cafe", city: "Houston", neighborhood: "Invented",
  address: "Synthetic address; no real listing", sqft: 1000, monthlyRent: 1000, width: 14, depth: 10,
  capacity: 20, footTraffic: 0.5, matterportHint: "No scan", costarId: "synthetic-no-sponsor",
  imageTone: "#6b4f3a", description: "Entirely synthetic integration fixture", source: "local",
};
const owner = { roomCode: "synthetic-gemini", memberId: "synthetic-owner" };
let snapshot = addPlayer(openCafe(selectProperty(createRoomSnapshot(owner.roomCode), property)), owner.memberId, "Test Owner", "owner");
snapshot = addPlayer(snapshot, "synthetic-guest", "Test Guest", "barista");
const manager = new CafeManager({ read: () => snapshot, update: (fn) => { snapshot = fn(snapshot); },
  publish: (view) => { snapshot = { ...snapshot, manager: view }; } }, { cooldownMs: 0 });
const initial = structuredClone(snapshot);
const plan = await manager.request(owner, "Inspect the cafe, then propose exactly one reorder_supplies restock for $35. Do not execute it yet. Explain the pending owner approval.");
assert(plan.providerVerified, "Gemini planning failed; inspect provider quota/model availability");
const proposal = plan.proposals.find((p) => p.action === "reorder_supplies" && p.status === "pending");
assert(proposal, "Gemini did not propose a restock");
assert.deepEqual(snapshot.inventory, initial.inventory);
assert.equal(snapshot.finance.balance, initial.finance.balance);
await assert.rejects(manager.approve({ ...owner, memberId: "synthetic-guest" }, proposal.id), /owner/);
const outcome = await manager.approve(owner, proposal.id);
assert.equal(outcome.proposals.find((p) => p.id === proposal.id)?.status, "executed");
assert(outcome.trace.some((t) => t.tool === "read_outcome"), "Gemini must read fresh outcome");
assert.equal(snapshot.finance.balance, initial.finance.balance - 35);
assert.equal(snapshot.inventory.milk, initial.inventory.milk + 12);
assert.equal(snapshot.inventory.cups, initial.inventory.cups + 20);
assert.equal(snapshot.inventory.beans, initial.inventory.beans + 15);
await manager.approve(owner, proposal.id);
assert.equal(snapshot.finance.balance, initial.finance.balance - 35);
console.log(JSON.stringify({ model: process.env.DEEPAGENTS_MODEL || "gemini-3.6-flash", syntheticOnly: true,
  balanceBefore: initial.finance.balance, balanceAfter: snapshot.finance.balance, inventory: snapshot.inventory,
  status: "executed-once", trace: outcome.trace.map((t) => t.tool) }, null, 2));
