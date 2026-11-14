# Photon Beta handoff

This is **transport groundwork, not an active integration or sponsor acceptance**. No webhook route, sender pairing, messaging identity, or telephone number is configured by these changes. Existing room manager remains the only business execution service.

Verified November 14, 2026 against [Photon Beta API reference](https://photon.codes/docs/beta/api-reference), [official OpenAPI](https://api.photon.codes/openapi.json), and [Beta webhook contract](https://photon.codes/docs/beta/message-delivery/webhook):

- Project-scoped bearer credentials and HTTPS `/v1/projects/{id}/messages`.
- Sending requires `senderId`, `spaceId`, text content, and a stable `Idempotency-Key`.
- HTTP 202 is asynchronous acceptance, not phone delivery. Verify subsequent provider delivery status.
- Webhooks use Standard Webhooks over the untouched raw body. Verify `webhook-id`, `webhook-timestamp`, `webhook-signature`; five-minute timestamp window. Event schema depends on the destination's selected API version and event catalog.

`server/photon-transport.ts` implements bounded verification and outbound plain text transport. Tests cover valid/tampered/expired signatures, body limit, exact request shape, non-success responses and mismatched project receipts. No live requests have been made.

## Required before connecting the manager

1. Integration owner supplies provisioned project, project API key, agent identity and supported messaging line through server secrets. Provision voice separately using the official [SIP cookbooks](https://photon.codes/docs/beta/cookbooks).
2. Select a destination payload API version and inbound-message event from the actual project catalog. Obtain its exact JSON schema and a signed sample. Save destination signing secret server-side. Do not reuse Stable Spectrum webhook schemas for Beta.
3. Add the raw-body bounded HTTP receiver only after the schema is known. Bind verified event sender and space to an expiring pairing code confirmed by the authenticated room owner. Never trust room/player IDs in text. Require explicit proposal-ID approval and revocable pairing.
4. Deduplicate verified event IDs before work. Public webhook guidance requires durable event/work acceptance; resolve that requirement with the existing ephemeral-room architecture before acknowledging queued mutations across process restarts. No database has been added.
5. Route paired requests to existing `CafeManager`; deliver actual receipts through the transport. Apply per-sender rate limits, serialize room actions and handle unknown/timeouts without fabricated success.
6. Capture real phone message, owner approval, two-client state change and provider delivery receipt. Voice requires actual telephone audio and separate proof; crew WebRTC does not qualify.

Do not enable a permissive placeholder webhook while provisioning is pending. Keep sponsor status unavailable until the actual provider path is verified.
