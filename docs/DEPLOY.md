# SoftOpen public deploy

Keep local single-port `npm run dev` for development. For a public demo, split the static Vite frontend and the authoritative Node/WebSocket server.

## Architecture

| Piece | Host | Why |
| --- | --- | --- |
| Vite `dist/` SPA | Vercel | Static HTTPS frontend and QR landing page |
| `server/main.ts` rooms + sim | Railway (or one persistent Node process) | In-memory rooms, 20 Hz ticks, WebSockets |

Do **not** put the multiplayer simulation in independent serverless functions. One backend instance is enough for the hackathon.

## Backend (Railway)

1. Create a Node service from this repo.
2. Start command: `npm run start` (runs `NODE_ENV=production tsx server/main.ts`).
3. Build command: `npm install && npm run build` (ships `dist/` if you also want same-origin fallback).
4. Set secrets in the Railway dashboard only (`NESSIE_KEY`, `COSTAR_*`, `DEEPAGENTS_*`, Matterport tokens). Never put them in `VITE_*`.
5. Set `CORS_ORIGINS` / `FRONTEND_ORIGIN` to the Vercel HTTPS origin (e.g. `https://softopen.vercel.app`).
6. Confirm `/api/health` and `wss://<railway-host>/ws` are reachable.

## Frontend (Vercel)

1. Import the repo. `vercel.json` already points at the Vite build output.
2. Set public build env vars (no secrets):
   - `VITE_API_BASE_URL=https://<railway-host>`
   - `VITE_WS_URL=wss://<railway-host>/ws`
   - `VITE_PUBLIC_ORIGIN=https://<vercel-host>`
3. Redeploy after changing env vars.
4. Open the Vercel URL, host a room, scan the QR. The QR must be the Vercel HTTPS page; the browser socket must hit Railway WSS.

## Local defaults

With env vars unset, `client/lib/api.ts` and `client/lib/net.ts` keep same-origin `/api/*` and `/ws`, matching `npm run dev`.

## Checklist before claiming a public demo

- [ ] Two clients on the public frontend join one room
- [ ] QR opens the public frontend, not localhost
- [ ] Furniture move on one client appears on the other
- [ ] One paid order updates cash and inventory once
- [ ] No secrets in the client bundle (`VITE_*` only)
