import type { RoomSnapshot } from "../../shared/types";
import { nearestStation, type StationHint } from "../../shared/stations";

export type PlayAction = "take_order" | "make_coffee" | "serve" | "restock" | "collect";

/** Best next action from holding state + nearest station. */
export function suggestedAction(snapshot: RoomSnapshot, playerId: string | null): PlayAction | null {
  if (!playerId) return null;
  const me = snapshot.players.find((p) => p.id === playerId);
  if (!me) return null;

  const station = nearestStation(snapshot, playerId);
  const holding = me.holding;
  const inv = snapshot.inventory;
  const lowStock = inv.beans < 4 || inv.cups < 4 || inv.milk < 2;

  if (holding?.startsWith("drink:")) return "serve";
  if (holding?.startsWith("ticket:")) return "make_coffee";
  if (lowStock && (station === "fridge" || !station)) return "restock";
  if (station === "counter") return "take_order";
  if (station === "machine") return "make_coffee";
  if (station === "pickup") return "serve";
  if (station === "fridge") return "restock";

  const hasQueue = snapshot.customers.some((c) => c.state === "queue" || c.state === "ordering");
  const hasWaiting = snapshot.customers.some((c) => c.state === "waiting");
  if (hasQueue) return "take_order";
  if (hasWaiting) return "make_coffee";
  if (lowStock) return "restock";
  return null;
}

export function stationLabel(station: StationHint | null): string | null {
  if (!station) return null;
  const labels: Record<StationHint, string> = {
    counter: "Near counter",
    machine: "Near machine",
    pickup: "Near pickup",
    fridge: "Near fridge",
  };
  return labels[station];
}
