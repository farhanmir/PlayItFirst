# Photon Beta messaging and voice setup

## Choose exactly one messaging transport

`PHOTON_MESSAGING_TRANSPORT=bounded-inbox` is the default and follows the current owner demo plan. It enables only the explicitly started ten-minute inbox session below; the signed webhook receiver remains unavailable. Set `PHOTON_MESSAGING_TRANSPORT=webhook` only when using a configured signed destination; inbox polling is then disabled. An unknown value disables both messaging paths. Voice can be configured independently in either mode. Never run two messaging consumers for the same project.

Signed-webhook pairing requires a team activation code. Bounded-inbox and voice sessions use authenticated café ownership and the approved sender list; they no longer require that activation code. Both paths require `ALLOW_SPONSOR_PHONE_CONTEXT=true` before exporting restricted real-property context. Configuration alone does not imply delivery or sponsor authorization.

## Signed webhook messaging mode

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
| `PHOTON_TEST_SENDER` | Exact approved human iMessage handle |
| `PHOTON_ACTIVATION_CODE` | Separate random 32+ character team activation code |

Create the destination in the existing Photon project only after the receiver route is deployed. Use `https://playitfirst.onrender.com/api/photon/webhook`, select API version `2026-07-01` and the iMessage received-message event. Verify that this version/event is selectable in that project's catalog. No subscription, line purchase or paid provisioning is performed by this code.

## Owner pairing and action contract

The host connects through the existing authenticated WebSocket session. The server calls `PhotonBridge.start(actor)` only after confirming the member is the room owner. Pairing state must be unicast to that owner, never broadcast to guests.

1. Enter the team activation code and create a pairing code in the owner menu. The random 12-character code expires after five minutes.
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
## Bounded inbox demo and telephone voice setup

This implements a bounded owner-initiated iMessage inbox demo and an authenticated voice tool bridge, not a verified physical call or production-grade inbox consumer. No new host or second manager. Actual provider setup and device tests remain necessary. All credentials belong in ignored local .env and Render Environment.

## Messaging (first)

