# Photon 2.0 — live demo setup

This implements a bounded owner-initiated iMessage inbox demo and an authenticated voice tool bridge, not a verified physical call or production-grade inbox consumer. No new host or second manager. Actual provider setup and device tests remain necessary. All credentials belong in ignored local .env and Render Environment.

## Messaging (first)

Official [Photon Beta iMessage walkthrough](https://photon.codes/docs/beta/get-started/imessage), [list messages contract](https://photon.codes/docs/beta/api-client/sdk/projects/list-messages), [send message contract](https://photon.codes/docs/beta/api-client/sdk/projects/send-a-message).

1. In https://app.beta.photon.codes/ open your project and iMessage. Add the human phone number in E.164 format or exact Apple-account email used in Settings → Messages → Send & Receive. Assign a shared line from available plan capacity; copy the assigned agent number. The human must initiate the direct iMessage. Shared lines cannot receive telephone calls.
2. Set PHOTON_API_KEY (project key with project:read/write), PHOTON_PROJECT_ID, PHOTON_TEST_SENDER (exact human handle) and PHOTON_AGENT_HANDLE (assigned agent handle). No API key in client code. Do not buy a line or additional subscription without approval.
3. After deploying, host a fresh café. Open Menu → manager → Connect your phone → Start phone session. The owner token authenticates this request and stays in the browser/server. For restricted real-property rooms, the bridge is disabled unless ALLOW_SPONSOR_PHONE_CONTEXT=true is explicitly authorized; use a local mock/synthetic room first. The existing model-specific ALLOW_SPONSOR_MODEL_CONTEXT guard is separate and remains intact.
4. Text the displayed PAIR code to the assigned number from the configured human identity. Wait for real reply. Ask "Check milk and propose restocking supplies." Reply with exact APPROVE UUID from Jamie's proposal. Inspect authoritative inventory, $35 game receipt and second-client update. Send STOP or disconnect from the game to end. Refresh status in the menu; an accepted outbound request does not establish delivery.
5. Verify actual iMessage arrived and inspect Photon API Activities. Do not claim sponsor completion from a mock test or HTTP 202.

The server polls only during a deliberate ten-minute session, using the official GET /v1/projects/{id}/messages with received/iMessage/createdSince filters. Direct messages must match configured project, human and receiving agent identity. Pairing requires a cryptographically random code generated for a connected owner. Only one phone session per server is supported; 100 processed messages, three pages per poll, serial operations, stable outbound idempotency keys. On timeout/rate limit/provider failure polling pauses; disconnect and explicitly start a new session, do not blindly replay. Prior messages are excluded. No durable replay or inbox recovery; restart invalidates codes and rooms. This is intentionally a bounded hackathon demo, not the long-running event consumer recommended by Photon. The prior Standard Webhooks verification helper remains available but no webhook is enabled. Future production work should use documented Socket.IO replay with durable cursor or signed webhooks with atomic durable acceptance.

## Voice (actual phone call via Photon SIP + ElevenLabs)

Official [Photon inbound voice quickstart](https://photon.codes/docs/beta/get-started/voice) and [ElevenLabs webhook tool guide](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools).

1. Reuse an eligible Photon number (dedicated iMessage, SMS or supported WhatsApp number). A shared iMessage assignment cannot take calls. Check credits and plan; ask sponsor before paying. Set PHOTON_VOICE_NUMBER to its E.164 number.
2. In ElevenLabs create/publish Jamie voice agent. In Deploy → Phone Numbers → Import from SIP trunk, import the actual Photon number, select the agent, and configure inbound media encryption Allowed. If inbound SIP credentials are enabled, set the identical pair in Photon. Leave outbound disabled.
3. Photon → Voice → correct number/profile → Enable inbound. Destination sips:sip.rtc.elevenlabs.io:5061, TLS, media encryption Auto (match provider). Check assigned profile; no outbound SIP password needed.
4. Generate a random 32+ character PHOTON_VOICE_TOOL_SECRET, set it on Render and as a secret Authorization header in ElevenLabs tool. Do not put it in prompt or model-visible arguments. Configure POST https://playitfirst.onrender.com/api/phone/voice with Authorization: Bearer <secret>, JSON body:
   - code: exact owner session code spoken by caller (ask once, do not guess).
   - action: status | ask | approve.
   - question: required for ask; normal spoken question, <=1200 chars.
   - proposalId and approvalCode: required for approve. Read the exact pending action and cost. Only the game owner can issue the one-use code for that proposal using the manager button. Caller must explicitly read it back. Never infer or invent a code. Ask/status do not spend money. Set tool timeout to at least 30 seconds, allow for bounded model run.
5. Voice agent system prompt: "You are Jamie, a friendly café manager. Ask the caller for their current Play It First session code before using the café tool. Use the returned facts and exact dollar amounts; do not invent metrics or say a purchase succeeded without an executed receipt. For an action, ask the caller to review the exact proposal in the game and generate the one-use voice approval code. Read back the cost and only submit approve with the explicitly supplied code and matching proposal ID. Never request the game resume token, provider API keys or bank information. All money and operations are simulated. If the tool fails, say so and ask the owner to check the game."
6. Start game phone session, call the actual Photon number, speak the session code, ask for stock/restock, generate voice approval code in game and read it to Jamie. Confirm actual speech, tool response, game receipt and two-player state. Do not record/share phone identities or codes. Disconnect at end.

Voice endpoint authenticates the provider tool with the secret and requires a fresh owner-issued session code; this proves possession, not caller-ID authentication. One-time purchase code is scoped to proposal and expires within 90 seconds. Calls must be provisioned and tested separately; a successful tool request is not proof of a real call. External voice provider can incur cost; no number purchase was performed. No live provider calls were made during this implementation.

## Validation

Run npm test, npm run typecheck, npm run build and the public smoke check. New unit tests use injected fake provider/owner, not real Photon. Verify physical iMessage and telephone audio independently. If provider setup is unavailable, existing local Jamie and crew WebRTC remain honestly labeled. Never expose a secret or bypass approval.
