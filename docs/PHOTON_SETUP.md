# Photon Beta messaging setup

The existing `CafeManager` remains the only business execution service. `server/photon-transport.ts` verifies signed requests and sends real Beta text requests. `server/photon-bridge.ts` adds owner-confirmed phone pairing and manager request/approval routing. This implementation is **not evidence of a provisioned line, phone delivery, or completed sponsor acceptance**.

## Verified provider contract

Read on November 14, 2026: [Beta API reference](https://photon.codes/docs/beta/api-reference), [official OpenAPI](https://api.photon.codes/openapi.json), and [webhook contract](https://photon.codes/docs/beta/message-delivery/webhook).

- The supported event is API version `2026-07-01`, source `imessage.photon`, type `message.received`, with message under `data.object`.
- Supported content is plain text. Sender, space, message, and event IDs use the provider's public ID schemas. Only direct spaces containing exactly the configured agent and the phone sender are accepted. Group chats, attachments and other platforms are intentionally rejected.
- Standard Webhooks verifies the untouched raw request body with `webhook-id`, `webhook-timestamp`, and `webhook-signature`. Timestamp tolerance is five minutes. The event/header IDs and every project identity must agree.
- Replies use project-scoped Bearer authentication and `POST /v1/projects/{projectId}/messages` with `senderId`, `spaceId`, text content and a stable `Idempotency-Key`.
- HTTP 202 is provider acceptance, **not phone delivery**. Check the message resource and provider Event Deliveries for actual status before claiming delivery.

## Existing Render service configuration

Set these server-only variables through Render's Environment UI. Do not place secrets in chat, source control, screenshots, `VITE_*`, or browser storage.

| Variable | Value supplied by Photon project owner |
| --- | --- |
| `PHOTON_PROJECT_ID` | Existing `pho_prj_...` project ID |
| `PHOTON_SENDER_ID` | Existing `pho_usr_...` agent identity linked to the provisioned messaging line |
| `PHOTON_API_KEY` | Project-scoped `pho_sk_...` key |
| `PHOTON_WEBHOOK_SECRET` | Destination-specific `whsec_...` signing secret |

Create the destination in the existing Photon project only after the receiver route is deployed. Use `https://playitfirst.onrender.com/api/photon/webhook`, select API version `2026-07-01` and the iMessage received-message event. Verify that this version/event is selectable in that project's catalog. No subscription, line purchase or paid provisioning is performed by this code.

## Owner pairing and action contract

The host connects through the existing authenticated WebSocket session. The server calls `PhotonBridge.start(actor)` only after confirming the member is the room owner. Pairing state must be unicast to that owner, never broadcast to guests.

1. Create a pairing code in the owner menu. The random 12-character code expires after five minutes.
2. From the actual phone, message the provisioned line `PAIR <code>`.
3. Confirm the masked phone candidate in the owner menu. Receiving a code alone grants no café access.
4. Send a request such as `Inspect stock and propose a restock`. The existing manager handles it with the existing sponsor-data guard.
5. To execute, send `APPROVE <exact proposal UUID>`. `DECLINE <UUID>` rejects a proposal. A casual `yes` is not consent.
6. Inspect the actual manager receipt, cash and stock on both game clients. Confirm receipt on the physical phone and Photon delivery status.
7. Revoke the pairing from the owner menu when finished. Replacing the room pairing invalidates the old one. Restart invalidates all pairing codes and pairings.

The bridge never accepts room/member IDs from message text. It binds the signed sender and space to the authenticated owner. The manager still enforces ownership, proposal expiry, affordability, fresh state, and exact-once transaction behavior. No new AI manager or provider-data exception is introduced.

## Demo delivery limitation

This free Render application holds rooms and pairing in memory. The receiver processes requests synchronously and must return success only after processing and outbound API acceptance. It does **not** implement the durable event-and-work queue recommended by Photon. A provider run plus outbound request may exceed Photon's 20-second delivery timeout. A timeout can therefore coexist with a completed manager action; inspect receipts before retrying.

The process deduplicates up to 1,000 verified event IDs without eviction, rejects additional events with 503, serializes manager work per room, and rate-limits paired senders. An ambiguous outbound failure is retained as an error for that event; it does not automatically rerun the action or resend a different reply under the same idempotency key. Inspect the provider message and game receipt to resolve it. This prioritizes avoiding duplicate spending over guaranteed delivery.

**No durable delivery or restart-recovery guarantee is claimed.** After a restart the old room and pairing no longer exist, so a replay cannot regain owner authorization. Production delivery reliability would require an approved durable queue/store; none is added to the free hosting architecture.

## Acceptance still required

Local tests cover real signature verification, tampering, timestamp expiry, project mismatch, pairing confirmation/expiry/revocation, guest rejection, exact proposal approval, duplicate webhook handling, cash/inventory effects, and ambiguous outbound failure. They use a fake transport and local manager; they are not phone/provider evidence.

Remaining: provisioned project/agent/line, selectable event version, secret configuration, actual signed public callback, physical phone pairing and explicit approval, provider delivery receipt, two-client state changes, and denied/duplicate/expired tests against the configured flow. Voice is a separate later gate: actual provisioned telephone number, [official SIP cookbook](https://photon.codes/docs/beta/cookbooks), speech/confirmation and spoken receipt. Browser crew WebRTC is not Photon Voice.
