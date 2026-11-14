import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";

// Run once against your deployment; creates one disposable room, not an uptime monitor.
const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/check-deployment.mjs https://YOUR-SERVICE.onrender.com");
  process.exit(1);
}
const base = new URL(input);
assert(!base.username && !base.password, "Use a public origin without credentials");
assert(base.pathname === "/" && !base.search && !base.hash, "Supply the origin, without a path or query");
assert(base.protocol === "https:" || (base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)), "Use HTTPS except for local verification");
const socketUrl = new URL("/ws", base);
socketUrl.protocol = base.protocol === "https:" ? "wss:" : "ws:";
const sockets = [];

async function request(path, options) {
  const response = await fetch(new URL(path, base), {
    ...options,
    signal: AbortSignal.timeout(90_000),
  });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).origin, base.origin, `${path}: unexpected redirect`);
  return response;
}

function waitMessage(ws, predicate, label) {
  return new Promise((resolve, reject) => {
    const finish = (error, message) => {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
      error ? reject(error) : resolve(message);
    };
    const onError = (error) => finish(error);
    const onClose = () => finish(new Error(`Socket closed while waiting for ${label}`));
    const onMessage = (data) => {
      try {
        const message = JSON.parse(String(data));
        if (message.t === "error") finish(new Error(message.message));
        else if (predicate(message)) finish(null, message);
      } catch (error) {
        finish(error);
      }
    };
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${label}`)), 15_000);
    ws.on("message", onMessage);
    ws.once("error", onError);
    ws.once("close", onClose);
    if (ws.readyState !== WebSocket.OPEN) onClose();
  });
}

async function connect(room, name, role, resume) {
  const ws = new WebSocket(socketUrl, { origin: base.origin, handshakeTimeout: 15_000 });
  sockets.push(ws);
  let lastError;
  ws.on("error", (error) => { lastError = error; });
  await once(ws, "open");
  let snapshot;
  ws.on("message", (data) => {
    const message = JSON.parse(String(data));
    if (message.snapshot) snapshot = message.snapshot;
  });
  const welcome = waitMessage(ws, (message) => message.t === "welcome", `${name} welcome`);
  ws.send(JSON.stringify({ t: "hello", room, name, role, resume }));
  return {
    ws,
    welcome: await welcome,
    send: (message) => ws.send(JSON.stringify(message)),
    async snapshot(predicate, label) {
      if (lastError) throw lastError;
      if (ws.readyState !== WebSocket.OPEN) throw new Error(`${name} disconnected`);
      if (snapshot && predicate(snapshot)) return snapshot;
      const message = await waitMessage(ws, (item) => item.t === "snapshot" && predicate(item.snapshot), label);
      return message.snapshot;
    },
  };
}

try {
  const health = await (await request("/api/health")).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, "softopen"); // Stable health identifier retained after the product rename.
  console.log("PASS health API");

  const page = await request("/?demo=1");
  assert.match(page.headers.get("content-type") || "", /text\/html/);
  const html = await page.text();
  assert.match(html, /Play It First/i);
  const assetPath = html.match(/src="([^"]*\/assets\/[^"]+\.js)"/)?.[1];
  assert(assetPath, "Built JavaScript asset missing; target the production server, not Vite dev");
  assert.equal(new URL(assetPath, base).origin, base.origin);
  const asset = await request(assetPath);
  assert.match(asset.headers.get("content-type") || "", /javascript/);
  await asset.arrayBuffer();
  console.log("PASS built demo page and JavaScript asset");

  const properties = await (await request("/api/properties")).json();
  assert(properties.length > 0, "No property listings returned");
  const integrations = await (await request("/api/integrations")).json();
  console.log(`PASS listings API (source: ${integrations.costar})`);

  const room = await (await request("/api/rooms", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).json();
  assert.equal(new URL(room.url).origin, base.origin, "Invite origin must match the public service");
  assert.equal(new URL(room.url).searchParams.get("room"), room.code);
  assert.match(room.qrSvg, /<svg/);
  const refreshed = await (await request(`/api/rooms/${room.code}/qr`)).json();
  assert.equal(refreshed.url, room.url);
  console.log("PASS room creation and invite origin (QR image not scanned)");

  const host = await connect(room.code, "Deployment Host", "owner");
  const guest = await connect(room.code, "Deployment Guest", "barista");
  assert.equal(host.welcome.snapshot.code, room.code);
  assert.equal(guest.welcome.snapshot.code, room.code);
  assert.notEqual(host.welcome.you, guest.welcome.you);
  host.send({ t: "select_property", propertyId: properties[0].id });
  await guest.snapshot((state) => state.property?.id === properties[0].id && state.players.length === 2, "shared property");
  host.send({ t: "open_cafe" });
  const state = await guest.snapshot((item) => item.open && item.phase === "play", "open cafe");
  console.log(`PASS two clients join and open cafe over ${socketUrl.protocol}`);

  const plant = state.layout.furniture.find((item) => item.kind === "decoration");
  assert(plant, "Starter decoration missing");
  const movedX = plant.x - 0.5;
  host.send({ t: "move_furniture", id: plant.id, x: movedX, z: plant.z, rotation: 90 });
  const moved = (item) => item.open && item.layout.furniture.some((piece) => piece.id === plant.id && piece.x === movedX && piece.z === plant.z && piece.rotation === 90);
  await Promise.all([host.snapshot(moved, "host furniture move"), guest.snapshot(moved, "guest furniture move")]);
  console.log("PASS furniture move and rotation sync during service");

  const closed = once(host.ws, "close");
  host.ws.close();
  await closed;
  const resumed = await connect(room.code, "Deployment Host", "owner", host.welcome.token);
  assert.equal(resumed.welcome.you, host.welcome.you);
  assert.equal(resumed.welcome.snapshot.players.length, 2);
  assert(moved(resumed.welcome.snapshot));
  console.log("PASS reconnect preserves player and room layout");
  console.log("Deployment transport checks passed. Physical phone QR, WebGL rendering, human paid order, customer rerouting, and restart recovery still require manual verification.");
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const ws of sockets) ws.terminate();
}
