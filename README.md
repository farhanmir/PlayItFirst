# PlayFirst

> Play your business before you pay for it.

An immersive multiplayer café game for HackPrinceton: design and operate a business inside real commercial properties, invite friends by QR code, handle AI customers and director events, and export a launch blueprint.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173

## Demo path (2 minutes)

1. Enter your name → **Host café**
2. Pick a Houston or LA storefront (rent/size/traffic become the rules)
3. **Build** furniture or drag the **Table** markers → Sync layout
4. **Open for business** → WASD + Take order / Make coffee / Serve (`E` / `F` / `R`)
5. Answer the AI director + message Jamie in **Ops** / Photon
6. Check **Future** for alternate timelines, then **Plan** → generate blueprint
7. Friends scan the HUD QR to join as baristas

## What works

| Area | Status |
| --- | --- |
| CoStar-style property selection (Houston / LA) | ✅ Mock listings + Matterport-shaped constraints |
| Playable 3D café (Three.js / R3F) | ✅ Warm procedural interior, props, lighting |
| Desktop orbit + mobile follow-cam play | ✅ |
| Real-time multiplayer + QR join | ✅ Gitzilla-inspired rooms/WS/QR |
| Customers, personas, tickets, queues | ✅ |
| Inventory (milk / cups / beans) | ✅ |
| Build mode + live layout changes | ✅ |
| Tabletop marker sync | ✅ |
| AI game director | ✅ State-changing choices |
| Nessie finance ledger | ✅ Local + optional `NESSIE_KEY` |
| Photon manager chat | ✅ Natural-language actions |
| Business time machine | ✅ Alternate future compare |
| Launch blueprint | ✅ From gameplay session |
| WebAudio café SFX | ✅ Unlock on first gesture |

Stretch: live CoStar/Matterport APIs, Photon voice, Vision Pro, competitive dual-café, hosted Deepagents.

## Architecture

Reuses battle-tested ideas from [Gitzilla](https://github.com/gfhdhytghd/Gitzilla) without becoming Gitzilla:

- Single-port Node + Vite middleware + `/ws`
- Authoritative sim tick + snapshot broadcast
- QR join + resume tokens

```
shared/   contracts
server/   rooms, simulation, director, finance, QR
client/   React UI + R3F café + audio
data/     property listings
```

## Scripts

```sh
npm run dev        # game server + client
npm test           # sim + multiplayer smoke
npm run typecheck
npm run build
```

## Env (optional)

- `PORT` — default `5173`
- `NESSIE_KEY` — Capital One Nessie sandbox key
