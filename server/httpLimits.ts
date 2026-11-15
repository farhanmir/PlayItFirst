import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";

export class HttpInputError extends Error {
  constructor(public readonly status: 400 | 408 | 413, message: string) { super(message); this.name = "HttpInputError"; }
}
export interface BodyLimits { maxBytes?: number; timeoutMs?: number }
/** Bounded bytes, including chunked uploads. Call before installing other body consumers. */
export function readRawBody(req: IncomingMessage, { maxBytes = 64 * 1024, timeoutMs = 10_000 }: BodyLimits = {}): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid body limits");
  return new Promise((resolve, reject) => {
    let size = 0, settled = false;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      clearTimeout(timer);
      req.off("data", data); req.off("end", end); req.off("aborted", aborted); req.off("error", error); req.off("close", close);
    };
    const fail = (cause: HttpInputError) => {
      if (settled) return;
      settled = true; req.pause(); cleanup(); chunks.length = 0; reject(cause);
    };
    const data = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (size + bytes.length > maxBytes) { fail(new HttpInputError(413, "Request body too large")); return; }
      size += bytes.length; chunks.push(bytes);
    };
    const end = () => { if (settled) return; settled = true; cleanup(); resolve(Buffer.concat(chunks, size)); };
    const aborted = () => fail(new HttpInputError(400, "Request aborted"));
    const error = () => fail(new HttpInputError(400, "Request body interrupted"));
    const close = () => { if (!req.complete) aborted(); };
    const timer = setTimeout(() => fail(new HttpInputError(408, "Request body timed out")), timeoutMs);
    timer.unref();
    const length = req.headers["content-length"];
    if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
      fail(new HttpInputError(/^\d+$/.test(length) ? 413 : 400, "Invalid request body length")); return;
    }
    if (req.aborted || req.destroyed) { aborted(); return; }
    req.on("data", data); req.once("end", end); req.once("aborted", aborted); req.once("error", error); req.once("close", close);
    if (req.readableEnded) end();
  });
}
export async function readJsonBody(req: IncomingMessage, options: BodyLimits = {}): Promise<Record<string, unknown>> {
  const bytes = await readRawBody(req, { maxBytes: 16 * 1024, ...options });
  if (!bytes.length) return {};
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Not an object");
    return value as Record<string, unknown>;
  } catch { throw new HttpInputError(400, "Invalid JSON object"); }
}
/** Finish the small error response, then release an incomplete upload's connection. */
export function respondHttpInputError(req: IncomingMessage, res: ServerResponse, error: unknown): boolean {
  if (!(error instanceof HttpInputError)) return false;
  if (res.destroyed || req.socket.destroyed) return true;
  res.shouldKeepAlive = false;
  const socket = req.socket;
  res.once("finish", () => socket.destroy());
  if (!res.headersSent) {
    res.writeHead(error.status, { "content-type": "application/json; charset=utf-8", connection: "close" });
    res.end(JSON.stringify({ error: error.message }));
  } else res.end();
  // Closing after flush preserves the 413/408 response and does not drain unbounded input.
  return true;
}

export interface RateDecision { allowed: boolean; retryAfterSeconds: number }
interface Window { count: number; expires: number }
/** Single-process fixed windows. Saturation fails closed; active keys are never evicted. */
export class FixedWindowLimiter {
  private readonly keys = new Map<string, Window>();
  private global: Window = { count: 0, expires: 0 };
  constructor(private readonly options: { perKey: number; global: number; windowMs?: number; maxKeys?: number }) {}
  get keyCount(): number { return this.keys.size; }
  take(key: string, now = Date.now()): RateDecision {
    const windowMs = this.options.windowMs ?? 60_000;
    if (now >= this.global.expires) { this.global = { count: 0, expires: now + windowMs }; }
    for (const [id, window] of this.keys) if (now >= window.expires) this.keys.delete(id);
    const deny = (until: number): RateDecision => ({ allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)) });
    if (this.global.count >= this.options.global) return deny(this.global.expires);
    let item = this.keys.get(key);
    if (!item) {
      if (key.length > 128 || this.keys.size >= (this.options.maxKeys ?? 1024)) return deny(this.global.expires);
      item = { count: 0, expires: now + windowMs }; this.keys.set(key, item);
    }
    if (item.count >= this.options.perKey) return deny(item.expires);
    item.count++; this.global.count++;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
export function createRoomRateLimiter() { return new FixedWindowLimiter({ perKey: 6, global: 30, maxKeys: 256 }); }
export function createPropertyRefreshLimiter() { return new FixedWindowLimiter({ perKey: 1, global: 1, maxKeys: 1 }); }

/** Never trust arbitrary forwarded headers on a directly reachable local server.
 * Render documents XFF, but not a stable proxy count. The rightmost validated hop
 * is conservative: it may group clients behind a proxy, but ignores forged prefixes.
 * Enable only for Render's ingress; the independent global rate cap still applies.
 */
export function clientAddress(req: IncomingMessage, { trustRenderProxy = false }: { trustRenderProxy?: boolean } = {}): string {
  const normalize = (value: string) => value.startsWith("::ffff:") && isIP(value.slice(7)) === 4 ? value.slice(7) : value.toLowerCase();
  if (trustRenderProxy && process.env.RENDER === "true") {
    const header = req.headers["x-forwarded-for"];
    if (typeof header === "string" && header.length <= 2048) {
      const candidate = header.slice(header.lastIndexOf(",") + 1).trim();
      if (isIP(candidate)) return normalize(candidate);
    }
  }
  return normalize(req.socket.remoteAddress || "unknown");
}