Official [Photon Beta iMessage walkthrough](https://photon.codes/docs/beta/get-started/imessage), [list messages contract](https://photon.codes/docs/beta/api-client/sdk/projects/list-messages), [send message contract](https://photon.codes/docs/beta/api-client/sdk/projects/send-a-message).

1. In https://app.beta.photon.codes/ open your project and iMessage. Add the human phone number in E.164 format or exact Apple-account email used in Settings → Messages → Send & Receive. Assign a shared line from available plan capacity; copy the assigned agent number. The human must initiate the direct iMessage. Shared lines cannot receive telephone calls.
2. Set PHOTON_API_KEY (project key with project:read/write), PHOTON_PROJECT_ID, PHOTON_TEST_SENDER (approved human handles, comma-separated) and PHOTON_AGENT_HANDLE (assigned agent handle). No API key in client code. Bounded-inbox sessions do not use PHOTON_ACTIVATION_CODE. Do not buy a line or additional subscription without approval.
3. After deploying, host a fresh café. Open Menu → manager → Connect your phone → Start phone session. The owner token authenticates this request and stays in the browser/server. For restricted real-property rooms, the bridge is disabled unless ALLOW_SPONSOR_PHONE_CONTEXT=true is explicitly authorized; use a local mock/synthetic room first. The existing model-specific ALLOW_SPONSOR_MODEL_CONTEXT guard is separate and remains intact.
4. Text the displayed PAIR code to the assigned number from the configured human identity. Wait for real reply. Ask "Check milk and propose restocking supplies." Reply with exact APPROVE UUID from Jamie's proposal. Inspect authoritative inventory, $35 game receipt and second-client update. Send STOP or disconnect from the game to end. Refresh status in the menu; an accepted outbound request does not establish delivery.
5. Verify actual iMessage arrived and inspect Photon API Activities. Do not claim sponsor completion from a mock test or HTTP 202.

The server polls only during a deliberate ten-minute session, using the official GET /v1/projects/{id}/messages with received/iMessage/createdSince filters. Direct messages must match configured project, human and receiving agent identity. Pairing requires a cryptographically random code generated for a connected owner. Only one phone session per server is supported; 100 processed messages, three pages per poll, serial operations, stable outbound idempotency keys. On timeout/rate limit/provider failure polling pauses; disconnect and explicitly start a new session, do not blindly replay. Prior messages are excluded. No durable replay or inbox recovery; restart invalidates codes and rooms. This is intentionally a bounded hackathon demo, not the long-running event consumer recommended by Photon. The signed webhook path above remains available only in the mutually exclusive webhook mode; it is disabled in bounded-inbox mode. Future production work should use documented Socket.IO replay with durable cursor or signed webhooks with atomic durable acceptance.

## Voice (actual phone call via Photon SIP + ElevenLabs)

Official [Photon inbound voice quickstart](https://photon.codes/docs/beta/get-started/voice) and [ElevenLabs webhook tool guide](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools).

1. Reuse an eligible Photon number (dedicated iMessage, SMS or supported WhatsApp number). A shared iMessage assignment cannot take calls. Check credits and plan; ask sponsor before paying. Set PHOTON_VOICE_NUMBER to its E.164 number.
2. In ElevenLabs create/publish Jamie voice agent. In Deploy → Phone Numbers → Import from SIP trunk, import the actual Photon number, select the agent, and configure inbound media encryption Allowed. If inbound SIP credentials are enabled, set the identical pair in Photon. Leave outbound disabled.
3. Photon → Voice → correct number/profile → Enable inbound. Destination sips:sip.rtc.elevenlabs.io:5061, TLS, media encryption Auto (match provider). Check assigned profile; no outbound SIP password needed.
4. Generate a random 32+ character PHOTON_VOICE_TOOL_SECRET, set it on Render and as a secret Authorization header in ElevenLabs tool. Do not put it in prompt or model-visible arguments. Configure POST https://playitfirst.onrender.com/api/phone/voice with Authorization: Bearer <secret>, JSON body:
   - callerId: provider-supplied caller identity. An identity on PHOTON_TEST_SENDER can use the current owner session without speaking its code. This value must come from the authenticated provider, not a caller's spoken claim.
   - code: exact owner session code for callers not on the approved list (ask once, do not guess).
   - action: status | ask | approve.
   - question: required for ask; normal spoken question, <=1200 chars.
   - proposalId and approvalCode: required for approve. Read the exact pending action and cost. Only the game owner can issue the one-use code for that proposal using the manager button. Caller must explicitly read it back. Never infer or invent a code. Ask/status do not spend money. Set tool timeout to at least 30 seconds, allow for bounded model run.
5. Configure the voice agent to use authenticated caller identity or the current session code, report only returned facts, and require the exact proposal ID and owner-issued approval code before any simulated purchase. Keep provider secrets and game resume tokens out of model-visible arguments.
6. Start the game phone session as café owner, call the actual Photon number, supply the session code if the authenticated caller identity is not approved, ask for stock/restock, generate the voice approval code in game and read it to Jamie. Confirm actual speech, tool response, game receipt and two-player state. Do not record/share phone identities or codes. Disconnect at end.

Voice endpoint authenticates the provider tool with the secret and uses its approved caller identity or a fresh owner-issued session code. Purchases still require the separate one-time approval code, scoped to the exact proposal and expiring within 90 seconds. The endpoint can send a recap through the messaging adapter. Calls and recap delivery must be tested separately; a successful tool request is not proof of either. External voice providers can incur cost; no number purchase or live call was performed during this documentation cleanup.

## Validation

Run npm test, npm run typecheck, npm run build and the public smoke check. New unit tests use injected fake provider/owner, not real Photon. Verify physical iMessage and telephone audio independently. If provider setup is unavailable, existing local Jamie and crew WebRTC remain honestly labeled. Never expose a secret or bypass approval.
