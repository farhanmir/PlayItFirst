# PlayFirst — Implementation Alignment Report

Living audit against the HackPrinceton product vision. **Product requirements are authoritative; libraries and schemas are not.** Preserve working systems.

Canvas: interactive summary available in the agent chat (“PlayFirst Spec Alignment”).

---

## A. Current implementation

### Architecture
| Layer | Path | Role |
| --- | --- | --- |
| Entry | `server/main.ts` | Single-port HTTP + Vite middleware + `/ws` |
| Rooms | `server/rooms.ts` | Authoritative room state, 20 Hz snapshots, resume tokens |
| Sim | `server/simulation.ts` | Customers, interact, layout, blueprint |
| Contracts | `shared/types.ts`, `shared/stations.ts` | Shared DTOs + nearest-station hints |
| Client | `client/App.tsx` → Landing / PropertySelect / Game | Zustand + R3F café |
| Cameras | `client/components/CafeScene.tsx`, `client/lib/look.ts` | First / third / monitor / dollhouse |

Patterns reused from Gitzilla (WS rooms, QR, tick) — not a rewrite of Gitzilla.

### User journey
1. **Landing** (`client/pages/Landing.tsx`) — Host / Join / Judge demo  
2. **Property** (`client/pages/PropertySelect.tsx`) — CoStar-shaped listings; rent/size/traffic shown  
3. **Game** (`client/pages/Game.tsx`) — Build + Play + Ops/Table/Future/Plan rails  
4. **Demo** `/?demo=1` (`client/lib/demo.ts`) — Midtown, open doors, rush boost  

### Gameplay
- Customers: enter → queue → order → wait → happy/angry leave (`stepSimulation`)  
- Jobs: `take_order` / `make_coffee` / `serve` / `restock` / `collect`  
- Jamie AI barista when humans idle or queue long  
- Inventory recipes (beans/cups/milk)  
- Property `footTraffic`, `capacity`, machine count affect spawn/throughput  
- Immersive cameras + yaw-relative WASD + optimistic move  

### Multiplayer
- Create room `POST /api/rooms`, join via code/QR/URL  
- Shared layout, players, customers, orders, finance, director, photon  
- Mid-session join receives current snapshot  

### Build ↔ play
- Catalog place/move/remove (`BuildPanel`)  
- **Tabletop** markers → `tabletop_sync` while others play (signature wow)  
- Customers re-anchor queue to counter / pickup  

### Sponsor integrations
| Sponsor | Module | Behavior |
| --- | --- | --- |
| CoStar | `server/costar.ts` | Live when `COSTAR_API_URL`; else stamped mock |
| Matterport | `server/matterport.ts` + `MatterportPanel` | Embed + Model API; reconstructed plate |
| Deepagents | `server/deepagents.ts` + `director.ts` | Hosted when keyed; local rules always |
| Photon | chat / call / `PhotonVoice` WebRTC | In-app; not carrier iMessage |
| Nessie | `server/finance.ts` | Local ledger + optional sandbox mirror |
| WebXR | `WebXRSession` | VR/AR entry + dollhouse fallback |

### Tests
32 Vitest cases: sim, stations, WS smoke, look, demo, costar, rival, suggestAction.

---

## B. Requirement alignment

| Requirement | Status | Notes |
| --- | --- | --- |
| Attractive playable café | **Full** | Procedural R3F interior |
| First-person / character control | **Full** | FPS + third + monitor |
| CoStar data layers | **Partial** | Live/mock listings; Vexcel deferred |
| Matterport → layout | **Partial** | Embed + dims-driven reconstruction (honest Approach C) |
| Order lifecycle | **Partial → tightening** | Station gates + brew timer |
| Autonomous customers | **Full** | Personas + patience |
| Finance from gameplay | **Full** | Sales/rent/equipment/inventory |
| Multiplayer shared room | **Full** | WS authoritative |
| Build mode | **Full** | Catalog + budget |
| Live layout while playing | **Full** | Editor + tabletop |
| Deepagents director | **Different / better** | Demo-safe local + optional hosted |
| AI employees hire UX | **Partial** | Jamie assists; no wage hire UI |
| Photon iMessage | **Partial** | In-app messaging/voice; carrier deferred |
| Physical CV tabletop | **Different / better** | On-screen markers → same actions |
| Launch blueprint | **Full** | Markdown + disclaimer |
| Rival / time machine | **Full** | P2 early; keep |
| Multi business types | **Deferred** | Café only (correct) |
| Competitive dual rooms | **Deferred** | Rival panel approximates |

---

## C. Architectural decisions to retain

1. **Single-port Node + Vite + WS** — fewer moving parts than a microservice mesh.  
2. **Deterministic sim + optional LLM director** — game never stalls on AI latency.  
3. **On-screen tabletop** — same wow as fiducials without stage camera risk.  
4. **Property-dimension procedural café** — until authorized Matterport meshes exist.  
5. **Optimistic client move + server snapshots** — feels live without client authority.  
6. **Café-only MVP** — spec forbids unfinished multi-type sprawl.

---

## D. Critical gaps (smallest set)

1. **Station-gated interactions** — ✅ server `stationOk`.  
2. **Brew preparation time** — ✅ `brewing:order@t` + `advanceBrewing`.  
3. **Honest café-only onboarding** — ✅ landing chips.  
4. **Blueprint provenance** — ✅ live vs mock labels.  
5. **Click-to-place build** — ✅ catalog select → click floor (Quick drop kept).

Still soft / deferred: cosmetic roles, carrier iMessage Photon, Vexcel, hire wage UI, CV markers, multi business types.

---

## E. Implementation plan (dependency order)

1. ✅ Station gates + brew timer  
2. ✅ Café-only honesty + blueprint provenance  
3. ✅ Click-to-place build (follow-up from codebase audit)  
4. Keep demo green; avoid P2 expansion  

---

## F. Execution notes

D1–D5 closed. Known limitations remain: Matterport mesh import unavailable; Photon is in-app; CoStar may be mock without `COSTAR_API_URL`; roles do not gate actions.
