import { Webhook } from "standardwebhooks";

/** Photon Beta 2.0 only. No route is enabled until project event schema/pairing is configured.
 * Contract: https://photon.codes/docs/beta/message-delivery/webhook
 * REST schema: https://api.photon.codes/openapi.json
 */
export function verifyPhotonEvent(rawBody: string, headers: Record<string, string>, secret: string): unknown {
  if (Buffer.byteLength(rawBody, "utf8") > 64 * 1024) throw new Error("Photon event exceeds 64 KiB");
  if (!secret.startsWith("whsec_")) throw new Error("Photon signing secret unavailable");
  // Verify ORIGINAL bytes before JSON parsing. This also enforces the five-minute replay window.
  return new Webhook(secret).verify(rawBody, headers);
}

export interface PhotonTextRequest {
  projectId: string;
  senderId: string;
  spaceId: string;
  text: string;
  /** Stable per accepted inbound event/reply. Reuse only with identical request content. */
  idempotencyKey: string;
}

/** Accepted by Photon is not proof of delivery to a phone. No automatic retries. */
export async function sendPhotonText(request: PhotonTextRequest, apiKey: string, fetcher: typeof fetch = fetch) {
  const identifier = (prefix: string, value: string) => new RegExp(`^pho_${prefix}_[0-7][0-9a-hjkmnp-tv-z]{25}$`).test(value);
  if (!identifier("prj", request.projectId) || !identifier("usr", request.senderId) || !identifier("spc", request.spaceId)) throw new Error("Invalid Photon identity");
  if (!apiKey.startsWith("pho_sk_")) throw new Error("A project-scoped Photon API key is required");
  if (!request.text.trim() || request.text.length > 4000 || !/^[\x21-\x7e]{1,255}$/.test(request.idempotencyKey)) throw new Error("Invalid Photon text request");
  const response = await fetcher(`https://api.photon.codes/v1/projects/${request.projectId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": request.idempotencyKey },
    body: JSON.stringify({ senderId: request.senderId, spaceId: request.spaceId, content: { type: "text", format: "plain", text: request.text } }),
    signal: AbortSignal.timeout(8000),
  });
  // Do not surface arbitrary provider response text; it can contain addresses or credentials.
  if (response.status !== 202) throw new Error(`Photon rejected message (HTTP ${response.status})`);
  const body = await response.json() as { id?: unknown; projectId?: unknown; status?: unknown };
  if (typeof body.id !== "string" || !identifier("msg", body.id) || body.projectId !== request.projectId) throw new Error("Photon returned an invalid acceptance receipt");
  return { messageId: body.id, acceptance: "accepted" as const, delivery: "unverified" as const };
}
