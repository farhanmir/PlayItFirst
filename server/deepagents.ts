/** Validated business actions shared by the manager and future provider adapters. */
import type { RoomSnapshot } from "../shared/types.ts";
import { applyRestock } from "./simulation.ts";
import { managerModelConfigured } from "./manager-runtime.ts";

export const deepagentsConfigured = managerModelConfigured;

export interface CafeToolState {
  balance: number;
  revenue: number;
  inventory: RoomSnapshot["inventory"];
  queueLength: number;
  avgWaitSec: number;
  customersServed: number;
  open: boolean;
  menuReduced: boolean;
  /** Helpers alone are never proof of a hosted framework/provider run. */
  hostedRuntime: boolean;
}

export function getCafeState(snapshot: RoomSnapshot): CafeToolState {
  return {
    balance: snapshot.finance.balance,
    revenue: snapshot.finance.revenue,
    inventory: { ...snapshot.inventory },
    queueLength: snapshot.metrics.queueLength,
    avgWaitSec: snapshot.metrics.avgWaitSec,
    customersServed: snapshot.metrics.customersServed,
    open: snapshot.open,
    menuReduced: snapshot.menuReduced === true,
    hostedRuntime: false,
  };
}

export interface CafeToolResult {
  ok: boolean;
  snapshot: RoomSnapshot;
  detail: string;
}

/** Validated reorder. Refuses when the ledger cannot cover the delivery. */
export function reorderSupplies(snapshot: RoomSnapshot): CafeToolResult {
  const result = applyRestock(snapshot, "Tool reorder_supplies");
  if (!result.ok) {
    return { ok: false, snapshot, detail: "Reorder refused: balance cannot cover the $35 delivery" };
  }
  return {
    ok: true,
    snapshot: {
      ...result.snapshot,
      eventLog: ["Tool reorder_supplies (−$35)", ...result.snapshot.eventLog].slice(0, 30),
    },
    detail: "Reorder posted on the local ledger. Hosted Deepagents is not required for this tool.",
  };
}

/** Validated staffing change. Unknown modes do not mutate the café. */
export function adjustStaffing(snapshot: RoomSnapshot, mode: "simplify_menu" | "ease_rush"): CafeToolResult {
  if (mode === "simplify_menu") {
    return {
      ok: true,
      snapshot: {
        ...snapshot,
        menuReduced: true,
        eventLog: ["Tool adjust_staffing: simplified the menu", ...snapshot.eventLog].slice(0, 30),
      },
      detail: "Menu reduced; observe future service before claiming an improvement.",
    };
  }
  if (mode === "ease_rush") {
    return {
      ok: true,
      snapshot: {
        ...snapshot,
        rushBoost: Math.max(0, (snapshot.rushBoost ?? 0) - 0.25),
        eventLog: ["Tool adjust_staffing: eased the rush", ...snapshot.eventLog].slice(0, 30),
      },
      detail: "Rush pressure eased. Local tool, not a hosted Deepagents run.",
    };
  }
  return { ok: false, snapshot, detail: "Unknown staffing mode" };
}
