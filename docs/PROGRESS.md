# Play It First — Progress (Issue #2)

Tracking https://github.com/farhanmir/PlayItFirst/issues/2. Work directly on `main` under AGENTS.md.

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

