# SoftOpen — Progress (Issue #2)

Tracking **P0: Prove real-property playable vertical slice and replace sponsor stand-ins**  
https://github.com/farhanmir/SoftOpen/issues/2

Also following **AGENTS.md game-first direction** (owner playtest: must feel like a game, not a dashboard).

Branch: `main` (direct commits per owner / AGENTS.md workflow).

## Done this session

| Item | Status |
| --- | --- |
| Economy / navigation defects from QA PR #5 | ✅ On main (`serve` needs drink + ticket, no clock auto-sales, collect does not mint cash, restock/wages need funds, station clearance + sealed-path reject) |
| Immersive full-viewport game shell | ✅ Canvas fills the viewport; manage/finance/integrations live behind Esc Menu |
| Contextual E / Space interact | ✅ One primary action prompt; desktop action grid hidden during immersive play |
| Daylight café look + set dressing | ✅ Warm lighting, wood counters, pastry case, cup shelf, POS, apron’d walkers, order bubbles |
| Third-person default camera | ✅ Elevated follow cam clamped inside the room (fixed exterior-wall / ceiling occlusion bugs) |
| Sims build overlay (Tab) | ✅ Floating catalog + orbit camera; other players keep serving; furniture sync verified |
| Judge demo no longer auto-plays the first order | ✅ Parks host at counter; player takes the order |
| Vercel + Railway / Render split config | ✅ `vercel.json`, `render.yaml`, `.env.example`, `docs/DEPLOY.md`, `VITE_API_BASE_URL` / `VITE_WS_URL` / `VITE_PUBLIC_ORIGIN` |
| Vertical-slice regression tests | ✅ **59** passing |

## Browser evidence (this run)

Headless Chrome against local `http://127.0.0.1:5175/?demo=1` (WebGL canvas ~1438×898):

- Immersive third-person play: `/opt/cursor/artifacts/immersive_cafe_play.png`
- Build mode catalog + live floor: `/opt/cursor/artifacts/build_mode_overlay.png`
- After contextual take-order: `/opt/cursor/artifacts/immersive_after_interact.png`

## Verified gameplay (authoritative WS)

Against the same local Node server:

1. **Order loop** — take ticket → brew → finish drink → serve: `customersServed` +1, `finance.balance` +$10 for office latte tip path, cups/beans decremented once, holding cleared.
2. **Two-client build sync** — host `place_furniture` decoration; guest snapshot furniture count increased and saw the plant at the placed coords.
3. **`npm test`** 59 pass · **`npm run typecheck`** clean · **`npm run build`** green.

## Still blocked / needs team or owner

| Item | Blocker |
| --- | --- |
| Matched CoStar listing + Matterport scan | Event toolkit credentials unset |
| Hosted Deepagents runtime | No `DEEPAGENTS_*` / model keys; local tools exist |
| Photon 2.0 messaging | No provider token; crew WebRTC + in-app chat remain labeled |
| Public HTTPS/WSS URL | Needs owner Vercel + Railway/Render projects; configs ready |
| Physical phone playtest | Not run in this cloud environment |
| Art fidelity vs “would play 10 minutes” bar | Procedural meshes improved but still stylized/low-poly; further licensed assets welcome |

## Remaining game-feel limitations

- Customers / player are stylized capsules (walk/idle), not fully rigged characters.
- Build mode uses orbit “monitor” camera rather than a polished isometric Sims camera with ghost previews / snap gizmos (placement + invalid feedback still basic).
- Floor Captain rush cards still appear during service (compacted); true “silent until opened” may need another pass.
- Jamie AI assist still covers the line when the human is idle — intentional for rush, but can steal serves during demos.

## SoftOpen

Play your business before you pay for it.
