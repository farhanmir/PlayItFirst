# SoftOpen — Progress (Issue #2)

Tracking **P0: Prove real-property playable vertical slice and replace sponsor stand-ins**  
https://github.com/farhanmir/SoftOpen/issues/2

Branch: `cursor/softopen-rebrand-078f` (also carries SoftOpen rebrand).

## Done this session

| Item | Status |
| --- | --- |
| Rebrand PlayFirst → SoftOpen | ✅ Separate commit `refactor: rebrand PlayFirst to SoftOpen` |
| Director choices mutate ops state (place machine, menuReduced, rushBoost, charges) instead of inventing queue/wait metrics | ✅ |
| Prevent double-resolving director charges | ✅ |
| TimelineCompare units + illustrative labeling | ✅ |
| Photon / Deepagents badges honest (not Photon 2.0 / tool runtime partial) | ✅ |
| photon_reply “stop large orders” uses menuReduced/rushBoost | ✅ |
| Property cards label CoStar mock vs live + Matterport stand-in | ✅ |

## Still blocked / needs team or sponsor access

| Item | Blocker |
| --- | --- |
| Matched CoStar listing + Matterport scan for demo property | Need authorized event toolkit credentials / dataset; bundled `data/properties.json` remains **costar-mock** with showcase stand-in model IDs |
| Real LangChain Deepagents tool runtime | Need `DEEPAGENTS_*` / package wiring beyond LLM JSON; current path is local rules + optional hosted JSON |
| Photon 2.0 iMessage / provider messaging | Need Photon provisioned channel + secrets — escalate; keep crew WebRTC separate |
| Judge phone join over public HTTPS/WSS | Need deployed SoftOpen URL (not localhost); LAN IP works for same Wi‑Fi demos |

## Acceptance checklist

- [x] `npm test` / `typecheck` / `build` green after rebrand + causal director
- [ ] Two real clients (desktop + phone) paid order + shared layout edit — needs deploy/LAN
- [ ] Documented real property source IDs once toolkit available
- [x] Illustrative timeline/rival clearly labeled

## SoftOpen

Play your business before you pay for it.
