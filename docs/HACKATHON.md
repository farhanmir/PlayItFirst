# Play It First — HackPrinceton pitch kit

## One-liner
Play your business before you pay for it — a multiplayer café soft opening inside real commercial properties.

## Closing line
Your grand opening starts when you play it first.

## Tracks / sponsors to hit in the demo
| Sponsor | Show this |
| --- | --- |
| CoStar | Live `/api/properties` when `COSTAR_API_URL` set · else stamped mock IDs (labeled) |
| Matterport | Build-tab walkthrough embed + Model API when `MATTERPORT_TOKEN` set |
| LangChain / Deepagents | Hosted LLM director when keyed · else local Deepagents-shaped rules (P0: real Deepagents tools) |
| Photon | In-app Jamie chat + WebRTC crew voice — **honestly not Photon 2.0 yet** (issue #2) |
| Capital One Nessie | Ledger + optional sandbox account + mirrored deposits/withdrawals |
| Vision Pro | Table-tab WebXR VR/AR entry + dollhouse fallback |
| Amazon / Best Overall | Fun multiplayer + soft-opening entrepreneurship education |
| SpaceXSI / Cursor | Built with agents; Gitzilla patterns reused |

## Two-minute script
0:00 Hook — “Before every grand opening, there's a soft opening. We built one you can play.” → Play It First  
0:20 Reveal — Judge demo (`/?demo=1`) Midtown CoStar listing → Matterport floor becomes playable café  
0:40 Judges play — QR join; highlighted station action / Space; phone + desktop co-op  
1:00 Chaos — rush director + Jamie ping/call  
1:20 Wow — Tabletop tab: rearrange markers → layout updates live  
1:40 Payoff — rival score + download launch blueprint  

`/?demo=1` hosts a room, selects Midtown, opens doors, then sends `demo_boost` (queue + rush director + Jamie ping).

## Social good (say it once)
Entrepreneurship is expensive and intimidating. Play It First lets people practice ownership — money, staffing, layout — before risking rent.

## Commands
```bash
npm install
npm run dev
# or
open http://localhost:5173/?demo=1
```

## Non-negotiable
If you must drop a sponsor integration, keep the café **fun to play**.
