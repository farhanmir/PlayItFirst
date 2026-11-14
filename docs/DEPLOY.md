# Play It First public deploy

Use the free **single-service Render Blueprint** first. It serves the built Vite game, API and authoritative WebSocket rooms together. No Vercel project or cross-origin configuration is required.

## Render (preferred, free)

1. In Render, create a Blueprint from `farhanmir/PlayItFirst`, branch `main`, using the existing `render.yaml`. Confirm the service plan is **Free**.
2. The blueprint sets Node 22, `npm ci --include=dev && npm run build`, `npm start`, and health check `/api/health`. Keep development dependencies during build/runtime because `tsx` runs the server.
3. Leave `VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_PUBLIC_ORIGIN`, `FRONTEND_ORIGIN` and `CORS_ORIGINS` unset for this same-origin deployment. Put optional sponsor secrets only in the service dashboard.
4. Open the assigned `https://<service>.onrender.com/?demo=1`. Verify `/api/health`, a human take/brew/serve, then scan the invite QR on a real phone. Both clients must use the same HTTPS origin and WSS `/ws`; move furniture while both remain connected.
5. Warm the service before judging. [Render free services sleep after 15 minutes without inbound traffic and may take about a minute to wake](https://render.com/docs/free). Rooms are in memory and disappear on restart/redeploy. This is a demo service, with no durable saves.

Local production verification: build, then run the server with `NODE_ENV=production` and a separate `PORT` (the npm start shell syntax works on Render/Linux; in PowerShell set those environment variables and run `node --import tsx server/main.ts`). The November 14 Codex run exercised the built game on port 5174; see PROGRESS.md. **No public Render deploy has been verified yet: account connection/public service URL is missing.**

The split deployment below is optional.

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
