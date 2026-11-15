# Play It First — Progress (Issue #2)

Tracking https://github.com/farhanmir/PlayItFirst/issues/2. Work directly on `main` under AGENTS.md.

## Remaining working-tree changes published

Owner authorized publishing all remaining changes: the previously preserved **Vitest5.1.0** package/lock upgrade and the local `overhaul-*` gameplay/build/first-person/phone-sized captures. These captures are historical mock-property evidence from the pre-merge character/control pass on port5195, not the latest public measured-floor build; the first-person capture predates the later foreground-cup correction. Its recorded cappuccino sale was $9 with exactly one milk/cup/bean consumed and a shared plant edit, with no browser errors. Latest combined validation is **132 tests across24 files**, typecheck/build passing. Private `.env`, sponsor data/responses and SSH credentials remain excluded.

## Deepagents status badge correction

The Deepagents status chip was hard-coded `on:false`, so it could never turn green after a real successful run. It now subscribes to the current room manager and displays **configured**, **verified**, or **local**. Green requires `runtime:deepagents` plus current-run `providerVerified`; a configured key alone is not presented as a verified integration. Sponsor-context blocking has an explicit tooltip. The successful synthetic Gemini test does not silently authorize model calls in a different real-property room.

Validation: **121 tests**, typecheck and build pass. Actual Edge UI fixture check verified configured stays unverified and a verified room snapshot turns the badge green. This browser fixture checks rendering only; actual provider proof remains the recorded live Gemini trace below. Public health still reported `6c9999d` during inspection, so the new badge requires Render deployment of this commit and a page reload.

## Live Gemini approval verified; safe failure diagnostics

Public Render **`07e55e52720f5bff8a95ff48c6c64aab4b3d3fff`** completed an actual two-client synthetic-room provider test. The completed runs identify **Google / `gemini-3.6-flash`**. No property was selected, so no sponsor listing or geometry was sent. Gemini inspected state and proposed exactly one $35 restock without spending; guest approval was denied. Authenticated owner approval invoked `execute_approved_action`, then `read_outcome`. Actual balance **$20,000 → $19,965**, inventory **milk24→36, cups40→60, beans30→45**, one stable transaction receipt; second client agreed and duplicate approval did not charge again. [Recorded receipt and trace](screenshots/gemini-public-approved-verification.json).

The earlier provider failure remains historical evidence with an **unconfirmed cause**; this successful run does not establish permanent availability. `07e55e5` adds allowlisted failure categories for HTTP429 quota/rate limits, auth/permission, invalid requests, unavailable models, provider errors, timeouts and malformed output. Raw provider messages/URLs/keys are never broadcast. Six regression cases verify classification, secret redaction and no financial mutation; no automatic retries were added.

The live model incorrectly described dollar-valued balances as cents despite executing the correct $35 transaction. `3751379` adds explicit `USD`/`dollars` tool metadata and instructions to quote exact amounts without dividing by100. The full tool workflow above was verified before that narration correction; corrected narration still needs live confirmation. **121 tests across24 files**, typecheck/build pass (existing bundle warning). Safely merged teammate main through `6c9999d`, preserving superior art, authoritative collision/controls, provider identity, Nessie reconciliation and Photon transport groundwork, plus our tested order/blueprint/sound/touch fixes. Pre-existing local dependency edits and untracked prior screenshots remain intact. Render-only `GOOGLE_API_KEY` is sufficient; no local key or separate Deepagents enable flag is required. Issue #8 updated with actual evidence.

## Character polish — first pass

Safely merged teammate `fdb5816` (expired-drink recovery and nearby service-station acceptance) before pushing; preserved both progress sections and all uncommitted dependency edits. Combined main passes **82 tests across 18 files**, typecheck and build.

Improved the original procedural characters with consistent toy-like proportions, varied skin/hair silhouettes, ears, cheeks, eye highlights and brows, collars, buttons, sweater trim and student backpacks. Baristas now have articulated shoulder pivots, visible hands/shoes and a carrying pose. Removed the player's emissive shirt; fabrics use softer roughness. Customer walking/bobbing now follows actual interpolated movement and eases to rest instead of walking in place throughout queue state. These are inexpensive original meshes; no downloaded character assets or simulation changes.

Verified the rebuilt production game locally in Edge with WebGL: one keyboard-driven americano order produced one $9 sales receipt, consumed one cup/bean and left milk unchanged. Two browser clients shared a plant placement, with zero page/console errors or failed requests. Evidence: [gameplay](screenshots/character-gameplay.png), [served](screenshots/character-served.png), [build](screenshots/character-build.png), [phone-sized viewport](screenshots/character-phone.png), [assertions](screenshots/character-verification.json). This is a first visual pass, not a claim of a completed art overhaul or physical-phone performance testing. Public screenshots in the following section show the previously deployed appearance; this pass still needs deployment confirmation.

## Public Render browser verification and sponsor handoff

**Actual URL: https://playitfirst.onrender.com/**. Read issue #6 and posted coordination for Hrudai (`hssannidhi80`), who retains deployment ownership. The deployed SHA is **not yet established**: the current health response has no commit field and Render Events/dashboard access is unavailable. Added `/api/health.commit` from Render's `RENDER_GIT_COMMIT` for subsequent deploys; never infer the deployed SHA from local main. Free plan and restart/cold-start behavior still need dashboard/physical-device confirmation.

Public `scripts/check-deployment.mjs` passes. `/`, `/?demo=1`, `/api/health`, `/api/properties` and `/api/integrations` return successfully. Real **Edge headless with WebGL software rendering**, desktop 1440×900 plus a second 390×844 browser viewport: judge demo starts with zero served, keyboard E takes an order, WASD reaches the espresso machine, E brews, and E at pickup serves one mocha for **$10**, consuming exactly one milk/cup/bean. Exactly one sales receipt is recorded. This is browser-driven keyboard gameplay, not a physical human/phone test. Both public clients joined the same room and received a new plant placement. No page/console errors, failed requests or insecure HTTP/WS requests; socket is `wss://playitfirst.onrender.com/ws`. Evidence: [gameplay](screenshots/public-gameplay.png), [served](screenshots/public-served.png), [build](screenshots/public-build.png), [phone-sized viewport](screenshots/public-phone.png), [recorded assertions](screenshots/public-verification.json). Physical QR scanning, touch interaction, real GPU performance and measured customer-rerouting effects are not verified by this check.

