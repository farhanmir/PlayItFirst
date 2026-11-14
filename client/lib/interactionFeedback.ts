import type { RoomSnapshot } from "../../shared/types";

export type InteractionSound = "order" | "brew" | "place";

/** Feedback follows accepted state, never a request or a changed error log. */
export function interactionSounds(previous: RoomSnapshot, current: RoomSnapshot, playerId: string | null): InteractionSound[] {
  if (!playerId || previous.code !== current.code) return [];
  const before = previous.players.find((p) => p.id === playerId);
  const after = current.players.find((p) => p.id === playerId);
  if (!before || !after) return [];
  const sounds: InteractionSound[] = [];
  if (after.holding !== before.holding) {
    if (after.holding?.startsWith("ticket:")) sounds.push("order");
    if (after.holding?.startsWith("brewing:") ||
      (after.holding?.startsWith("drink:") && !before.holding?.startsWith("brewing:") && !before.holding?.startsWith("drink:"))) {
      sounds.push("brew");
    }
  }
  const knownReceipts = new Set(previous.finance.transactions.map((t) => t.id));
  const delivered = current.inventory.beans > previous.inventory.beans && current.inventory.cups > previous.inventory.cups;
  if (delivered && current.finance.transactions.some((t) => t.category === "inventory" && !knownReceipts.has(t.id))) sounds.push("place");
  // ServeToast already owns accepted-sale feedback; collect cannot mint a sound.
  return sounds;
}
