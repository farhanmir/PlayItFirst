import { describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";
import { sendPhotonText, verifyPhotonEvent } from "./photon-transport";
const suffix = "00000000000000000000000001";
const request = { projectId: `pho_prj_${suffix}`, senderId: `pho_usr_${suffix}`, spaceId: `pho_spc_${suffix}`, text: "Actual game receipt", idempotencyKey: "reply-event-123" };
const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
describe("Photon Beta transport", () => {
  it("accepts signed original bytes and rejects changed or expired deliveries", () => {
    const payload = '{"id":"event-123","value":1}';
    const sign = (date: Date) => ({ "webhook-id": "event-123", "webhook-timestamp": String(Math.floor(date.getTime() / 1000)), "webhook-signature": new Webhook(secret).sign("event-123", date, payload) });
    expect(verifyPhotonEvent(payload, sign(new Date()), secret)).toEqual({ id: "event-123", value: 1 });
    expect(() => verifyPhotonEvent(payload.replace(':1', ':2'), sign(new Date()), secret)).toThrow();
    expect(() => verifyPhotonEvent(payload, sign(new Date(Date.now() - 600_000)), secret)).toThrow();
    expect(() => verifyPhotonEvent("x".repeat(65537), {}, secret)).toThrow(/64 KiB/);
  });
  it("uses documented endpoint and idempotency header, distinguishes acceptance from delivery", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: `pho_msg_${suffix}`, projectId: request.projectId }), { status: 202 }));
    expect(await sendPhotonText(request, "pho_sk_test", fetcher)).toEqual({ messageId: `pho_msg_${suffix}`, acceptance: "accepted", delivery: "unverified" });
    expect(fetcher).toHaveBeenCalledWith(`https://api.photon.codes/v1/projects/${request.projectId}/messages`, expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "reply-event-123" }), body: JSON.stringify({ senderId: request.senderId, spaceId: request.spaceId, content: { type: "text", format: "plain", text: request.text } }) }));
  });
  it("rejects failed or cross-project responses without retrying or exposing response bodies", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("sensitive provider detail", { status: 403 }));
    await expect(sendPhotonText(request, "pho_sk_test", fetcher)).rejects.toThrow("Photon rejected message (HTTP 403)");
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(new Response(JSON.stringify({ id: `pho_msg_${suffix}`, projectId: "another" }), { status: 202 }));
    await expect(sendPhotonText(request, "pho_sk_test", fetcher)).rejects.toThrow(/invalid acceptance/);
  });
});