**Confirmed public integration status:** CoStar **mock**; Matterport, Nessie and Deepagents **unconfigured**. Crew voice is browser WebRTC, not Photon Voice; messaging is in-app routing, not Photon Messaging. None is called live merely because an environment variable exists. Gemini support is already implemented in `4b36e2a`; the local key is still absent, so actual model planning/approved execution/receipt remains blocked. No Nessie/Photon credentials are available locally. No restricted sponsor data was sent to an external model.

The ignored normalized `.sponsor/property.json` is **40,483 bytes** and contains the exact suite/model pair, **12 rooms, 66 physical walls, 11 door openings, four windows**, and **$11,047.50/month** base asking rent. `docs/DEPLOY.md` now gives Render Secret File `property.json` instructions and `COSTAR_DATA_FILE=/etc/secrets/property.json`, plus exact API/model/geometry checks after redeploy. Owner will notify us when the file and keys are configured. Until then public `costar-extract`, matched geometry/rent and live Matterport cannot be claimed. The issued SDK key only allows localhost; ask event support to authorize `playitfirst.onrender.com`. The current viewer is a Showcase iframe, not an SDK session.

Added a regression-tested server guard: imported/live sponsor rooms stay on local manager rules unless `ALLOW_SPONSOR_MODEL_CONTEXT=true` is explicitly set after authorization. Google key configuration alone cannot send that context to a model. Local approved restocks remain available. **79 tests, typecheck and build pass**; existing bundle-size warning remains. Pre-existing uncommitted Vitest dependency edits are preserved.

## Interaction recovery — November 14

Fixed the stuck held-drink path reported during the public playtest. When a customer leaves before pickup, the player can clear the unclaimed drink at the counter or pickup with E/Space, with no sale or inventory refund; then the next order can be taken. Station actions now accept any matching station within reach even if another station is slightly closer. Taking another ticket or brewing again cannot overwrite a held drink. The HUD names the clear action and prompts the player to move to a service station when out of range.

Regression coverage includes expired espresso recovery and serving from a valid counter that is not the nearest station. **81 tests passed across 18 files** after the Gemini dependency update; typecheck and production build were rerun. The precise phone interaction reported by the player still needs rechecking on the deployed build after this commit is pushed.

## Gemini provider and public transport verification (November 14)

Read the latest issue #8 comment. Added official `@langchain/google@0.2.10` `ChatGoogle` to the existing Deepagents manager; its peer range accepts our unchanged `@langchain/core@1.3.7`, and `npm ls` confirms one shared core instance. Google AI Studio uses `GOOGLE_API_KEY`, then `GEMINI_API_KEY` as an alias, ahead of existing OpenAI/Anthropic providers. `DEEPAGENTS_MODEL` remains configurable; Gemini defaults to tool-capable `gemini-3.6-flash`. Google calls have no retries, a bounded 2048-token output and low thinking; the existing four-turn/20-second deadline, four business tools, owner authorization, proposal expiry and idempotent execution remain intact. No second agent architecture or background polling.

Validation: **78 tests across 18 files**, typecheck and build pass (existing large-client-bundle warning). Added provider/alias/precedence tests and an actual Deepagents + ChatGoogle tool-call round trip with mocked HTTP, including Gemini function declarations and function responses. This is adapter/framework evidence, **not live Gemini evidence**. `scripts/check-gemini-manager.ts` is an explicit real-provider check using only a hard-coded synthetic property: planning without mutation, denied guest approval, owner-approved $35 restock, fresh read_outcome and duplicate approval without a second purchase. It does not import sponsor data. Running it currently stops before any network request because neither Google key is configured; the supplied chat example was a placeholder. Project-specific model availability/quota, live approval/execution and two-browser Gemini evidence remain blocked on a real local/server key. Issue #8 stays open. No sponsor records were sent to any model. Deployment documentation includes keys, precedence and this check. The pre-existing uncommitted Vitest upgrade is preserved separately from this focused provider commit.

The owner supplied `https://playitfirst.onrender.com/`. The deployment smoke check passed against that public origin: health, built page/asset, mock listings, correct invite origin, two-client HTTPS/WSS join/open, furniture move/rotate synchronization and reconnect. This supersedes the earlier missing-public-URL blocker; it does not prove WebGL, physical-phone QR scanning, a human paid order or live model integration on Render. No new screenshots were captured for this server-only provider change; prior gameplay/build evidence below remains applicable.

ChatOverflow work is discontinued by owner direction; issue #11 targets SpaceXSI only. Wilf's SSH now authenticates successfully. No remote files changed: the authorized Hackathon filesystem path is still unknown, and the remote Herdr skill disallows controlling its focused session from an external shell.

## Measured place → animated game

Replaced the imported suite's assumed rectangular floor with the actual captured single-floor topology: **12 room polygons, 66 physical walls, 11 doorway openings and four windows**. All 72 source edges are processed; six invisible room dividers are omitted as physical walls. A room boundary containing wall spurs is reduced to its enclosing polygon while the spurs remain physical walls. No rooms are dropped. Multi-floor captures are explicitly rejected until supported rather than silently truncating the place.

`scripts/measured_floor.py` converts authenticated Model API data into meter-based game coordinates; `import-costar.py` now generates the measured `floorPlan`. The live mesh/textures are not reused. The scene rebuilds the captured structure with original wood/sage/plaster materials, cutaway walls, windows and proximity-opening doors. Existing animated customers, characters, equipment and build controls remain. Wall heights/materials, café equipment and the operating entrance chosen among measured exterior doors are game-design choices, documented as assumptions.

