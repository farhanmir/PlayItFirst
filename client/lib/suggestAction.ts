import type { RoomSnapshot } from "../../shared/types";
import { nearStation, type StationHint } from "../../shared/stations";

export type PlayAction = "take_order" | "make_coffee" | "serve" | "restock" | "collect";

/** Best next action from holding state + nearest station. */
export function suggestedAction(snapshot: RoomSnapshot, playerId: string | null): PlayAction | null {
  if (!playerId) return null;
  const me = snapshot.players.find((p) => p.id === playerId);
  if (!me) return null;

  const holding = me.holding;
  if (holding?.startsWith("drink:")) return nearStation(snapshot, playerId, ["pickup", "counter"]) ? "serve" : null;
  if (holding?.startsWith("brewing:")) return null;
  const waiting = snapshot.customers.some((c) => c.state === "waiting" && c.order && (c.ticketHolder === playerId || c.ticketHolder == null));
  if (holding?.startsWith("ticket:") || waiting) return nearStation(snapshot, playerId, ["coffee_machine"]) ? "make_coffee" : null;
  const hasQueue = snapshot.customers.some((c) => c.state === "queue" || c.state === "ordering");
  if (hasQueue && nearStation(snapshot, playerId, ["counter"])) return "take_order";
  const inv = snapshot.inventory;
  if ((inv.beans < 4 || inv.cups < 4 || inv.milk < 2) && nearStation(snapshot, playerId, ["fridge"])) return "restock";
  return null;
}

export function stationLabel(station: StationHint | null): string | null {
  if (!station) return null;
  const labels: Record<StationHint, string> = {
    counter: "Service counter",
    machine: "Espresso machine",
    pickup: "Pickup shelf",
    fridge: "Fridge",
  };
  return labels[station];
}

/** Short contextual prompt for the immersive HUD / Space / E key. */
export function actionPrompt(snapshot: RoomSnapshot, playerId: string | null): string {
  const action = suggestedAction(snapshot, playerId);
  const me = playerId ? snapshot.players.find((p) => p.id === playerId) : null;
  if (me?.holding?.startsWith("brewing:")) return "Pulling your shot…";
  const drink = me?.holding?.startsWith("drink:")
    ? me.holding.slice("drink:".length)
    : me?.holding?.startsWith("ticket:")
      ? me.holding.slice("ticket:".length)
      : me?.holding?.startsWith("brewing:")
        ? me.holding.slice("brewing:".length).split("@")[0]
        : null;
  const waiting = snapshot.customers.find((c) => c.state === "ordering" || c.state === "queue");

  if (me?.holding?.startsWith("drink:")) {
    if (!playerId || !nearStation(snapshot, playerId, ["pickup", "counter"])) return "Carry your drink to pickup";
    const hasTicket = snapshot.customers.some((c) => c.state === "waiting" && c.order === drink && (c.ticketHolder === playerId || c.ticketHolder == null));
    return hasTicket ? `E · Serve ${drink}` : `E · Clear unclaimed ${drink}`;
  }
  if (me?.holding?.startsWith("ticket:") && !action) return "Walk to the espresso machine";
  if (!action && snapshot.customers.some((c) => c.state === "waiting" && c.order && (c.ticketHolder === playerId || c.ticketHolder == null))) return "Walk to the espresso machine";

  if (!action && waiting) return "Walk to the service counter";
  switch (action) {
    case "take_order":
      return waiting ? `E · Take ${waiting.preference} order` : "E · Take order";
    case "make_coffee":
      return drink ? `E · Brew ${drink}` : "E · Brew";
    case "serve":
      return drink ? `E · Serve ${drink}` : "E · Serve drink";
    case "restock":
      return "E · Restock supplies";
    case "collect":
      return "E · Check register";
    default:
      return "Waiting for the next guest";
  }
}
