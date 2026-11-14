# SoftOpen — Progress (Issue #2)

Tracking https://github.com/farhanmir/SoftOpen/issues/2. Work directly on `main` under AGENTS.md.

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