The server and optimistic movement share measured wall/door collision checks. Building outside room polygons or across walls is rejected. Customers use a cached navigation grid through real door gaps, reroute after furniture edits and enter/leave through a measured exterior doorway. Starter equipment is placed in a verified clear portion of the largest captured room. The manager reads measured room areas, entrance and layout counts. Mock properties retain their existing scene/simulation.

Validation: **75 JavaScript tests**, **3 Python converter tests**, typecheck/build green. Tests cover blocked walls, usable doors, routing through a partition, sealed-door reroutes, build rejection and malformed topology. Against the private real suite, a 44-waypoint route reached the counter from the selected entrance without crossing walls. Real Edge keyboard play took/brewed/served one cold brew for $9, consuming exactly one cup and bean; no JavaScript errors. A plant placement on the measured floor appeared on both desktop and phone-sized clients. Local evidence: `.sponsor/measured-gameplay.png`, `measured-build.png`, `measured-served.png`, `measured-build-ghost.png`, `measured-phone.png`, `measured-game-verification.json`. Synced teammate commit `f43874e` without losing either progress section; its deployment smoke check passes against the rebuilt production server on port 5187 with `costar-extract`, including two-client edit and resume.

The regenerated `.sponsor/property.json` must be supplied privately to Render to enable this scene there; no sponsor geometry or credentials are committed. This reconstructs the **whole captured suite**, not unscanned portions of the building. Actual external walkthrough rendering/publication clearance and real-phone/public deployment still need verification. The earlier rectangle/access limitations below are historical and superseded by this section.

## Open-issue audit

Closed **#4**: independent QA coverage and the original five production regressions are implemented, with fresh **72-test/typecheck/build** verification and existing browser evidence. Updated every remaining issue (#2, #6–#11) with concrete acceptance gaps; none was closed on partial sponsor evidence.

Fixed #7's missing pre-selection space preview: the property card now lazily opens the matching Matterport panel before committing to the property. Capacity is labeled assumed and traffic simulated for imported records; asking rent is explicitly base asking rent. Cleared stale model/open state on property changes. Edge verified the exact matched model in the iframe and the corrected labels; local screenshot `.sponsor/property-preview.png`. This verifies preview wiring, not the external viewer's complete rendering.

New live geometry probe supersedes the earlier access blocker: the matched model **does expose floor wall edges/vertices**, and the schema includes openings with relative center/width. Private source responses are `.sponsor/geometry-1.json` and `wall-availability.json`. Faithful reconstruction and route/starter placement validation remain implementation work; do not treat geometry as unavailable merely because the CDN floor-plan image returns 403.

Remaining gates: #6 public Render URL/physical-phone checks; #7 geometry reconstruction/publication clearance; #8 model provider key/live run; #9 Photon provisioning/public callbacks; #10 Nessie access plus adapter reconciliation; #11 Grok workflow/eligibility/submission. No model, Nessie or Photon keys were present in local configuration during this audit. Existing local Vitest upgrade remains uncommitted and intact.

## Authorized CoStar / Matterport pair — issue #7

The owner supplied the event kit and credentials. `scripts/import-costar.py` joins an active USD retail lease space's own Matterport floor-plan attachment to the kit's property/model CSV, then verifies that exact model through the live API. Credentials, archive, normalized local property and API responses stay in ignored `.env` / `.sponsor/`; no raw sponsor records are committed. `COSTAR_DATA_FILE` loads the vetted normalized file server-side with explicit `costar-extract` provenance. Existing mock fallback remains. Judge demo selects the imported property when configured.

Locally verified property **1018657**, listing **4105591**, space **21963212**, suite **104**, model **4H2JSnQ3wSj**. The live model title matches suite 104 and 2,946 SF; the suite's own attachment supplies the same model ID. Asking rate **$45/SF/year** × **2,946 rentable SF** / 12 = **$11,047.50/month**, excluding additional charges. Opening balance after rent and starter equipment: **$4,842.50**. These are asking terms, not an executed lease or verified café permission.

Corrected Matterport to documented server-side **Basic authentication (key:token)** and POST GraphQL variables; HTTP-200 GraphQL errors no longer count as live. Live query returned **one floor** and **228.0032 m² scan area**. Rentable listing area and captured scan area remain distinct. The playable footprint is an explicitly assumed 1.4-aspect-ratio rectangle scaled to scan area; **walls/doors/entrance have not been faithfully reconstructed**. The floor-plan CDN returned 403. SDK key currently authorizes localhost only; public SDK domain authorization remains necessary.

Edge browser verified the imported property, changed starting funds, real `/api/matterport` result, full-viewport scene and build mode with no JS errors. Screenshots are local `.sponsor/costar-gameplay.png` and `.sponsor/costar-build.png`, pending publication clearance. **72 tests pass**, typecheck/build pass. For Render, provide the authorized normalized file privately and set `COSTAR_DATA_FILE`, `MATTERPORT_API_KEY`, `MATTERPORT_TOKEN`; source code alone intentionally retains mock fallback. Vexcel has not been added to gameplay. Matched data/API access is now verified; geometry/public walkthrough acceptance remains incomplete, so issue #7 stays open.

## Play It First rename

Renamed the visible product, HTML metadata, café sign, blueprint export, package name and active project links. Git remote now points to `https://github.com/farhanmir/PlayItFirst.git`. Existing Render service identifier, API compatibility headers and save/resume keys are retained. Verified the production build in Edge, including the manager approval flow on two clients. Screenshots: [landing](screenshots/playitfirst-landing.png), [gameplay](screenshots/playitfirst-gameplay.png), [build](screenshots/playitfirst-build.png). All 70 tests, typecheck and build pass. Model credentials remain absent, so provider acceptance is still pending.

## Shared business manager — issue #8

