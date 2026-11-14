# SoftOpen — Progress (Issue #2)

Tracking **P0: Prove real-property playable vertical slice and replace sponsor stand-ins**  
https://github.com/farhanmir/SoftOpen/issues/2

Also following **AGENTS.md game-first direction** committed at `65cfb6f`.

Branch: `main` (direct commits per owner request).

## Done this session

| Item | Status |
| --- | --- |
| Economy / navigation defects from QA PR #5 | ✅ Merged to main (`serve` needs a drink + ticket, no clock auto-sales, collect does not mint cash, restock/wages need funds, station clearance + sealed-path reject) |
| Immersive full-viewport game shell | ✅ Canvas fills the viewport; manage panels live in an Esc drawer |
| Contextual E / Space interact | ✅ One primary action prompt; desktop action grid hidden during immersive play |
| Daylight café look + character polish | ✅ Warmer lighting/sky windows, walking legs, larger order bubbles, held cup / steam |
| Sims build overlay (Tab) | ✅ Local editor camera + catalog; room can stay open for other players |
| Judge demo no longer auto-plays the first order | ✅ Parks the host at the counter; player takes the order |
| Vercel + Railway split config | ✅ `vercel.json`, `.env.example`, `docs/DEPLOY.md`, `VITE_API_BASE_URL` / `VITE_WS_URL` / `VITE_PUBLIC_ORIGIN`, CORS + public-origin QR |
| Vertical-slice regression tests | ✅ 58 passing (includes former todos) |

## Still blocked / needs team or owner

| Item | Blocker |
| --- | --- |
| Matched CoStar listing + Matterport scan | Event toolkit credentials unset |
| Hosted Deepagents runtime | No `DEEPAGENTS_*` / model keys; local `getCafeState` / `reorderSupplies` / `adjustStaffing` tools exist |
| Photon 2.0 messaging | No provider token; crew WebRTC + in-app chat remain labeled |
| Public HTTPS/WSS URL | Needs owner Vercel + Railway projects; configs are ready |
| Physical phone playtest | Not run in this cloud environment |

## Acceptance checklist

- [x] `npm test` / `typecheck` / `build` green after economy + immersive UI
- [ ] Two real clients on a public HTTPS/WSS origin
- [ ] Documented real property source IDs once toolkit available
- [x] Illustrative timeline/rival clearly labeled
- [ ] Browser screenshots of immersive play + build mode captured in this run

## SoftOpen

Play your business before you pay for it.
