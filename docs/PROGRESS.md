# Play It First — Progress (Issue #2)

Tracking https://github.com/farhanmir/PlayItFirst/issues/2. Work directly on `main` under AGENTS.md.

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