Implemented official JS `deepagents` **1.16.5**, LangChain and OpenAI/Anthropic adapters. `server/manager-runtime.ts` invokes the actual graph with only four business tools; middleware blocks filesystem/delegation tools, limits model turns to four, and the room service enforces a 20-second deadline. No background LLM polling or automatic retry. The former direct-JSON director is removed; local director events remain.

`server/manager.ts` exports `CafeManager.request/approve/decline` with an authenticated `ManagerActor { roomCode, memberId }`. Future Photon messaging and voice must supply a verified paired owner identity, never identity parsed from message text. `ManagerRoom` supplies fresh state/reducer/publish callbacks; tools never write a pre-await snapshot. Owner-bound proposals expire after two minutes, approval uses the exact ID, duplicate approval reuses the receipt, and budget is checked at execution. Restock uses existing `reorderSupplies` → `applyRestock` → `applyTransaction`; the receipt includes the stable local transaction ID for Nessie reconciliation. Property tools include source IDs, dimensions, rent, area and explicit mock/unverified geometry caveats for #7.

The existing optional management menu now contains the shared manager, with approve/decline, receipts, status and concise tool trace. Legacy `photon_reply` routes to the same approval service; it no longer invents completed purchases or staffing assignments. New joiners cannot self-assign the owner role. Existing resume tokens still restore the original member.

**Evidence:** 70 tests pass, typecheck/build pass. `server/manager.test.ts` exercises the actual Deepagents graph with a scripted model, plus denied/cross-room/expired/duplicate/timeout/late-tool cases. `server/manager-ws.test.ts` verifies two-client purchase visibility and owner-role spoof rejection. This framework test is **not** a live provider call. Real Edge browser testing of the local fallback approved one $35 delivery (milk 24→36, cups 40→60, beans 30→45) and a free menu change; both appeared on a second browser. No JavaScript errors. [Plan screenshot](screenshots/manager-plan.png), [approved actions](screenshots/manager-approved.png), [actual local trace](screenshots/manager-verification.json).

**Credentials and demo:** set one capped `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` server-side, optional `DEEPAGENTS_MODEL`; local ignored `.env` now loads on Node 22 while Render environment values take precedence. Open Menu → ask Jamie to inspect milk/budget/queue → review proposal → approve exact cost → inspect receipt and updated inventory on both clients. No key is configured yet; **live provider acceptance remains blocked**, so #8 is not closed. External Photon/Nessie calls, real property matching and public Render verification remain owned by #7/#9/#10/#6. Coordination notes were posted to those issues.

ChatOverflow CLI confirms Codex connected as `@farhanmir` with one published field note. HackPrinceton leaderboard membership and SpaceXSI eligibility/Grok Bot access are not verified; official challenge/leaderboard pages could not be retrieved by the browser tool. No contest entry or public repository visibility change has been made.

## November 14, 2026 — Codex implementation and browser verification

Safely fast-forwarded `799a904` → `17e7f97` before editing. Preserved the owner's uncommitted Vitest 5 upgrade in `package.json` and `package-lock.json`; those edits are excluded from these commits.

- `66a93b6`: protect the first human sale, pace later AI assistance, reject overlapping/nonfinite/outside furniture placements and moves. Retain existing service-path checks, validated transactions and multiplayer regression coverage.
- `2d63c17`: wider café camera with correct character facing, readable camera-facing order bubbles, faces/glasses/hands/shoes, sage wainscoting and café lettering, visible daylight windows, raised espresso equipment, ceramic carried cups and corrected steam height. Hide overhead beams in elevated views.
- Service HUD: management/director calls stay behind Menu; fixed overlapping camera controls; brewing progress uses the authoritative sim clock; no repeated brew prompt while brewing; payment audio follows accepted sales. Hidden management drawer is inert to keyboard focus.
- Build: half-metre floor grid, green/red placement preview, rotation, move-existing selection and live shared updates. Server retains final path validation and reports rejected edits. Build remains local to the editor while others serve.
- Phone: continuous held movement reads the latest player position, pointer capture stops movement on release/cancel, keyboard movement clears on blur. Retained touch look and contextual service action.

## Actual verification

`npm test`: **63 passing, 0 TODO** across 13 files. `npm run typecheck`: clean. `npm run build`: successful. `npm ci --dry-run --include=dev --ignore-scripts`: successful. Checks ran with the owner's installed Vitest 5.1.0; dependency changes remain uncommitted.

Real Microsoft Edge browser with WebGL, driven through keyboard/pointer controls via Playwright. Desktop viewport 1440×900 and emulated iPhone viewport 390×844. Final run used the **built production SPA + production Node server on port 5174**, rather than Vite development imports. WebSocket frames were observed for assertions; the browser flow did not inject tickets, stock, payments or layout state.

1. Judge demo: zero sales and empty Jamie hands before the first player order. Regression also verifies that idling through a seeded rush leaves first-sale stock untouched. Jamie starts automatic work only after a completed sale and 18 seconds without human interaction.
2. Player: E takes ticket → keyboard walk to machine → E brews → progress/cup → keyboard walk to pickup → E serves. One matched sale, one cup and bean consumed; milk consumed for milk drinks. Earlier latte runs booked $7 and $10 depending on persona; see the final run's exact order/payment in [verification.json](screenshots/verification.json).
3. A separate phone-sized browser joined the same room. Holding its movement pad moved its player more than 0.5 world units.
4. Owner placed a plant through the build catalog/floor; both clients reached ten furniture items. Then moved the service counter to (6, 7.5), rotated it 90°, and verified the move/rotation on both clients while service remained open.
5. No browser JavaScript errors. Production `/api/health` returned `ok: true`. A proxy request with `Host: softopen.example` and `X-Forwarded-Proto: https` generated an HTTPS invite.

### Committed screenshots from the running game

