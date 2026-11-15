import { describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";
import { PhotonBridge, photonConfigurationStatus } from "./photon-bridge.ts";
import { CafeManager } from "./manager.ts";
import { addPlayer, createRoomSnapshot } from "./simulation.ts";
const identifier = (kind: string, n = 1) => `pho_${kind}_${String(n).padStart(26, "0")}`;
const config = { senderHandle: "+15555550123", projectId: identifier("prj"), senderId: identifier("usr"), apiKey: "pho_sk_test", webhookSecret: `whsec_${Buffer.alloc(32, 7).toString("base64")}` };
const owner = { roomCode: "test-room", memberId: "owner" };
function setup() {
  let now = Date.now();
  let snapshot = addPlayer(createRoomSnapshot(owner.roomCode), owner.memberId, "Owner", "owner");
  const authorize = (a: typeof owner) => { if (a.roomCode !== owner.roomCode || a.memberId !== owner.memberId) throw new Error("Owner required"); };
  const manager = new CafeManager({ read: () => snapshot, update: fn => { snapshot = fn(snapshot); }, publish: () => {} }, { configured: () => false, cooldownMs: 0 });
  const send = vi.fn().mockResolvedValue({ messageId: identifier("msg"), acceptance: "accepted", delivery: "unverified" });
  const changed = vi.fn();
  const bridge = new PhotonBridge(config, { authorize, manager: () => manager, changed, send, now: () => now });
  let eventNumber = 0;
  function signed(text: string, sender = 2, project = config.projectId) {
    now += 3100;
    const eventId = identifier("evt", ++eventNumber);
    const event = { id: eventId, apiVersion: "2026-07-01", type: "message.received", source: "imessage.photon", timestamp: new Date().toISOString(),
      data: { projectId: project, object: { id: identifier("msg", eventNumber), projectId: project, platform: "imessage", status: "received",
        sentBy: { id: identifier("usr", sender), projectId: project, platform: "imessage", handle: "+15555550123" },
        space: { id: identifier("spc"), projectId: project, platform: "imessage", participantIds: [config.senderId, identifier("usr", sender)] },
        content: { type: "text", format: "plain", text } } } };
    const raw = JSON.stringify(event);const date = new Date();
    return [raw, { "webhook-id": eventId, "webhook-timestamp": String(Math.floor(date.getTime() / 1000)), "webhook-signature": new Webhook(config.webhookSecret).sign(eventId, date, raw) }] as const;
  }
  return { bridge, manager, send, changed, signed, read: () => snapshot, advance: () => { now += 3100; }, rewind: () => { now -= 3100; } };
}
describe("Photon authenticated owner pairing and shared manager", () => {
  it("reports readiness using environment names without exposing secrets", () => {
    vi.stubEnv("PHOTON_MESSAGING_TRANSPORT", "webhook");
    vi.stubEnv("PHOTON_ACTIVATION_CODE", "a".repeat(32));
    vi.stubEnv("PHOTON_TEST_SENDER", config.senderHandle);
    vi.stubEnv("PHOTON_PROJECT_ID", config.projectId);
    vi.stubEnv("PHOTON_SENDER_ID", "");
    vi.stubEnv("PHOTON_API_KEY", "sensitive-invalid-key");
    vi.stubEnv("PHOTON_WEBHOOK_SECRET", config.webhookSecret);
    try {
      const status = photonConfigurationStatus();
      expect(status.configured).toBe(false);
      expect(status.missing).toEqual(["PHOTON_SENDER_ID"]);
      expect(status.invalid).toEqual(["PHOTON_API_KEY"]);
      expect(JSON.stringify(status)).not.toContain("sensitive-invalid-key");
      expect(JSON.stringify(status)).not.toContain(config.webhookSecret);
    } finally { vi.unstubAllEnvs(); }
  });
  it("requires owner confirmation, exact proposal approval, and applies a duplicate event once", async () => {
    const s = setup();const pairing = s.bridge.start(owner);
    expect(() => s.bridge.start({ ...owner, memberId: "guest" })).toThrow(/Owner/);
    await s.bridge.receive(...s.signed(`PAIR ${pairing.code}`));
    expect(s.bridge.status(owner).paired).toBe(false);
    await s.bridge.receive(...s.signed("restock milk"));
    expect(s.manager.getView().proposals).toHaveLength(0);
    s.bridge.confirm(owner);
    await s.bridge.receive(...s.signed("restock milk"));
    const proposal = s.manager.getView().proposals[0];expect(proposal.status).toBe("pending");
    expect(s.read().finance.balance).toBe(20000);
    s.advance(); await s.bridge.receive(...s.signed("yes approve"));
    expect(s.read().finance.balance).toBe(20000);
    s.advance(); const approval = s.signed(`APPROVE ${proposal.id}`);
    await Promise.all([s.bridge.receive(...approval), s.bridge.receive(...approval)]);
    expect(s.read().finance.balance).toBe(19965);
    expect(s.read().inventory).toEqual({ milk: 36, cups: 60, beans: 45 });
    expect(s.read().finance.transactions.filter(t => t.category === "inventory")).toHaveLength(1);
    expect(s.send.mock.calls.at(-1)?.[0].text).toContain("Supplies delivered");
    s.advance();s.bridge.revoke(owner);await s.bridge.receive(...s.signed("restock milk"));
    expect(s.read().finance.balance).toBe(19965);
  });
  it("rejects invalid signatures, cross-project identities, and expired pairing", async () => {
    const s = setup();const args = s.signed("restock");
    await expect(s.bridge.receive(args[0] + " ", args[1])).rejects.toMatchObject({ status: 400 });
    await expect(s.bridge.receive(...s.signed("restock", 2, identifier("prj", 3)))).rejects.toMatchObject({ status: 400 });
    const pairing = s.bridge.start(owner);for(let i = 0; i < 100; i++)s.advance();
    await s.bridge.receive(...s.signed(`PAIR ${pairing.code}`));
    expect(() => s.bridge.confirm(owner)).toThrow(/No current/);
    expect(s.manager.getView().proposals).toHaveLength(0);
  });
  it("returns retryable throttling without consuming the event", async () => {
    const s = setup();await s.bridge.receive(...s.signed("hello"));
    const next = s.signed("hello again");s.rewind();
    await expect(s.bridge.receive(...next)).rejects.toMatchObject({ status: 429 });
    const calls = s.send.mock.calls.length;
    s.advance();await s.bridge.receive(...next);
    expect(s.send.mock.calls.length).toBe(calls + 1);
  });
  it("does not reexecute or change idempotent response after ambiguous outbound failure", async () => {
    const s = setup();const pairing = s.bridge.start(owner);
    await s.bridge.receive(...s.signed(`PAIR ${pairing.code}`));s.bridge.confirm(owner);
    await s.bridge.receive(...s.signed("restock"));s.advance();
    const proposal = s.manager.getView().proposals[0];
    s.send.mockRejectedValue(new Error("network timeout"));const args = s.signed(`APPROVE ${proposal.id}`);
    const callsBefore = s.send.mock.calls.length;
    await expect(s.bridge.receive(...args)).rejects.toMatchObject({ status: 503 });
    await expect(s.bridge.receive(...args)).rejects.toMatchObject({ status: 503 });
    expect(s.send.mock.calls.length).toBe(callsBefore + 1);
    expect(s.read().finance.balance).toBe(19965);
  });
});
