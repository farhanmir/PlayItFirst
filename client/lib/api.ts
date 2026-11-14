/**
 * Frontend origin helpers for local same-origin dev and split Vercel/Railway deploys.
 * Never put secrets in VITE_* variables.
 */

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/** HTTP API base. Empty string means same-origin relative paths. */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return raw ? trimSlash(raw) : "";
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = apiBase();
  return base ? `${base}${normalized}` : normalized;
}

/**
 * WebSocket URL for the authoritative room server.
 * Defaults to same-origin `/ws` (http→ws, https→wss).
 */
export function wsUrl(): string {
  const raw = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (raw) return raw;
  if (typeof location === "undefined") return "ws://127.0.0.1/ws";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

/**
 * Public site origin for QR invites.
 * Prefer VITE_PUBLIC_ORIGIN on a static host; otherwise the current page origin.
 */
export function publicOrigin(): string {
  const raw = (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined)?.trim();
  if (raw) return trimSlash(raw);
  if (typeof location === "undefined") return "http://127.0.0.1";
  return location.origin;
}