- [Gameplay](screenshots/gameplay.png)
- [Brewing interaction](screenshots/brewing.png)
- [Accepted service](screenshots/served.png)
- [Build mode and ghost preview](screenshots/build-mode.png)
- [Move and rotation preview](screenshots/build-moving.png)
- [Phone-sized second client](screenshots/phone-join.png)

## Deployment and sponsor blockers

The existing `render.yaml` remains the preferred **free, single-service** deployment: Node 22, build with development dependencies, `npm start`, `/api/health`. Same-origin API/socket defaults require no Vercel service. Updated [DEPLOY.md](DEPLOY.md) to lead with Render and mark split hosting optional. Production serving and proxy invite behavior were tested locally. **No public deployment is claimed**: no Render CLI/account credentials or public service URL are available in this session. The owner was asked for a connected service URL. Render free cold starts and process restarts clear in-memory rooms; warm the service before judging.

`/api/integrations` confirms bundled **costar-mock**, no Matterport/Nessie/Deepagents credentials, and explicitly labeled non-Photon messaging/crew voice. Still need one authorized matching CoStar listing + Matterport scan, hosted Deepagents credentials/runtime access, and a provisioned Photon provider/channel. Existing optional integration functionality is preserved.

## November 14 deployment follow-up (issue #6)

- Updated this Windows checkout's remote to `farhanmir/PlayItFirst` and fast-forwarded clean `main` to `3e76ffa`, including the manager and product rename. GitHub CLI authentication was used for the fetch after the default Git credential prompt stalled.
- Added `scripts/check-deployment.mjs` and documented its local/public usage in DEPLOY.md. It checks the built demo page and JavaScript asset, health/listings, HTTP invite origin, two WebSocket clients opening the same room, live plant movement/rotation, and host resume without duplicating players. It creates a disposable room and does not invoke manager tools.
- Ran `npm ci --include=dev`, `npm.cmd test` (**70 passing across 15 files**), `npm.cmd run typecheck` (clean), and `npm.cmd run build` (successful; existing large-bundle warning). Node on this Windows machine is v26.13.0; Render's configured Node 22 runtime is not locally verified by this run.
- Integrated teammate commits through `852f730` before publishing this follow-up, then repeated verification: **72 tests across 16 files**, typecheck and build passed, and the deployment check passed against a restarted production server with the rebuilt assets. The lockfile was unchanged by these two commits.
- Ran the new check successfully against the built production server at `http://127.0.0.1:5184`. Listings reported `costar-mock`. An unreachable target correctly exited with status 1. This is HTTP/WS transport evidence, not public TLS, browser/WebGL, a physical phone scan, a human sale, or restart-recovery evidence. Existing browser evidence above belongs to the earlier run.
- Render integration was offered but is not connected in this session. No public service URL, service plan, deployed commit, or public two-device result is verified. Issue #6 remains open; connect the team Render account or provide the existing service URL, then run the same check and the manual checklist. No hosting service was created.

## Current limitations

- Browser automation is not a physical human/phone playtest. Public HTTPS/WSS and real-phone QR scanning remain unverified until Render is connected.
- Characters remain original procedural meshes, not fully rigged or licensed asset models. No performance/FPS claim for physical phones.
- Build move is select-then-click; direct object dragging is still absent. Ghosts show a simple volume/footprint, not the complete furniture model. Local bounds/overlap preview is conservative; the server can additionally reject a green preview if it seals a service path. Furniture uses circular clearance; imported walls/doors use measured segments and a navigation grid.
- Customer order bubbles can overlap in a long queue. More art and camera tuning may still be needed to reach the owner's visual-quality target.
- Vite reports the existing large bundle warning (about 1.35 MB uncompressed / 389 KB gzip). Tests/build pass; this is not a phone performance benchmark.
- No durable room saves. Bundled fallback data is mock; the authorized matched suite requires its private normalized file. Public deployment and the remaining provider integrations are not complete.



## November 14 — master-plan reconciliation and current finishing pass

Safely fast-forwarded main from `02219b7` to `03497a4`, preserving all uncommitted visual/control work. Read the canonical plan and related handoff documents. The documentation audit baseline is superseded by these fresh public observations at 2026-11-14 22:57 UTC:

- Public `/api/health.commit` reports `03497a43337b517e1c8988dece1d1175eb81b5c6`. Public properties now report `costar-extract` with the measured suite: 12 rooms, 66 walls, 11 doorways, four windows and the documented asking rent. No private source records were added to Git.
- Matching `/api/matterport` returns `matterport-live`. The matching panorama renders in a test iframe under the Render origin. This proves viewer origin access, not the complete property-picker flow or publication permission.
- `node scripts/check-deployment.mjs https://playitfirst.onrender.com` passed HTTPS/assets, two WSS clients, shared plant move/rotation and resume. This does not prove counter rerouting or physical-phone service.
- Chromium software-WebGL desktop and iPhone 13 emulation render the public measured suite without page errors. Restricted-property screenshots remain local pending publication clearance. The deployed HUD/art still predates the current local improvements.
- Actual public Deepagents execution succeeded in a synthetic room with no property selected. Owner-approved restock changed cash from $20,000 to $19,965 and added 12 milk, 20 cups and 15 beans on two clients. Guest approval failed; duplicate approval did not charge again. Sanitized trace: [provider-public-synthetic-verification.json](screenshots/provider-public-synthetic-verification.json). Provider/model attribution is not exposed by that deployment, so this is actual provider evidence, not yet Gemini-specific evidence. No sponsor context was sent.

Current local finishing work fixes reversed camera-relative movement, menu/orbit keyboard leakage, misleading out-of-range action prompts, and furniture collision. Visual work improves original character silhouettes, equipment, foliage, oak floor, window scenery and compact mobile HUD. These uncommitted changes are under integrated verification; public acceptance does not yet cover them.

