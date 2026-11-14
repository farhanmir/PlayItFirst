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

**Fastest for judges:** click **Judge demo** on the landing page, or open `http://localhost:5173/?demo=1` — auto-hosts Midtown, enters the floor, and opens the café.

Manual path:

1. Enter your name → **Host café**
2. Pick a Houston or LA storefront (rent/size/traffic become the rules)
3. **Build** furniture or drag the **Table** markers → live layout sync
4. Open **Matterport** walkthrough on Build; **Photon Voice** on Ops; **WebXR** on Table
5. **Open for business** → WASD + Take order / Make coffee / Serve (`E` / `F` / `R` / Space)
6. Answer the AI director + message Jamie in **Ops** / Photon
7. Check **Future** for the rival café race + alternate timelines, then **Plan** → generate blueprint
8. Friends scan the HUD QR to join as baristas (then start a live voice call)

## What works

| Area | Status |
| --- | --- |
| CoStar property selection | ✅ Live when `COSTAR_API_URL` set · else stamped mock |
| Matterport twin | ✅ Showcase embed + Model API when `MATTERPORT_TOKEN` set |
| Playable 3D café (Three.js / R3F) | ✅ Warm procedural interior |
| Desktop orbit + mobile follow-cam | ✅ |
| Real-time multiplayer + QR join | ✅ |
| Customers, tickets, inventory | ✅ |
| Live tabletop marker sync | ✅ Pitch wow |
| AI game director | ✅ Local rules · hosted Deepagents when keyed |
| Nessie finance ledger | ✅ Local + optional `NESSIE_KEY` (mirrors txs) |
| Photon manager chat | ✅ NL actions |
| Photon Voice | ✅ WebRTC over room signaling |
| Vision Pro / WebXR | ✅ Immersive VR/AR entry + dollhouse fallback |
| Rival café + time machine | ✅ |
| Judge demo (`/?demo=1`) | ✅ |
| Launch blueprint | ✅ |
| WebAudio café SFX | ✅ iOS-safe unlock |

## Architecture

Reuses battle-tested ideas from [Gitzilla](https://github.com/gfhdhytghd/Gitzilla) without becoming Gitzilla:

- Single-port Node + Vite middleware + `/ws`
- Authoritative sim tick + snapshot broadcast
- QR join + resume tokens

```
shared/   contracts
server/   rooms, simulation, director, costar, matterport, deepagents, finance, QR
client/   React UI + R3F café + WebRTC voice + WebXR
data/     property listings
```

## Scripts

```sh
npm run dev        # game server + client
npm test           # sim + multiplayer smoke + integrations
npm run typecheck
npm run build
```

## Env (optional)

Copy `.env.example`. Demo runs fully without keys.

| Var | Purpose |
| --- | --- |
| `NESSIE_KEY` | Capital One Nessie sandbox |
| `COSTAR_API_URL` / `COSTAR_API_KEY` | Live CoStar listings JSON |
| `MATTERPORT_TOKEN` | Matterport Model API |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPAGENTS_*` | Hosted Deepagents director |
| `PORT` | Default `5173` |

Integration status is exposed at `/api/integrations` and on the landing/game badges.
