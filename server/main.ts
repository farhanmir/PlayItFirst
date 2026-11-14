/**
 * SoftOpen game server — Vite middleware in dev, static dist in prod, WebSocket rooms.
 * Architecture pattern adapted from Gitzilla's server/main.ts (single-port Vite + WS).
 */
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { CafeRoomServer } from "./rooms.ts";
import { qrSvg } from "./qr.ts";
import { loadProperties, getCachedProperties } from "./costar.ts";
import { resolveMatterport } from "./matterport.ts";
import { deepagentsConfigured } from "./deepagents.ts";

await loadProperties();

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5173);

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true, maxPayload: 1 * 1024 * 1024 });
const rooms = new CafeRoomServer(wss);

server.on("upgrade", (request, socket, head) => {
  if (new URL(request.url || "/", "http://localhost").pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  } else if (production) {
    socket.destroy();
  }
});

const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({
      root,
      server: {
        port,
        middlewareMode: true,
        hmr: { server },
      },
      appType: "spa",
    });

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".map": "application/json",
};

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function serveDist(pathname: string, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }
  const dist = resolve(root, "dist");
  let path = resolve(dist, `.${decodeURIComponent(pathname)}`);
  if (!path.startsWith(dist + sep) && path !== dist) {
    json(res, 403, { error: "Invalid path" });
    return;
  }
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) path = resolve(dist, "index.html");
  const file = await stat(path).catch(() => null);
  if (!file?.isFile()) {
    json(res, 503, { error: "Client build missing. Run npm run build first." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": mime[extname(path)] ?? "application/octet-stream",
    "Content-Length": file.size,
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(path).on("error", () => res.destroy()).pipe(res);
}

server.on("request", (req, res) => {
  void (async () => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/properties") {
      if (url.searchParams.get("refresh") === "1") await rooms.refreshProperties();
      const bundle = getCachedProperties();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "X-SoftOpen-CoStar": bundle.source,
        "X-PlayFirst-CoStar": bundle.source, // legacy alias
      });
      res.end(JSON.stringify(rooms.listProperties()));
      return;
    }

    if (url.pathname === "/api/integrations") {
      json(res, 200, {
        costar: getCachedProperties().source,
        costarDetail: getCachedProperties().detail,
        matterport: !!(process.env.MATTERPORT_TOKEN || process.env.MATTERPORT_SDK_TOKEN),
        nessie: !!process.env.NESSIE_KEY,
        deepagents: deepagentsConfigured(),
        photonVoice: "webrtc-signaling",
        webxr: "client",
      });
      return;
    }

    if (url.pathname.startsWith("/api/matterport/")) {
      const propertyId = decodeURIComponent(url.pathname.slice("/api/matterport/".length));
      const listing = rooms.listProperties().find((p) => p.id === propertyId);
      if (!listing) {
        json(res, 404, { error: "Unknown property" });
        return;
      }
      const model = await resolveMatterport(listing);
      json(res, 200, model);
      return;
    }

    if (url.pathname === "/api/rooms" && req.method === "POST") {
      const created = rooms.createRoom();
      const base = `${url.protocol}//${url.host}`;
      const join = rooms.joinUrl(base, created.code);
      json(res, 200, {
        code: created.code,
        url: join,
        qrSvg: qrSvg(join),
      });
      return;
    }

    if (url.pathname.startsWith("/api/rooms/") && url.pathname.endsWith("/qr")) {
      const code = url.pathname.split("/")[3];
      const room = rooms.getRoom(code);
      if (!room) {
        json(res, 404, { error: "Room not found" });
        return;
      }
      const base = `${url.protocol}//${url.host}`;
      const join = rooms.joinUrl(base, code);
      json(res, 200, { code, url: join, qrSvg: qrSvg(join) });
      return;
    }

    if (url.pathname === "/api/health") {
      json(res, 200, { ok: true, service: "softopen", legacy: "playfirst" });
      return;
    }

    if (vite) {
      vite.middlewares(req, res, () => {
        if (!res.writableEnded) json(res, 404, { error: "Not found" });
      });
      return;
    }

    await serveDist(url.pathname, req, res);
  })().catch((error) => {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: "Internal error" });
  });
});

server.listen(port, () => {
  console.log(`\n  SoftOpen running at http://localhost:${port}`);
  console.log(`  WebSocket: ws://localhost:${port}/ws\n`);
});