Remaining external gates: physical-phone QR/touch/real-device performance, public shared counter routing evidence, sponsor publication/external-processing permission, Render Free-plan and restart confirmation, Gemini attribution, provisioned Photon identities/voice/callback authentication, actual Nessie credentials and remote receipts. Preserve the existing manager, Render service and measured reconstruction. No Vercel or ChatOverflow work.

### Local integration verification

Current combined run: `npm test` **106 passing across 22 files**, `npm run typecheck` passed, `npm run build` passed (existing large-bundle warning), `python -m unittest discover -s scripts -p 'test_*.py'` **3 passing**. An earlier run during concurrent provider edits failed imports/typecheck; integration repaired those failures before this successful run.

Chromium software WebGL actual keyboard service on the revised collision path: take cappuccino, walk around counter, brew, serve; authoritative state recorded one $10 sale, one milk/cup/bean consumed, empty hands. No injected gameplay state. iPhone 13 touch emulation on a stable production server verified held joystick movement, simultaneous second-touch look changing movement direction, release stopping movement, and no page errors. These are browser tests, not a physical-phone playtest.

Nessie migration now uses the documented v2 HTTPS/bearer/cents contract, opening balance, queued receipts during provisioning, bounded synchronization, read-only reconciliation, and explicit ambiguous/failure states without automatic replay. Six mocked-network tests pass; no sandbox key or real bank receipt was available. Photon has tested signature/text-transport primitives only; no inbound route, owner pairing or actual telephone provider is activated. See PHOTON_SETUP.md. Local crew voice and ledger no longer claim Photon/Nessie success.

Blueprint export now includes actual provenance, cents, measured geometry, equipment/rotation, retained costs/receipts, executed manager decisions, inventory, shift results, and explicit assumptions. Provider identity metadata is exposed only after a successful actual model run; failed/local/blocked runs clear stale provider proof.

### Final local service, route and export evidence

Safe mock-property browser screenshot and assertions: [polish-service.png](screenshots/polish-service.png), [polish-service.json](screenshots/polish-service.json). The two-client WebSocket test now compares the same seeded queued guest through the actual movement reducer before/after accepted counter relocation. Remaining walking distance changes from 0 to 4.006638 world units and the destination changes; both paths arrive. This proves the edit changes routing, not that the new layout is better. Public measured-floor counter rerouting remains a separate gate.

Actual Chromium UI export passed on an isolated production server: Judge demo → Menu → Plan → Generate → Download. Downloaded Markdown includes the selected property, current cash, rent/equipment receipts, decisions and honest zero-service limitation. No state injection or page errors.

Commits: ac35283 controls/collision/service and export; da73860 café art/HUD; 7da959e provider proof; f668b7e Nessie reconciliation; ddce01f Photon transport/status. Main push completed through b2ff7ee. Public deployment must still be checked independently for these changes.

### Latest public provider recheck

Render reported `b2ff7ee82b60d829277a810c712176cab658652d` at 23:05 UTC. One bounded synthetic-room provider attempt on that build failed after `get_cafe_state`, with no proposal or purchase. The run correctly returned `providerVerified: false`; provider identity was unavailable because the run did not complete. Evidence: [provider-public-b2ff7ee-verification.json](screenshots/provider-public-b2ff7ee-verification.json). No automatic retry. Historical successful execution on `03497a4` remains recorded, but does not establish current successful execution or Gemini attribution. Keep the live-provider release gate open.

### Updated public game acceptance

The new public build reported `b2ff7ee` and passed the deployment smoke on costar-extract: HTTPS/assets, two WSS clients, shared edit/rotation and resume. Updated measured-floor art and HUD rendered on desktop and iPhone 13 emulation with zero page errors.

At 23:07:49 UTC, actual keyboard service on the public measured floor passed: take mocha → brew → keyboard walking along collision-aware waypoints → serve. Observed authoritative state: served 0→1, revenue $0→$7, milk 24→23, cups 40→39, beans 30→29, holding null; zero page errors. No state injection. An earlier greedy direct-line approach hit furniture; that failed automation was not treated as proof of an unreachable station. Successful private screenshot/assertions remain in /tmp/pif-public-routed-* pending sponsor publication clearance.

Physical-phone QR/touch/performance, public measured counter-rerouting, current successful Gemini attribution, actual Photon/Nessie receipts, sponsor permissions and final human visual-quality acceptance remain open. No complete release claim.

Public SHA clarification: health immediately after the successful 23:07:49 service run reported `0b6dcd7d0fc9ffb3e4b56352335929d17c43f5f8`. The service script did not record its starting SHA. `b2ff7ee` belongs to the earlier smoke/render check; do not assign it to the later service run. These intervening commits changed tests/evidence only.


## Nessie business context completion — live key deferred

Safely fetched and fast-forwarded through `07e55e5`, `c3b53ae` and `aad93c5`, retaining teammate game fixes, safe manager diagnostics, explicit dollar units and recorded public Gemini proof. The newest canonical plan puts Nessie LAST. Completed the already-requested bounded pass without adding reserve/loan scope; no live banking calls or configuration were attempted, per the owner's instruction to ignore the key.

- Existing V2 account/deposit/withdrawal adapter is preserved. Added documented merchant purchases for inventory/equipment, fetched available funds and bills, and a next-calendar-month recurring rent bill. Bill API uses dollars; purchases use integer cents. Opening rent/equipment are already deducted from the initial account balance, and no automatic rent payment is added.
- Retained stable local receipt IDs, bounded queue, explicit rejected/unknown states and no automatic replay. Reconciliation compares against current local cash even when a sale occurs during asynchronous reads. Unsupported provider pagination fails visibly rather than claiming a complete reconciliation.
- Existing Jamie inspect/outcome tools now include local cashflow, actual retrieved bank state, freshness/errors, upcoming obligations and receipt states. All monetary tool values are USD dollars, including converted provider cents. Approvals and authoritative local affordability remain unchanged; local success is not called bank settlement.
- Existing finance menu shows exact cents, local versus retrieved cash/available balance, bill details, provider receipt IDs and simulated-only/pending/confirmed/failed/unknown states. No separate banking dashboard.
- Owner-only property selection, duplicate-selection no-op and resumed-socket ownership preserve an existing banking session across reconnects. Restart remains ephemeral: no automatic relink/replay, no durable banking-recovery claim.

