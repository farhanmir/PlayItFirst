# PlayFirst

> Play your business before you pay for it.

An immersive multiplayer café game for HackPrinceton: design and operate a business inside real commercial properties, invite friends by QR code, handle AI customers and director events, and export a launch blueprint.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173

## What works in this build

| Area | Status |
| --- | --- |
| CoStar-style property selection (Houston / LA) | ✅ Mock listings shaped like CoStar + Matterport constraints |
| Playable 3D café (Three.js / R3F) | ✅ Floor plan sized by property |
| First-person / mobile play + coffee actions | ✅ |
| Real-time multiplayer + QR join | ✅ (Gitzilla room/WS/QR patterns) |
| Autonomous customers, queues, personas | ✅ |
| Build mode + live layout changes | ✅ |
| Tabletop marker sync (physical ↔ digital) | ✅ Browser marker board |
| AI game director | ✅ Event injection with state consequences |
| Nessie finance ledger | ✅ Local sim + optional `NESSIE_KEY` |
| Photon-style manager messaging | ✅ In-app agent chat that mutates game state |
| Business launch blueprint | ✅ Generated from session |

Stretch (scaffolded / not required for demo): Vision Pro mode, full competitive dual-café, Photon voice calls, deep LangChain cloud agents.

## Architecture

Reuses battle-tested ideas from [Gitzilla](https://github.com/gfhdhytghd/Gitzilla) without becoming Gitzilla:

- Single-port Node server + Vite middleware + `/ws`
- Authoritative simulation tick + snapshot broadcast
- QR join codes (vendored encoder from Gitzilla)
- Resume tokens and reconnect

PlayFirst-specific layers: café sim, property data, build/tabletop sync, director, Nessie ledger, Photon chat, blueprint export.

```
shared/     typed contracts
server/     rooms, simulation, director, finance, QR
client/     React UI + React Three Fiber café
data/       property listings
```

## Demo path

1. Host a room → pick a Houston or LA property  
2. Build: place machines/tables or drag the tabletop board and **Sync**  
3. Open for business → take orders / make coffee / serve  
4. Watch the director rush + reply to Jamie in Photon  
5. Generate the launch blueprint  

## Env (optional)

- `PORT` — default `5173`
- `NESSIE_KEY` — Capital One Nessie sandbox key for live account provisioning
