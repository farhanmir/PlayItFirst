/** SoftOpen localStorage helpers with PlayFirst key migration. */

const NAME_KEY = "softopen.name";
const NAME_LEGACY = "playfirst.name";

export function getStoredName(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(NAME_KEY) || localStorage.getItem(NAME_LEGACY) || "";
}

export function setStoredName(name: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
  // Keep legacy key so older tabs / mid-session clients still resume cleanly
  localStorage.setItem(NAME_LEGACY, name);
}

export function resumeTokenKey(room: string): string {
  return `softopen.token.${room}`;
}

export function legacyResumeTokenKey(room: string): string {
  return `playfirst.token.${room}`;
}

export function getResumeToken(room: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(resumeTokenKey(room)) || localStorage.getItem(legacyResumeTokenKey(room));
}

export function setResumeToken(room: string, token: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(resumeTokenKey(room), token);
  localStorage.setItem(legacyResumeTokenKey(room), token);
}
