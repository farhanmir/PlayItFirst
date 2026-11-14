import { describe, expect, it } from "vitest";
import { createMovementPrediction } from "./movementPrediction";
import { addPlayer, createRoomSnapshot, selectProperty } from "../../server/simulation";
import properties from "../../data/properties.json";
import type { PropertyListing, FurnitureItem } from "../../shared/types";
function state(x = 4, ack = 0) {
  const snapshot = addPlayer(selectProperty(createRoomSnapshot("prediction"), properties[0] as PropertyListing), "me", "Player", "owner");
  return { ...snapshot, layout: { ...snapshot.layout!, furniture: [] as FurnitureItem[] }, players: snapshot.players.map(p => ({...p, x, z: 2, moveAck: ack})) };
}
describe("movement prediction with delayed authoritative snapshots", () => {
  it("does not rewind walking when snapshots lag several inputs", () => {
    const prediction = createMovementPrediction();
    prediction.record(4.1, 2); prediction.record(4.2, 2); prediction.record(4.3, 2);
    for (const [x, ack] of [[4, 0], [4.1, 1], [4.2, 2], [4.3, 3]]) {
      const incoming = state(x, ack);
      incoming.players[0].holding = "drink:latte";
      const reconciled = prediction.reconcile(incoming, "me");
      expect(reconciled.players[0].x).toBeCloseTo(4.3);
      expect(reconciled.players[0].holding).toBe("drink:latte");
    }
  });
  it("accepts a rejected movement once acknowledged instead of masking it", () => {
    const prediction = createMovementPrediction(); prediction.record(5, 2);
    expect(prediction.reconcile(state(4, 1), "me").players[0].x).toBe(4);
  });
  it("rechecks pending movement when another player moves furniture", () => {
    const prediction = createMovementPrediction(); prediction.record(6, 2);
    const incoming = state();
    incoming.layout.furniture = [{id:"block",kind:"counter",label:"Counter",x:5,z:2,rotation:0,cost:100}];
    expect(prediction.reconcile(incoming, "me").players[0].x).toBe(4);
  });
  it("drops stale prediction on reconnect and continues the acknowledged sequence", () => {
    const prediction = createMovementPrediction(); prediction.record(8, 2); prediction.reset(40);
    expect(prediction.reconcile(state(4, 40), "me").players[0].x).toBe(4);
    expect(prediction.record(4.1, 2).seq).toBe(41);
  });
});
