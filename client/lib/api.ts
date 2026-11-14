/** Same-origin networking for local development and the single Render service. */

/** Kept as a compatibility helper; the API is always on the current origin. */
export function apiBase(): string {
  return "";
}

export function apiUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** WebSocket URL for the authoritative room server (HTTPS → WSS). */
export function wsUrl(): string {
  if (typeof location === "undefined") return "ws://127.0.0.1/ws";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

/** QR invites always use the current page origin. */
export function publicOrigin(): string {
  if (typeof location === "undefined") return "http://127.0.0.1";
  return location.origin;
}
