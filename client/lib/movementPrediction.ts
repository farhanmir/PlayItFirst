import type { RoomSnapshot } from "../../shared/types";
import { furnitureMoveClear } from "../../shared/movement";
import { floorMoveClear } from "../../shared/floorplan";

type Move = { seq: number; x: number; z: number };

/** Reapply only unacknowledged movement, never stale player/business state. */
export function createMovementPrediction() {
  let sequence = 0;
  let pending: Move[] = [];
  return {
    reset(ack = 0) { sequence = ack; pending = []; },
    record(x: number, z: number) {
      const move = { seq: ++sequence, x, z };
      pending.push(move);
      // A stalled connection must not retain an unbounded input history.
      if (pending.length > 180) pending.shift();
      return move;
    },
    reconcile(snapshot: RoomSnapshot, you: string): RoomSnapshot {
      const player = snapshot.players.find((p) => p.id === you);
      if (!player || !snapshot.property) { pending = []; return snapshot; }
      // An older server has no acknowledgements; retain authoritative behavior.
      if (player.moveAck === undefined) { pending = []; return snapshot; }
      pending = pending.filter((move) => move.seq > player.moveAck!);
      let position = { x: player.x, z: player.z };
      const plan = snapshot.property.floorPlan;
      for (const move of pending) {
        if (move.x < 0.3 || move.z < 0.3 || move.x > snapshot.property.width - 0.3 || move.z > snapshot.property.depth - 0.3) continue;
        if (!furnitureMoveClear(snapshot.layout?.furniture ?? [], position, move)) continue;
        if (plan && !floorMoveClear(plan, position, move)) continue;
        position = move;
      }
      return { ...snapshot, players: snapshot.players.map((p) => p.id === you ? { ...p, x: position.x, z: position.z } : p) };
    },
  };
}
