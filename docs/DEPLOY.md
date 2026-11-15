# Play It First public deploy

**Render is the only production host.** The existing free single-service Blueprint serves the built Vite game, API and authoritative WebSocket rooms together at https://playitfirst.onrender.com/. The previous separate frontend deployment has been discontinued; do not recreate it.

## Render (free)

1. In Render, create a Blueprint from `farhanmir/PlayItFirst`, branch `main`, using the existing `render.yaml`. Confirm the service plan is **Free**.
2. The blueprint sets Node 22, `npm ci --include=dev && npm run build`, `npm start`, and health check `/api/health`. Keep development dependencies during build/runtime because `tsx` runs the server.
3. Remove any leftover `VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_PUBLIC_ORIGIN`, `FRONTEND_ORIGIN` and `CORS_ORIGINS` settings from the Render dashboard or local `.env`. The frontend now always uses the current origin. Put optional sponsor secrets only in the service dashboard.
4. Open the assigned `https://<service>.onrender.com/?demo=1`. Verify `/api/health`, a human take/brew/serve, then scan the invite QR on a real phone. Both clients must use the same HTTPS origin and WSS `/ws`; move furniture while both remain connected.
5. Warm the service before judging. [Render free services sleep after 15 minutes without inbound traffic and may take about a minute to wake](https://render.com/docs/free). Rooms are in memory and disappear on restart/redeploy. This is a demo service, with no durable saves.

Public service: **https://playitfirst.onrender.com/**. Public HTTPS/API/WSS and two-browser keyboard order/build checks passed November 14; see PROGRESS.md and `docs/screenshots/public-verification.json`. Confirm the active commit under Render Events; newer builds also expose Render's `RENDER_GIT_COMMIT` as `/api/health.commit`. A missing commit field on an older build is not proof of a particular SHA. Hrudai owns issue #6 and service configuration. Confirm Free plan in the dashboard; the public HTTP responses do not establish billing plan.

Local production verification: build, then run the server with `NODE_ENV=production` and a separate `PORT` (the npm start shell syntax works on Render/Linux; in PowerShell set those environment variables and run `node --import tsx server/main.ts`).

## Private measured property setup

To expand the private catalog, keep the event kit outside Git and set `COSTAR_KIT_PATH`, `COSTAR_KIT_PASSWORD`, `MATTERPORT_API_KEY`, and `MATTERPORT_TOKEN` in an ignored local environment. Run `python scripts/import-costar.py --candidates` to list active exact-area USD suites whose own Matterport attachment matches the kit's property/model table. Then run `python scripts/import-costar.py --suite LISTING_ID:SPACE_ID --suite LISTING_ID:SPACE_ID` with the existing suite and each new suite you choose. Every selected model must pass an authenticated Matterport query and measured-floor conversion before the output file is replaced. Review the generated ignored `.sponsor/property.json` and upload its complete JSON array to the same Render Secret File. Do not copy raw kit records or credentials into the repository.

1. Use the regenerated local ignored `.sponsor/property.json`, **not** a private API response or the original archive. It is a JSON array with one normalized property, about 40 KB. Validate it contains `floorPlan`: 12 rooms, 66 walls, 11 `doorway` openings and four `window` openings. Do not commit this file.
2. In the existing Render service, open **Environment → Secret Files → Add Secret File**. Set Filename to **`property.json`** and paste the complete local file contents into Contents. Render mounts it at **`/etc/secrets/property.json`**; [secret-file documentation](https://render.com/docs/configure-environment-variables#secret-files).
3. Add environment variable **`COSTAR_DATA_FILE=/etc/secrets/property.json`**. Add `MATTERPORT_API_KEY` and `MATTERPORT_TOKEN` separately as server secrets. The latter pair enables actual matched-model GraphQL lookups; an SDK key is not a substitute. Save/redeploy. No `VITE_*` secret variables are needed.
4. Check `/api/integrations`: `costar` must become **`costar-extract`**. Check `/api/properties`: selected ID **`costar-1018657-21963212`**, model **`4H2JSnQ3wSj`**, `monthlyRent:11047.5`, `sqft:2946`, and the geometry counts above. This is suite 104's matched capture, not unscanned parts of the building. The asking rent is $45/SF/year × 2,946 SF ÷ 12; additional charges are excluded.
5. Check `/api/matterport/costar-1018657-21963212`: it must report **`matterport-live`** and the same model, not merely a configured-key boolean. Open a fresh `/?demo=1` room and verify it selected that property and measured geometry; existing rooms retain their prior property. Test an order and shared build edit again.
6. Keep `ALLOW_SPONSOR_MODEL_CONTEXT=false` (default). Imported/live property rooms stay on local manager rules even with a Google key. Set it to `true` only after sponsor authorization for external model processing. Use the synthetic Gemini check below before any real-property manager test.

The supplied Matterport SDK key authorizes **localhost only**. Ask the event support team to authorize **`playitfirst.onrender.com`** before SDK use on the public site; [Matterport's SDK documentation](https://matterport.github.io/showcase-sdk/sdk_home.html) ties application keys to allowed domains. The current walkthrough panel uses a Showcase iframe, not an SDK connection, and the animated game reconstructs geometry locally. Server GraphQL success does not establish public iframe access, model sharing permission or SDK domain authorization. Test the walkthrough separately after the matched record is deployed.

## Repeatable deployment check (issue #6)

### Optional Deepagents manager provider

Set `GOOGLE_API_KEY` in the Render service environment (or ignored local `.env`) to use Gemini through the official `@langchain/google` `ChatGoogle` adapter. `GEMINI_API_KEY` is an alias; `GOOGLE_API_KEY` wins if both exist. Provider precedence is Google/Gemini, then OpenAI, then Anthropic. Existing `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` remain supported. `DEEPAGENTS_MODEL` overrides the chosen provider's model; remove an override belonging to a different provider when switching keys. Defaults are `gemini-3.6-flash`, `gpt-4o-mini`, and `claude-haiku-4-5-20251001`, respectively.

Google documents [Gemini 3.6 Flash with function calling](https://aistudio.google.com/docs/models/gemini-3.6-flash). Availability and quota must still be checked against your project. There are no automatic model calls, retries or purchases: owner requests use the existing Deepagents graph, four-model-turn/20-second limit, room authorization and exact proposal approval. No key means the labeled local fallback. Keys never belong in `VITE_*` or `render.yaml` values; the existing single-service blueprint needs no structural change.

For a bounded real-provider acceptance check, run `node --import tsx scripts/check-gemini-manager.ts` after adding a real Google key to `.env`. This uses an explicitly synthetic property, verifies planning spends nothing, rejects guest approval, approves one $35 restock, checks fresh outcome/inventory and duplicate approval. It never loads CoStar/Matterport files. Do not ask the manager to inspect a restricted real-property room until sponsor authorization for external model processing is established. This script tests the manager service; two-browser live-provider verification remains a separate acceptance check.

After deployment, run this once from a checkout with dependencies installed, replacing the example origin with the actual service URL:

```sh
node scripts/check-deployment.mjs https://YOUR-SERVICE.onrender.com
```

The check loads the built demo page and its JavaScript asset, validates health/listings and the server-generated invite origin, then connects two WebSocket clients to a new disposable room. It selects a property, opens service, moves and rotates a plant, checks both clients agree, and reconnects the host with its resume token. A failed assertion exits nonzero. Public URLs require HTTPS/WSS; loopback HTTP is accepted for local production checks. The script does not call manager tools or send sponsor messages.

Each run creates one in-memory room, which remains until the process restarts. This is a manual release check, not an uptime monitor. Run it against the team's service only. The initial HTTP request allows 90 seconds for a free-service cold start; wait for Render to finish starting if it returns a loading page.

For local verification in PowerShell, use a spare port:

```powershell
npm.cmd run build
$env:NODE_ENV = 'production'
$env:PORT = '5184'
node --import tsx server/main.ts
```

In a second terminal run `node scripts/check-deployment.mjs http://127.0.0.1:5184`. These environment variables affect only the first terminal; use a fresh terminal for `npm.cmd run dev`. The `.cmd` launcher works when PowerShell blocks `npm.ps1`; no execution-policy change is needed.

Passing this check does **not** verify WebGL, a physical phone scanning the QR, a human paid order, customer rerouting, or recovery after process restart. Complete the manual checklist below and record the actual Render URL, deployed commit, Free plan, devices and results in issue #6. Keep the issue open until public verification is complete.

## Local defaults

Both local development and Render production serve the game and API from one origin. Client requests use relative /api/* paths and derive /ws and QR origin from the current page, using WSS on HTTPS. Keep the existing Render service, its secrets and auto-deploy from main.

## Retire legacy frontend hosting

In the old hosting dashboard, confirm the project is linked to farhanmir/PlayItFirst, then delete only that frontend project (or disconnect its Git integration if retaining the old deployment temporarily). Do not delete the GitHub repository or the Render Web Service. Removing configuration from GitHub alone does not shut down an existing hosted project.

## Checklist before claiming a public demo

- [ ] Two clients on the public frontend join one room
- [ ] QR opens the public frontend, not localhost
- [ ] Furniture move on one client appears on the other
- [ ] One paid order updates cash and inventory once
- [ ] No secrets in the client bundle (`VITE_*` only)


## Nessie V2 business banking

Use the existing Render service Environment or ignored local `.env`:

```dotenv
NESSIE_KEY=
NESSIE_URL=https://v2-prod-api.nessieisreal.com
```

Keep the actual key out of Git, browser variables, issue comments, screenshots and client bundles. Authentication uses a server-side Bearer header. The contract is the sponsor's [current OpenAPI](https://v2.nessieisreal.com/openapi.yaml). Account/transaction amounts use integer cents; bill amounts use dollars. No key means the local simulated ledger only.

The room owns one sandbox checking-account session. Opening funds already include the game’s opening rent and equipment deductions; those historical charges are not sent again. Accepted sales become deposits, supplies/equipment become merchant purchases, and other operating costs become withdrawals. A future rent bill records the selected property's monthly asking rent as a simulated recurring obligation. It is not paid automatically by the game and does not charge opening rent again. No lease or real-money payment is created.

Reconciliation retrieves provider account, transaction and bill records. The finance menu and Jamie distinguish local cash from the last retrieved sandbox balance, available funds, pending receipts, failures, unconfirmed writes, and upcoming obligations. Local approval and inventory safeguards remain authoritative; a recommendation is not an authorization to spend.

### Acceptance when a sandbox key is available

1. Configure the key on the server and start a fresh synthetic-property room. Confirm the provider account reflects the room's opening cash, including cents.
2. Manually serve one coffee. Approve exactly one $35 supply delivery through the existing manager. Repeat the same approval ID and verify only one local charge and one provider purchase.
3. Retrieve the provider account, matching transaction IDs/descriptions and future rent bill. Wait for provider settlement; compare posted and available balances with local cash and explain any pending holds or discrepancy. HTTP acceptance alone is not settlement.
4. Reconnect a second browser to the same room and compare local receipts and external statuses. Test insufficient local funds, explicit provider rejection and an ambiguous timeout. Never automatically replay an unknown external write.
5. Record the deployed commit and actual redacted provider receipts in PROGRESS.md/issue #10. Mocked tests do not satisfy live sandbox acceptance.

Rooms and reconciliation queues remain in memory. Reconnecting to a surviving room retains its synchronization state. Restart/redeploy loses the room and its pending queue; a new room creates a separate sandbox session and does not automatically relink or replay the old account. Inspect old provider records manually before any recovery action. This is not durable banking recovery.

## Phone home-screen installation

The same Render origin serves `manifest.webmanifest`, app icons and `sw.js`; no additional host is needed. Open the game in Safari on iPhone, choose Share → Add to Home Screen, and enable Open as Web App if offered. On Android, use the game's Install game button when available or the browser's Install app menu. Installation is optional; room links and room-code joining remain available in the browser.

The standalone game uses the phone viewport and safe areas. Movement and camera touch surfaces prevent browser panning; management panels retain their own vertical scrolling. The service worker caches only the public offline explanation, never rooms, API responses or gameplay pages. Internet is required. An update waits for old app tabs to close instead of reloading an active multiplayer shift.

Verify physical iOS and Android installation, QR join, simultaneous joystick/look/action touches, release/cancel, rotation and safe areas before claiming real-phone acceptance. Chromium installability and device emulation are useful checks but do not replace this gate.

## Corrected scan coordinates and room metadata

Legacy private extracts produced by this repository are corrected at load time only when their exact old provenance and matching Matterport model ID identify the old importer. The Model API uses Z-up coordinates; the game uses Y-up, so the correct mapping is x/-y into game x/z. The version marker `matterport-api-x-neg-y-v1` prevents a second reflection. No manual edit to the existing Render secret file is required for this migration. New imports use the corrected convention directly.

Existing server-side Matterport credentials optionally enrich that same model with room labels, room heights and opening elevations. Exact source IDs must match. Requests are bounded and cached, including failures; failed enrichment retains the corrected footprint. `floorPlan.metadataSource` and `metadataFetchedAt` identify successful source retrieval. Labels distinguish user labels from a single unambiguous detected classification. Missing or conflicting labels do not justify invented room functions.

Fresh measured rooms distribute existing equipment to a verified Kitchen/Storage and dining destinations only if safe placement and routes exist. Otherwise the starter layout remains unchanged. Costs and item counts are preserved. Redeploy clears ephemeral rooms, so test in a fresh room.

This is still a reconstruction. The file does not include original furnishing locations, textured mesh, ceiling beams or duct runs. Finish colors/patterns approximate the inspected walkthrough; missing vertical measurements use explicit estimates. Near-exact visual reproduction requires authorized additional source data; do not describe the game as an exact scan replica.

## Bounded multiplayer and HTTP resources

Rooms are created only through POST `/api/rooms`. Unknown or expired join codes return a terminal error. Defaults:32 rooms,12 members/room,5-minute abandoned-room grace; override with `MAX_ROOMS`, `MAX_ROOM_MEMBERS`, `ROOM_ABANDON_GRACE_MS`. All three game timers pause when the last socket leaves and are cleared on expiry. Resume retains identity, position and held item; the superseded socket immediately loses authorization. Disconnected avatars disappear, while their saved state remains within the room grace period. Heartbeats detect silent dead connections; a dropped connection can take up to60 seconds to disappear. Restart still loses all rooms.

JSON bodies are limited to16KiB; signed Photon raw bodies to64KiB, with10-second body deadlines. Room creation is bounded to6/client/minute and30 globally; property refresh to1/minute with a single in-flight load. Limiter storage is bounded. WebSocket payloads are capped at64KiB. Reconnect clients never queue offline mutations for delayed replay. On Render the conservative rightmost forwarded address can group clients behind a shared proxy; the global limit remains independent. These are lightweight demo safeguards, not a general authentication service or DDoS guarantee.

In `PHOTON_MESSAGING_TRANSPORT=webhook` mode, Photon's signed callback is POST `/api/photon/webhook`. `/api/integrations.photonMessaging` reports configuration readiness and missing/invalid variable names without exposing values. Read [PHOTON_SETUP.md](PHOTON_SETUP.md) for actual provider project, sender, signing secret and owner pairing. A configured key or accepted response does not establish phone delivery. The receiver processes synchronously before acknowledging success; its replay/room state is in memory and is not durable across restarts.
## Active Photon and live Nessie acceptance

See [PHOTON_SETUP.md](PHOTON_SETUP.md) for exact messaging and voice dashboard setup, owner pairing and voice approval. Configure all phone secrets on the existing Render service; no webhook URL is necessary for the default `PHOTON_MESSAGING_TRANSPORT=bounded-inbox` demo. The two messaging consumers are mutually exclusive. Voice tool URL is https://playitfirst.onrender.com/api/phone/voice. Sponsor phone-context permission is separate from model permission.

Nessie is now reactivated by owner request. With real sandbox key in ignored local .env, run `node --import tsx scripts/check-nessie.ts --live` once. This creates a synthetic $1,000 account, a $9 sale deposit, $35 merchant purchase and future $300 rent bill through the production ledger adapter, verifies remote IDs, settlement and $974 balance via read-only reconciliation. No real money and no automatic retry of writes. If uncertain, inspect the existing account before another attempt. This proves adapter/provider contract only; follow with actual manual coffee and owner-approved restock in a fresh game room. Do not expose keys or restricted records. Keep local-only behavior if key absent.

### Protect the public sandbox budget

Render never auto-provisions a bank account on property selection. Configure NESSIE_KEY plus a random 32+ character NESSIE_ACTIVATION_CODE on Render (separate from the provider key). In the selected café's owner-only Finance menu choose Connect Nessie sandbox and enter that activation code. Only the active authenticated owner with the code can attach an account. The server limits provisioning to three attempts per process, including unknown results; don't restart just to evade this budget. Existing local charges before activation are included in opening cash, not replayed as new transactions. Activate before first sale for clean evidence. Local development without a code can still auto-provision, capped at three. Real CoStar-derived opening balance and rent are not sent to Nessie unless ALLOW_SPONSOR_BANK_CONTEXT=true with explicit data permission; use a synthetic property for initial live verification. This flag does not authorize external model or phone processing.