Verification: `npm test` **132 tests across24 files passed**, `npm run typecheck` passed, `npm run build` passed with the existing bundle-size warning. Finance tests include merchant contracts, dollar/cents units, opening funds, insufficient provider funds, declined settlement, duplicates, ambiguous timeout, capacity and concurrent reconciliation. WebSocket tests cover duplicate selection, guest rejection and reconnect preservation. Actual Chromium production-build menu rendered $11,690.00 and exact opening expenses with explicit simulated-only status and zero page errors. Provider-state UI used synthetic rendering assertions; no actual Nessie account, sale, purchase or bill is verified.

Configuration and future acceptance steps are in DEPLOY.md and .env.example. Nessie key/live settlement remain deferred; core game, Photon and submission retain the canonical priority.

## Visual overhaul, mobile controls and home-screen app

Fetched and safely aligned main through `e0af720`, retaining teammate changes and the existing measured-property, simulation and provider systems. This pass follows the owner's renewed priority: game presentation and controls. Nessie live-key work remains deferred.

- Replaced the dashboard-like landing page with a game title screen, actual demo-café preview, one primary Play demo action, and compact host/join flows. Property cards draw supplied floor-plan geometry and retain source/assumption labels.
- Unified the café and interface around forest green, ivory, honey and walnut. Compact floating HUD, next-order ticket, contextual action key, accessible invite disclosure and less crowded management sections preserve existing functionality.
- Added two compact Kenney CC0 animated human assets, independent skeletons/mixers, authored idle/run motion, varied shirt colors and staff aprons. License and source attribution are in `public/models/crew`. Procedural bodies remain loading/error fallbacks. Held cups and existing service effects remain; these assets do not add bespoke ordering/serving animations or satisfy a photorealism claim.
- Walking now uses elapsed time at a shared desktop/phone pace. The phone stick retains analog magnitude, has a radial deadzone and visible thumb feedback. Collision permits safe sliding along obstacles, and only the accepted local position is sent. Blur, visibility loss, focus in inputs, pointer cancellation and help dialogs stop movement. Touch camera input cannot pan the game page or acquire mouse pointer lock.
- Added a standalone PWA manifest, app/Apple icons, optional install prompt and iOS instructions. Only the public offline explanation is cached. Rooms/API responses/gameplay are never cached; internet remains required and updates do not forcibly reload an active shift. See DEPLOY.md.
- Help uses native dialog focus/Escape behavior. Game surfaces contain touch gestures; management panels retain vertical scrolling. Modern Web Guidance informed native dialogs, touch target sizes, focus-visible feedback, eager hero loading and single-use install prompts.

Initial verification: 134 tests in24 files pass; typecheck passes. Desktop/mobile browser checks cover title/demo launch, host/join, empty-code validation, no horizontal overflow, expanded orders and invite QR. Chromium persistent-profile installability reports no errors; manifest MIME/icon dimensions, offline/reconnect behavior and cache contents pass with zero page errors. These are browser/emulation results, not physical-phone installation or performance acceptance. Final integrated service/build evidence follows below.

Integrated verification: full `npm test` **134 passing across 24 files**, `npm run typecheck` and `npm run build` pass. Vite retains its large-bundle warning (about1.46MB JavaScript uncompressed /419KB gzip), not a phone performance benchmark. Final UI canvas bounds match1440×900 desktop and390×664 mobile viewports. Help focuses its return button, Escape closes it, and holding W while Help is open leaves the authoritative position unchanged. Orders expand, QR opens, Build catalog appears, and the management drawer scrolls internally while page scroll remains zero.

Actual keyboard service on the revised controls completed an americano: served0→1, revenue+$7, beans30→29, cups40→39, milk24 unchanged, hands empty. CDP multi-touch movement/look changed the player's authoritative position and stopped on release; page scroll remained(0,0), viewport scale1 and no horizontal overflow or page errors. An initial zero-movement run during concurrent development/load did not reproduce; it was not counted as acceptance. See [control assertions](screenshots/controls-pwa-verification.json), [PWA assertions](screenshots/pwa-installability.json), [desktop](screenshots/visual-overhaul-desktop.png) and [mobile](screenshots/visual-overhaul-mobile.png). All screenshots use the safe mock property. No gameplay state was injected.

Physical iOS/Android installation, real-device multitouch/QR/performance and final human visual approval remain open. The PWA supplies installation and browser-gesture containment; it is not evidence that every phone/browser combination has been tested. Existing sponsor, measured-property publication and submission gates remain as previously recorded.

Final menu review also found and repaired a real mobile layout defect: the drawer's grid compressed an active floor-call event to29px and hid its text. Rows now size to content; browser inspection confirms a333px event with full text and all four touch-sized choices, using the drawer's single scrollbar. Typecheck/build passed again after this fix. Implementation commits: `21e0dee` PWA, `8c7e20b` animated crew/controls, `3fd88f8` menus/HUD.

### Public deployment confirmation

At2026-11-14 23:32:46UTC Render health reported `6989531e0cc65f6470c3ca40d4f634ba782390be`. Public deployment smoke passed HTTPS/assets, two WebSocket clients, shared move/rotation and resume. Manifest and both GLBs returned200 with valid contents. Actual desktop1440×900 and phone-emulated390×664 canvases match their viewports, with zero page errors, zero page scroll and no horizontal overflow. New animated characters render in the measured property. The title preview was checked after the image finished loading; an earlier DOMContentLoaded capture was premature, not a failed image.

Sanitized evidence: [public-visual-pwa-verification.json](screenshots/public-visual-pwa-verification.json). Measured-property screenshots remain private in /tmp. This verifies deployment/rendering and existing multiplayer smoke, not a new physical-phone test, public counter-routing measurement or successful external provider action. GitHub issues#2 and#6 were updated with this pass and remaining gates.

