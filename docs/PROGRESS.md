# Play It First — Progress (Issue #2)

Tracking https://github.com/farhanmir/PlayItFirst/issues/2. Work directly on `main` under AGENTS.md.

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

## Current limitations

- Browser automation is not a physical human/phone playtest. Public HTTPS/WSS and real-phone QR scanning remain unverified until Render is connected.
- Characters remain original procedural meshes, not fully rigged or licensed asset models. No performance/FPS claim for physical phones.
- Build move is select-then-click; direct object dragging is still absent. Ghosts show a simple volume/footprint, not the complete furniture model. Local bounds/overlap preview is conservative; the server can additionally reject a green preview if it seals a service path. Occupancy remains the existing radial clearance model.
- Customer order bubbles can overlap in a long queue. More art and camera tuning may still be needed to reach the owner's visual-quality target.
- Vite reports the existing large bundle warning (about 1.35 MB uncompressed / 389 KB gzip). Tests/build pass; this is not a phone performance benchmark.
- No durable room saves; sponsor property data is still mock. Public deployment and real sponsor integrations are not complete.

