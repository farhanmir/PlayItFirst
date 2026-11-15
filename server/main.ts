/**
 * SoftOpen game server — Vite middleware in dev, static dist in prod, WebSocket rooms.
 * Architecture pattern adapted from Gitzilla's server/main.ts (single-port Vite + WS).
 */
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { CafeRoomServer, RoomCapacityError, requestOrigin } from "./rooms.ts";
import { qrSvg } from "./qr.ts";
import { loadProperties, getCachedProperties } from "./costar.ts";
import { resolveMatterport } from "./matterport.ts";
import { deepagentsConfigured } from "./deepagents.ts";
import { PhotonRequestError } from "./photon-bridge.ts";
import { readJsonBody, readRawBody, respondHttpInputError, createRoomRateLimiter, createPropertyRefreshLimiter, clientAddress } from "./httpLimits.ts";
import { PhoneBridge } from "./phone-bridge.ts";

// Node 22's loader preserves values already supplied by Render's environment.
if (existsSync(".env")) loadEnvFile(".env");
await loadProperties();

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5173);
/** Comma-separated browser origins allowed to call this API/WS when frontends are split. */
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const server = http.createServer({ headersTimeout: 15_000, requestTimeout: 20_000 });
server.maxConnections = 256;
const roomLimiter = createRoomRateLimiter();
const refreshLimiter = createPropertyRefreshLimiter();
let propertyRefresh: Promise<unknown> | null = null;
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const rooms = new CafeRoomServer(wss);
const phones = new PhoneBridge();

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
  ".mp3": "audio/mpeg",
  ".md": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
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

function originFor(req: IncomingMessage): string {
  const encrypted = Boolean((req.socket as { encrypted?: boolean } | undefined)?.encrypted);
  return requestOrigin(req.headers.host, req.headers["x-forwarded-proto"], encrypted);
}

function joinOrigin(req: IncomingMessage, bodyOrigin?: string): string {
  const header = req.headers["x-softopen-public-origin"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const candidate = (bodyOrigin || fromHeader || "").trim();
  if (/^https?:\/\//i.test(candidate)) return candidate.replace(/\/+$/, "");
  return originFor(req);
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-SoftOpen-Public-Origin");
  }
}

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
    ...(pathname === "/sw.js" || pathname === "/manifest.webmanifest"
      ? { "Cache-Control": "no-cache" } : {}),
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(path).on("error", () => res.destroy()).pipe(res);
}

server.on("request", (req, res) => {
  void (async () => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/photon/webhook") {
      if (req.method !== "POST") { json(res, 405, { error: "Method not allowed" }); return; }
      if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) { json(res, 415, { error: "JSON content required" }); return; }
      const raw = await readRawBody(req, { maxBytes: 64 * 1024 });
      const headers: Record<string, string> = {};
      for (const name of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
        const value = req.headers[name]; if (typeof value === "string") headers[name] = value;
      }
      await rooms.receivePhoton(raw.toString("utf8"), headers);
      res.writeHead(204); res.end(); return;
    }

    if (url.pathname === "/api/phone/session" || url.pathname === "/api/phone/voice" || url.pathname === "/api/nessie/activate") {
      res.setHeader("Cache-Control", "no-store");
      if (req.method !== "POST") { json(res, 405, { error: "POST required" }); return; }
      try {
        const body = await readJsonBody(req, { maxBytes: 8192 });
        if (url.pathname === "/api/phone/voice") {
          const result = await phones.voice(req.headers.authorization || "", body);
          json(res, 200, result); return;
        }
        const auth = req.headers.authorization || "";
        if (typeof body.room !== "string" || !/^Bearer [0-9a-f]{24}$/.test(auth)) throw new Error("Owner authorization required");
        if (url.pathname === "/api/nessie/activate") {
          if (typeof body.activationCode !== "string") throw new Error("Sandbox activation code required.");
          json(res, 200, rooms.activateNessie(body.room, auth.slice(7), body.activationCode));
          return;
        }
        const owner = rooms.phoneOwner(body.room, auth.slice(7));
        const result = body.action === "start" ? phones.start(owner, typeof body.activationCode === "string" ? body.activationCode : "")
          : body.action === "status" ? phones.getStatus(owner)
          : body.action === "end" ? phones.end(owner)
          : body.action === "voice_approval" && typeof body.proposalId === "string" ? phones.issueVoiceApproval(owner, body.proposalId)
          : null;
        if (!result) { json(res, 400, { error: "Unsupported phone session action" }); return; }
        json(res, 200, result);
      } catch (error) {
        if (respondHttpInputError(req, res, error)) return;
        // Never return provider errors or secret-bearing bodies to clients.
        json(res, 400, { error: error instanceof Error ? error.message.slice(0, 240) : "Phone request refused" });
      }
      return;
    }

    if (url.pathname === "/api/properties") {
      if (url.searchParams.get("refresh") === "1") {
        const limit = refreshLimiter.take("refresh");
        if (!limit.allowed) { res.setHeader("Retry-After", limit.retryAfterSeconds); json(res, 429, { error: "Property refresh is cooling down. Try again shortly." }); return; }
        propertyRefresh ??= rooms.refreshProperties().finally(() => { propertyRefresh = null; });
        await propertyRefresh;
      }
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
        matterport: !!(process.env.MATTERPORT_API_KEY && (process.env.MATTERPORT_TOKEN || process.env.MATTERPORT_SDK_TOKEN)),
        nessie: !!process.env.NESSIE_KEY,
        deepagents: deepagentsConfigured(),
        photonVoice: phones.status().voiceConfigured ? "voice-tool-configured-call-unverified" : "webrtc-crew-not-photon-2",
        photonMessaging: { ...rooms.photonStatus(), inbox: phones.status() },
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
      const limit = roomLimiter.take(clientAddress(req, { trustRenderProxy: process.env.RENDER === "true" }));
      if (!limit.allowed) {
        res.setHeader("Retry-After", limit.retryAfterSeconds);
        res.shouldKeepAlive = false;
        res.setHeader("Connection", "close");
        res.once("finish", () => req.socket.destroy());
        json(res, 429, { error: "Too many new cafés. Wait a minute, or rejoin your existing room." }); return;
      }
      const body = await readJsonBody(req);
      const created = rooms.createRoom(body.judgeDemo === true);
      const join = rooms.joinUrl(joinOrigin(req, typeof body.publicOrigin === "string" ? body.publicOrigin : undefined), created.code);
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
      const join = rooms.joinUrl(joinOrigin(req), code);
      json(res, 200, { code, url: join, qrSvg: qrSvg(join) });
      return;
    }

    if (url.pathname === "/api/health") {
      json(res, 200, { ok: true, service: "softopen", product: "Play It First", legacy: "playfirst", commit: process.env.RENDER_GIT_COMMIT || null });
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
    if (respondHttpInputError(req, res, error)) return;
    if (error instanceof PhotonRequestError) { if (error.status === 429) res.setHeader("Retry-After", "3"); json(res, error.status, { error: error.message }); return; }
    if (error instanceof RoomCapacityError) { json(res, 503, { error: error.message }); return; }
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: "Internal error" });
  });
});

server.listen(port, () => {
  console.log(`\n  Play It First running at http://localhost:${port}`);
  console.log(`  WebSocket: ws://localhost:${port}/ws\n`);
});