## Movement jitter, avatar diversity and building-fidelity correction

Owner feedback rejected movement smoothness, repeated faces and the apparent mismatch between the scan and the game. These are acceptance defects; the earlier passing static browser checks did not establish smooth motion or a near-exact recreation.

Confirmed and corrected:

- Server snapshots overwrote newer local movement. Sequence-tagged moves now receive processed/rejected acknowledgements; the client reapplies bounded unacknowledged predictions against current collision geometry. Reconnect clears old predictions. Actual browser input through a150ms each-way WebSocket delay proxy produced18 moves, zero backward regressions and exact final server/client agreement. Evidence: [movement-delay-verification.json](screenshots/movement-delay-verification.json).
- React also reset avatar positions on each snapshot, defeating render-frame interpolation. Stable initial transform props now leave smooth interpolation to render frames. Idle/walk clips blend continuously instead of restarting. Actual keyboard/scene sampling recorded30 samples,16 changing bone poses and zero backward steps or page errors. This is not a physical-device60fps claim. Evidence: [continuous-avatar-motion.json](screenshots/continuous-avatar-motion.json).
- Five distinct hair silhouettes, jaw/cheek proportions, skin/hair colors, heights and builds replace shirt-only variation. Accessories follow animated head bones. Safe mock screenshot: [avatar-diversity.png](screenshots/avatar-diversity.png).
- Official Matterport coordinates establish a real reflection defect: Model API x/y/z maps to Showcase/game x/z/-y. The old x/+y floor mapping mirrored the building. New imports use x/-y; narrowly identified legacy extracts migrate once and recompute a safe starter area. All12 rooms and66 walls remain; migrated topology retains a45-waypoint entrance-to-counter route and clear starter positions. Sources: [coordinate conventions](https://developers.matterport.com/overview/concepts/) and [vector data](https://developers.matterport.com/api/property-intelligence/vector-data/).
- The old renderer replaced all opening heights with fixed2.2m headers and2.8m walls, including a measured3.757m window. The shell now preserves measured opening heights, uses measured room/sill metadata when available, and estimates missing values explicitly. Original procedural pale herringbone, cream walls and framed glazing replace the invented sage treatment observed to differ from the tour. Only foreground-obstructing walls cut down in third person; full floor cutaway remains in Orbit. Original scan textures are not copied.
- Added bounded read-only enrichment through existing Matterport credentials for the same model's room labels/classifications, heights and sill elevations. IDs must match. Absolute elevations are normalized only with a source floor baseline. Geometry survives provider rejection/failure. Live verification follows deployment; mocked success does not prove current provider response.
- All12 room polygons contain reachable navigation cells. Previously all9 purchased items occupied one room, and a target-reset bug prevented waiting guests from walking toward seating. Guests now approach reachable table locations. Fresh layouts use verified Kitchen/Storage/dining labels for existing equipment when collision and route checks pass; unlabeled or unreachable rooms retain existing positions. No room functions, new financial charges or bathroom activities are fabricated. Interaction checks also reject operating equipment through measured walls.

Actual keyboard take→brew→serve passed on the locally corrected measured floor: one$7 espresso, beans30→29, cups40→39, milk24 unchanged, hands empty and no browser errors. Evidence: [corrected-floor-service.json](screenshots/corrected-floor-service.json). Scan and measured-floor screenshots remain private in/tmp.

**Near-exact interior is not complete.** The inspected tour includes original restaurant furniture, beams, exposed ducts, fixtures and finishes absent from the normalized file. An authorized3D export or fuller source data is still needed for exact positions and shapes. The owner was asked for its local path. Reconstructed finishes and a flat dark ceiling are not a textured scan replica. Physical-device smoothness and final human acceptance also remain open.

Local verification for this correction: `npm test`163 passing across29 files, `npm run typecheck`, `npm run build`, and6 Python importer tests pass. Final chair-group follow-up passed its two starter-layout tests and typecheck: associated chairs retain relative offsets when their table moves, with whole-group clearance checks and unchanged costs. The existing large JavaScript bundle warning remains; these checks are not a physical-device performance benchmark.

### Public corrected-floor and source-metadata verification

Render served `32e3e1898ab1da0b564575af2b0fd3c79400dbc7` at2026-11-14 23:55UTC. Public smoke passed. The actual property response confirms the corrected coordinate convention and authenticated Matterport enrichment:12 labeled rooms (3 user labels,9 unambiguous detected classifications),8 room heights and all15 openings with height plus original/normalized sill elevations. A fresh game's machine is inside the sourced Kitchen; nine items/$4,110 cost remain unchanged.

Actual keyboard service used28 route waypoints to the Kitchen and35 back to pickup: mocha served0→1, revenue+$10, one milk/cup/bean consumed, hands empty,106 movement inputs, zero page errors. Mobile-emulated canvas390×664 matches viewport without overflow. Evidence: [public-motion-fidelity-verification.json](screenshots/public-motion-fidelity-verification.json). Public measured screenshots remain private.

Storage placement did not pass on this build: fridge retained its safe fallback outside Storage. Follow-up diagnosis found the coarse customer route clipped rectangular equipment even though a valid detour exists; stricter placement reachability is being verified separately. No claim that every room has a new business function. Near-exact original interior and physical-device acceptance remain open.

Storage follow-up: the starter layout now searches every route edge with player wall/furniture collision rather than discarding a candidate after one clipped customer route. On actual authenticated property data locally, the machine is in Kitchen, fridge in Storage, tables/chairs in Main Dining Room; all9 items/$4,110 equipment/$4,842.50 opening balance are preserved. Selection took approximately150ms in this local check. Three targeted starter tests, including a counter detour into narrow storage, and typecheck passed. Public confirmation of this follow-up is pending deployment.
