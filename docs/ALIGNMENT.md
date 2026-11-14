# SoftOpen — Implementation Alignment Report

Living audit against the HackPrinceton product vision. Former name: **PlayFirst** (storage keys still migrate).

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

### User journey
1. **Landing** — SoftOpen brand · Open Your Business / Join a Business / Judge demo  
2. **Property** — CoStar-shaped listings; rent/size/traffic shown  
3. **Game** — Build + Play + Ops/Table/Future/Plan  
4. **Demo** `/?demo=1` — Midtown, open doors, rush boost  

### Branding
Product: **SoftOpen**. Tagline: *Play your business before you pay for it.*  
Compat: `softopen.*` localStorage + legacy `playfirst.*` dual-write.

---

## B. Requirement alignment

| Requirement | Status | Notes |
| --- | --- | --- |
| Attractive playable café | **Full** | Procedural R3F interior |
| First-person / character control | **Full** | FPS + third + monitor |
| CoStar data layers | **Partial** | Live/mock; issue #2: matched real listing |
| Matterport → layout | **Partial** | Embed + dims reconstruction; issue #2: matched scan |
| Order lifecycle | **Full** | Station gates + brew timer |
| Autonomous customers | **Full** | Personas + patience |
| Finance from gameplay | **Full** | Sales/rent/equipment/inventory |
| Multiplayer shared room | **Full** | WS authoritative |
| Build mode | **Full** | Click-to-place + tabletop |
| Live layout while playing | **Full** | Editor + tabletop |
| Deepagents director | **Partial** | Local rules + LLM JSON; issue #2: real tools |
| Photon 2.0 messaging | **Missing** | In-app chat/WebRTC only; issue #2 |
| Launch blueprint | **Full** | Provenance labels |
| Timeline / rival honesty | **Partial** | Issue #2: fix units / labels |

---

## C. Decisions to retain

1. Single-port Node + Vite + WS  
2. Deterministic sim + optional LLM director  
3. On-screen tabletop (reliable wow)  
4. Property-dimension procedural café until authorized meshes  
5. Optimistic client move + server snapshots  
6. Café-only MVP  

---

## D–F. Gaps & execution

See **GitHub issue #2** and `docs/PROGRESS.md` for the P0 vertical-slice plan (real property pairing, causal director, Photon/Deepagents honesty).

Rebrand complete on branch `cursor/softopen-rebrand-078f`. Gameplay architecture unchanged.
