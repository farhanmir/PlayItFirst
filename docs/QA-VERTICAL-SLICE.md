# P0 QA — vertical slice (issue #4)

Evidence for the shared-room, paid-order, layout-sync, and customer-path slice on `main` at `799a904` (Merge SoftOpen rebrand into main). Production code was not modified. Issue #2 remains the local agent's gameplay and sponsor work.

Repeatable coverage lives in `server/vertical-slice.test.ts`. Five acceptance cases that this `main` does not implement are `it.todo` entries in that file, with reproduction below. `npm test` stays green.

## Commands

| Command | Result |
| --- | --- |
| `npm test` | Exit 0. 10 files, **48 passed**, **5 todo**. Includes `server/vertical-slice.test.ts` (11 passed, 5 todo) and the existing `server/ws-smoke.test.ts`. |
| `npm run typecheck` | Exit 0. `tsc --noEmit`. |
| `npm run build` | Exit 0. Vite client build. Existing chunk-size warning for `dist/assets/index-*.js` (about 1.3 MB). `dist/` is gitignored. |

## What the new tests lock in

- Two WebSocket clients join one room code, see both players, and share property selection. A resume token returns the same player id. A wrong token seats a new player. A message before `hello` is rejected.
- `joinUrl` follows the origin it is given (`http://127.0.0.1:5173/?room=…` or `https://cafe.example/?room=…`). `qrSvg` returns an SVG for that URL. This does not scan a QR with a camera.
- A human latte order consumes 1 bean, 1 cup, and 1 milk at brew start, ignores a second `make_coffee` while the brew timer is running, and books one `$7` sale (`4.5 + student tip 1 + match bonus 1.5`) on serve. A second serve leaves revenue, `customersServed`, and stock unchanged. An empty bean or milk stock refuses the brew and posts no sale.
- With the room tick frozen, the other client sees that same inventory drop and `$0` revenue at brew start.
- Moving the counter and pickup during open service (tabletop sync and `move_furniture`) keeps the open ticket and stock. After sim steps, the queue target follows the new counter and a non-seated waiting guest follows the new pickup. The other client receives the new coordinates while `open` is true and the seeded crowd is still present.
- An entering guest walks to the counter and becomes the ordering head. Two queued guests keep distinct slots 0.7 apart. Moving the counter and pickup retargets them.

## Local two-client WebSocket smoke

This was a local socket client against the already-running dev server in this checkout (`tsx server/main.ts`, pid 2003, cwd `/agent/repos/softopen`, `127.0.0.1:5173`). A physical phone was not used. The vitest room server attaches WebSockets on the HTTP server directly; this smoke uses the production upgrade path `ws://127.0.0.1:5173/ws`.

Observed:

- `GET /api/health` → `200` `{ ok: true, service: "softopen" }`
- `GET /api/integrations` → `costar: "costar-mock"`, Matterport token unset, Nessie unset, Deepagents unset, Photon fields labeled as in-app WebRTC / regex chat
- `POST /api/rooms` → room `809472`, join URL `http://127.0.0.1:5173/?room=809472`
- `GET /api/rooms/809472/qr` → the same URL and a 5819-byte SVG
- Host and barista joined. Guest welcome included Host. Shared property `hou-midtown-1204`. Café opened (`phase: "play"`).
- After `demo_boost`, guest saw the counter move to `(5, 5)` and pickup to `(8, 4.2)` with 5 customers still on the floor.
- Host disconnected and reconnected with the resume token. Welcome id matched. Player count stayed 2 (host + barista).

`server/main.ts` builds that join URL as `` `http://${host}` ``. The scheme does not follow `X-Forwarded-Proto`. `client/lib/net.ts` opens `wss` only when the page itself is `https:`. A judge phone needs a reachable HTTPS origin; this environment did not provide one. `docs/PROGRESS.md` already records that deploy/LAN step as open for issue #2.

## Acceptance gaps (expected vs actual)

These were measured with a short `tsx` probe against the current simulation. They are not asserted as passing behavior, and production code was left as-is.

| Case | Expected | Actual on this main |
| --- | --- | --- |
| Serve books a sale only for a drink the player brewed | No revenue and no stock change when the player is empty-handed | Player at pickup, customer `waiting` with `progress: 0.5`, order latte, office persona, stock `{beans:30, cups:40, milk:24}`. `interact(..., "serve")` set revenue **+$8.5**, `customersServed` **+1**, state `happy`, stock unchanged, log `Alex served Nia`. |
| Waiting guests are not sold by the clock | Revenue comes from a fulfilled order that consumed stock | 30/30 trials. Waiting espresso guest, `progress: 0.85`, `footTraffic: 0`, Jamie disabled (`lastHumanInteractAt: 1e9`). Within 80 steps of `dt = 0.25`, `stepSimulation` posted **+$6.25**, stock unchanged, and wrote no serve line. Customer state became `leaving`. |
| Register collect needs an order | Collect does not invent sales | Two `collect` actions at the counter posted sales **12** and **12** (`revenue +24`) with `customersServed` still 0. |
| Restock cannot overdraw | Balance stays at or above 0 | Balance **10**, player at the fridge, `restock` → balance **-25**, stock increased. |
| Paths avoid occupied stations | A guest walking to the queue does not pass through a station | Queue guest at `(2.2, 8)`, slot `(2.2, 2.8)`, espresso machine moved to `(2.2, 5.4)`. First step interpolated to `(2.2, 4.1)`, crossing the machine, then continued to the slot and became `ordering`. No occupancy rejection. |

Reproduction shape for the serve gap: `selectProperty` → `openCafe` → `addPlayer` → stand on pickup → one `waiting` customer with `progress >= 0.45` → `interact(snapshot, playerId, "serve")`.

## Demo checklist

Use this on a deployed origin before the judge pitch. Items marked local were exercised in this run; the phone items were not.

1. **Origin.** Open the deployed site over HTTPS. `POST /api/rooms` (or the in-app host button) must produce a QR whose URL is `https://<that-host>/?room=<code>`. Reject the run if the URL is `http://127.0.0.1` or `localhost`. Local result: `http://127.0.0.1:5173/?room=809472`.
2. **Socket.** The phone page should use `wss://<that-host>/ws` (`client/lib/net.ts`). Local smoke used `ws://127.0.0.1:5173/ws` only.
3. **Two-minute flow.** Host selects Midtown (`hou-midtown-1204`), opens the café, and a second client is in the same room. Take one order at the counter, brew at the machine, serve at pickup. Confirm one sales line and one stock decrement for that drink. Move the counter and the pickup while guests are visible, and confirm the other screen shows the new coordinates. Local sockets covered join, open, the move, and resume. A timed UI playthrough on a phone was not run.
4. **Failover.** Turn the phone screen off or drop Wi-Fi for a few seconds, then return. The client retries and sends its resume token; the player id should stay the same and a third avatar should not appear. Local resume matched. A radio/sleep failover was not run.
5. **Reset.** There is no room-reset message. `demo_boost` reseeds a rush in the current room. A clean floor is a new `POST /api/rooms`.
6. **Sponsors.** `/api/integrations` on this machine reported CoStar mock, Matterport off, Nessie off, Deepagents off, Photon not 2.0. Do not describe those as live. Issue #2 owns replacing them.

## Limitations

- Physical phone, camera QR scan, and public HTTPS/WSS were not available here.
- The 20 Hz room loop is frozen inside the new socket tests so inventory and resume asserts are deterministic. The separate smoke above left the live loop running.
- Collision-aware routing, auto-sale removal, and the balance floor are unimplemented. They are documented here instead of being patched on this branch.
