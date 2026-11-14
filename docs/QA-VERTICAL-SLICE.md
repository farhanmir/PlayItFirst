# P0 QA — vertical slice (issues #4 and #2)

Branch `cursor/p0-qa-vertical-slice-8f0f`, based on `main` at `799a904`. The first pass on that commit measured five gameplay gaps and left them as todos. This update fixes those gaps in the existing simulation and turns the todos into passing tests.

A physical phone was not used. Public CoStar, Matterport, Nessie, Deepagents, and Photon credentials are unset in this environment, so those sponsors stay labeled fallback.

## Commands

| Command | Result |
| --- | --- |
| `npm test` | Exit 0. 11 files, **58 passed**, 0 todo. |
| `npm run typecheck` | Exit 0. `tsc --noEmit`. |
| `npm run build` | Exit 0. Vite client build. Existing chunk-size warning for `dist/assets/index-*.js` (about 1.3 MB). `dist/` is gitignored. |

## Fixes now covered

- **Serve.** A sale is posted only when the player is holding `drink:<order>` and a waiting guest has that order on this player's ticket (or an unassigned ticket). An empty-handed serve at pickup, with a waiting latte at progress 0.5, leaves revenue, stock, and `customersServed` unchanged.
- **No clock sales.** `stepSimulation` does not sell a waiting guest when progress hits 1. Eighty steps (`dt = 0.25`) of an espresso guest with Jamie disabled leave revenue and inventory unchanged. Jamie still serves through take → brew → serve.
- **Collect.** Two collects add no sales row and do not change revenue or balance. The sale remains the one posted at serve.
- **Restock.** Balance `$10` refuses the `$35` restock and does not change stock. Balance `$100` restocks once and ends at `$65`. Wages are skipped when the balance cannot cover them.
- **Brew.** A brew without an open ticket does not consume stock. A second `make_coffee` during the brew timer does not consume stock again.
- **Navigation.** Guests steer around station clearance (`0.75`) instead of interpolating through it, and they stay inside the room while queueing. Moving a machine onto the remaining walk makes the next steps go around it. A chair line that would seal the entrance from the counter is rejected and not charged. `avgWaitSec` is the mean sim-seconds guests have spent ordering or queueing (8 steps of 0.25s → `2.0`), not wall-clock `Date.now()`.
- **Join origin.** `requestOrigin` uses `X-Forwarded-Proto` (or a TLS socket) so a proxy can emit `https://host/?room=…`. With no forwarded proto, the URL stays `http://`. The page still opens `wss` only when it was loaded over `https:` (`client/lib/net.ts`).

Shared room join, resume, the matched `$7` latte, and live counter/pickup broadcast tests from the first pass still pass.

## Local socket smoke

The first pass smoked `ws://127.0.0.1:5173/ws` against the server that was already running this checkout before these fixes. Room `809472`, join URL `http://127.0.0.1:5173/?room=809472`. That process is not this build.

This build was started with `PORT=5175 npm run dev`. `GET /api/health` returned `{ ok: true, service: "softopen" }`. `POST /api/rooms` with `Host: cafe.example` returned `http://cafe.example/?room=20f7bf`. The same call with `X-Forwarded-Proto: https` returned `https://cafe.example/?room=46b8be` and an SVG. That is a local proxy-header check, not a phone scan.

The two-client cases in `server/vertical-slice.test.ts` and `server/ws-smoke.test.ts` cover join, resume, inventory, and furniture broadcast against the updated room server.

## Sponsor status

Checked the environment for `COSTAR_API_URL`, `COSTAR_API_KEY`, `MATTERPORT_TOKEN`, `MATTERPORT_SDK_TOKEN`, `NESSIE_KEY`, `DEEPAGENTS_API_KEY`, `DEEPAGENTS_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PHOTON_API_KEY`, `PHOTON_APP_ID`, and `LANGCHAIN_API_KEY`. All unset.

- CoStar stays `costar-mock`. Matterport and Nessie stay off. Do not describe a live lease or a matched scan.
- `getCafeState`, `reorderSupplies`, and `adjustStaffing` are local validated tools (`server/deepagents.test.ts`). `hostedRuntime` is false. They are not a Deepagents product runtime.
- Photon messaging is still the in-app regex chat. No provider token is available, so no iMessage path was added. Crew voice stays WebRTC and is still labeled as not Photon 2.0.

## Demo checklist

1. **Origin.** On a deployed HTTPS host, `POST /api/rooms` with `X-Forwarded-Proto: https` should return `https://<that-host>/?room=<code>`. Reject a judge run whose QR is `localhost`.
2. **Socket.** The phone page should use `wss://<that-host>/ws`.
3. **Two-minute flow.** Two clients, one paid order (one stock decrement, one sales line), then move the counter and pickup and confirm the other screen. Guests should walk around a station placed on the path.
4. **Failover.** Resume token keeps the same player id. Covered locally. A radio or sleep drop on a phone was not run.
5. **Reset.** No room-reset message. `demo_boost` reseeds the current room. A clean floor is a new `POST /api/rooms`.
6. **Sponsors.** Badges stay mock until credentials exist.
