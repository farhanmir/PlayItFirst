# PlayFirst — HackPrinceton pitch kit

## One-liner
Play your business before you pay for it — a multiplayer café sim inside real commercial properties.

## Tracks / sponsors to hit in the demo
| Sponsor | Show this |
| --- | --- |
| CoStar | Live `/api/properties` when `COSTAR_API_URL` set · else stamped mock IDs |
| Matterport | Build-tab walkthrough embed + Model API when `MATTERPORT_TOKEN` set |
| LangChain / Deepagents | Hosted LLM director when keyed · else local Deepagents-shaped rules |
| Photon | Jamie chat + **WebRTC Photon Voice** crew channel |
| Capital One Nessie | Ledger + optional sandbox account + mirrored deposits/withdrawals |
| Vision Pro | Table-tab WebXR VR/AR entry + dollhouse fallback |
| Amazon / Best Overall | Fun multiplayer + social-good entrepreneurship education |
| SpaceXSI / Cursor | Built with agents; Gitzilla patterns reused |

## Two-minute script (aligned with ChatGPT share)
0:00 Hook — “What if you could play your business before paying for it?” → PlayFirst brand  
0:20 Reveal — Judge demo (`/?demo=1`) Midtown CoStar listing → Matterport floor becomes playable café  
0:40 Judges play — QR join; highlighted station action / Space; phone + desktop co-op  
1:00 Chaos — rush director + Jamie Photon ping/call  
1:20 Wow — Tabletop tab: rearrange markers → layout updates live  
1:40 Payoff — rival score + download launch blueprint  

`/?demo=1` hosts a room, selects Midtown, opens doors, then sends `demo_boost` (queue + rush director + Photon ping).

## Social good (say it once)
Entrepreneurship is expensive and intimidating. PlayFirst lets people practice ownership — money, staffing, layout — before risking rent.

## Commands
```bash
npm install
npm run dev
# or
open http://localhost:5173/?demo=1
```

## Non-negotiable
If you must drop a sponsor integration, keep the café **fun to play**.
