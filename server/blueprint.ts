import type { RoomSnapshot } from "../shared/types";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");

/** Export recorded session evidence; never extrapolate it into a business forecast. */
export function buildBlueprint(snapshot: RoomSnapshot): string {
  const { property: p, layout, finance: f, metrics: m } = snapshot;
  if (!p || !layout) return "# Blueprint unavailable\n\nSelect a property and build first.";
  const sourced = p.source === "costar-extract" || p.source === "costar-live";
  const costs = new Map<string, number>();
  for (const tx of f.transactions) if (tx.amount < 0) costs.set(tx.category, (costs.get(tx.category) ?? 0) - tx.amount);
  const costsTotal = [...costs.values()].reduce((sum, value) => sum + value, 0);
  const recommendations: string[] = [];
  if (m.customersLost > 0) recommendations.push(`${m.customersLost} guests left during this session. Inspect their route and service delays before changing staffing or layout.`);
  if (m.queueLength > 0) recommendations.push(`${m.queueLength} guests are currently queued. Test a counter or pickup move with a second player and record route distance and wait time before and after.`);
  if (Math.min(snapshot.inventory.milk, snapshot.inventory.cups, snapshot.inventory.beans) < 10) recommendations.push("At least one supply has fewer than 10 units. Compare remaining stock with the next orders before approving a replenishment.");
  if (!m.customersServed) recommendations.push("No completed service is recorded. Complete a manual order before drawing conclusions about this layout.");
  if (!recommendations.length) recommendations.push("Run another shift under comparable demand and record the route and wait-time effects of one change at a time.");
  const decisions = snapshot.manager?.proposals.filter((proposal) => proposal.status === "executed") ?? [];
  return `# Play It First Business Launch Blueprint

Generated from room **${cell(snapshot.code)}**, at **${snapshot.simTime.toFixed(1)} simulated seconds**. This is a snapshot of a played simulation, not a market forecast.

## Data provenance and selected commercial property
- **Property:** ${cell(p.name)} (${cell(p.costarId)})
- **Address:** ${cell(p.address)}
- **Source:** ${p.source ?? "unspecified"}${sourced ? "; asking terms, not an executed lease" : "; fixture / assumption, not a verified available lease"}
- **Monthly base asking rent:** ${money(p.monthlyRent)}${sourced ? "; additional charges require confirmation" : " (fixture / assumption)"}
- **Rentable listing area:** ${p.sqft} sq ft.
${p.provenance ? `- **Asking rate:** ${money(p.provenance.askingRate)} ${p.provenance.rateBasis}; suite ${cell(p.provenance.suite)}.\n` : ""}- **Captured scan area:** ${p.provenance?.scanAreaM2 != null ? `${p.provenance.scanAreaM2.toFixed(2)} m²; distinct from rentable listing area` : "not recorded"}.
- **Playable geometry:** ${p.floorPlan ? `measured reconstruction with ${p.floorPlan.rooms.length} rooms and ${p.floorPlan.walls.length} physical walls; model ${cell(p.floorPlan.modelId)}` : `assumed rectangular footprint ${p.width} × ${p.depth} m; not a measured reconstruction`}.
- **Operating capacity:** ${p.capacity} (simulation assumption; not an occupancy approval).

## Proposed layout and equipment
Positions are game-floor metres; rotation is degrees. Equipment costs are simulated, not contractor quotes.

| Item | X | Z | Rotation | Simulated cost |
| --- | ---: | ---: | ---: | ---: |
${layout.furniture.map((item) => `| ${cell(item.label)} | ${item.x.toFixed(2)} | ${item.z.toFixed(2)} | ${(item.rotation * 180 / Math.PI).toFixed(0)} | ${money(item.cost)} |`).join("\n")}

Recorded build-out budget spent: **${money(layout.budgetSpent)}**. This is already reflected in the ledger; do not add it again to total expenses.

## Simulated startup costs and operating expenses
- Starting capital assumption: ${money(snapshot.startingBudget)}.
- Current cash: ${money(f.balance)}.
- Cumulative recorded session revenue: ${money(f.revenue)}.
- Cumulative recorded session expenses: ${money(f.expenses)}.
- Net cash change from starting capital: ${money(f.balance - snapshot.startingBudget)}.

Expense categories in retained receipts:
${[...costs].map(([kind, amount]) => `- ${kind}: ${money(amount)}`).join("\n") || "- No expense receipts recorded."}

Retained expense receipts total ${money(costsTotal)}. ${Math.abs(costsTotal - f.expenses) > 0.005 ? "The retained receipt window does not cover all cumulative expenses; it is not a complete accounting history." : "This matches cumulative expenses at export."} Rent is the opening charge, not a monthly expense repeated each simulated minute. Wages and equipment prices are game assumptions. Taxes, deposits, financing, insurance and actual fit-out costs are not fully modeled.

## Results from the played shift
- Customers served: ${m.customersServed}; customers lost: ${m.customersLost}.
- Current queue: ${m.queueLength}; recorded average wait: ${m.avgWaitSec.toFixed(1)} seconds.
- Simulated satisfaction: ${m.satisfaction.toFixed(1)}%.
- Remaining inventory: milk ${snapshot.inventory.milk}, cups ${snapshot.inventory.cups}, beans ${snapshot.inventory.beans}.
- Participants: ${snapshot.players.map((player) => `${cell(player.name)} (${player.role})`).join(", ") || "none recorded"}.
- Menu: ${snapshot.menuReduced ? "simplified" : "standard"}.

These are session observations. No causal improvement, daily revenue or profitability is established by a single shift.

## Business decisions tested
${decisions.map((proposal) => `- ${proposal.action}: ${money(proposal.cost)}; ${cell(proposal.result ?? "executed")}. Proposal ${cell(proposal.id)}${proposal.transactionId ? `; receipt ${cell(proposal.transactionId)}` : ""}.`).join("\n") || "No executed manager decisions are retained in this snapshot."}

Recent recorded events (not a complete change history):
${snapshot.eventLog.slice(0, 12).map((event) => `- ${cell(event)}`).join("\n") || "- No events recorded."}

## Retained transaction evidence
| Receipt | Category | Description | Amount |
| --- | --- | --- | ---: |
${f.transactions.map((tx) => `| ${cell(tx.id)} | ${tx.category} | ${cell(tx.label)} | ${money(tx.amount)} |`).join("\n")}

These are local simulation receipts. External bank/provider confirmation must be checked separately.

## Bottlenecks to investigate next
${recommendations.map((line) => `- ${line}`).join("\n")}

## Assumptions and uncertainties
- Starting capital, demand, menu prices, brewing times, wages and guest preferences are simulated.
- Furniture, wall finishes/heights and the chosen operating entrance are design choices unless separately documented.
${p.provenance?.assumptions.map((assumption) => `- ${cell(assumption)}`).join("\n") ?? "- No additional property-specific assumptions were supplied."}
- Shared layout changes can affect routes. This export does not contain a controlled before/after experiment and makes no quantified improvement claim.

## Before signing a real lease
1. Confirm availability, permitted café use, base rent and additional charges with the broker/landlord.
2. Tour the actual suite and verify the reconstruction and equipment clearances with a qualified designer.
3. Obtain fit-out/equipment bids, utility requirements and a complete startup/operating budget.
4. Confirm permits, accessibility, health requirements and insurance with qualified local professionals.
5. Validate demand and prices with market research; rehearse the revised layout and staffing with a comparable shift.

> **Disclaimer:** Educational simulation only. This is a planning conversation, not a revenue forecast, lease recommendation, code-compliance assessment or professional advice.
`;
}
