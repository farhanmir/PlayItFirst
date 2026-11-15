/** Recorded café foley and licensed instrumental music. Credits: /audio/README.md. */
type Sfx = "ui" | "open" | "order" | "brew" | "serve" | "coin" | "rush" | "ping" | "sad" | "place";
type Clip = "cup" | "coffee-machine" | "counter-bell" | "coin";
const MUTE_KEY = "playitfirst.audio.muted";
const clips: Clip[] = ["cup", "coffee-machine", "counter-bell", "coin"];
const cues: Record<Sfx, { clip: Clip; volume: number; cooldown: number; duration?: number }> = {
  ui: { clip: "cup", volume: .12, cooldown: 180, duration: .22 },
  open: { clip: "counter-bell", volume: .22, cooldown: 1500 },
  order: { clip: "cup", volume: .28, cooldown: 400 },
  brew: { clip: "coffee-machine", volume: .35, cooldown: 2500 },
  serve: { clip: "cup", volume: .42, cooldown: 500 },
  coin: { clip: "coin", volume: .25, cooldown: 700 },
  rush: { clip: "counter-bell", volume: .12, cooldown: 8000 },
  ping: { clip: "counter-bell", volume: .15, cooldown: 1500 },
  sad: { clip: "cup", volume: .12, cooldown: 1500, duration: .22 },
  place: { clip: "cup", volume: .3, cooldown: 300 },
};
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === "true"; } catch { /* storage is optional */ }
let context: AudioContext | null = null;
let master: GainNode | null = null;
let music: HTMLAudioElement | null = null;
let authorized = false;
let armed = false;
const buffers = new Map<Clip, AudioBuffer>();
const loading = new Set<Clip>();
const active = new Map<Clip, AudioBufferSourceNode>();
const last = new Map<Clip, number>();

export function isMuted() { return muted; }
function stopEffects() {
  for (const source of active.values()) { try { source.stop(); } catch { /* already ended */ } }
  active.clear();
}
function ensure() {
  if (context) return context;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  context = new AC();
  master = context.createGain(); master.gain.value = muted ? 0 : .65; master.connect(context.destination);
  music = new Audio("/audio/bossa-antigua.mp3"); music.loop = true; music.preload = "none";
  music.setAttribute("playsinline", "");
  // WebAudio gain also controls volume on iOS, where media.volume may be ignored.
  const musicGain = context.createGain(); musicGain.gain.value = .14;
  context.createMediaElementSource(music).connect(musicGain); musicGain.connect(master);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { music?.pause(); stopEffects(); }
    else if (authorized && !muted) void start();
  });
  window.addEventListener("pagehide", () => { music?.pause(); stopEffects(); });
  return context;
}
async function loadClips(c: AudioContext) {
  await Promise.all(clips.map(async clip => {
    if (buffers.has(clip) || loading.has(clip)) return;
    loading.add(clip);
    try {
      const response = await fetch(`/audio/${clip}.mp3`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      buffers.set(clip, await c.decodeAudioData(await response.arrayBuffer()));
    } catch { /* An unavailable recording must never block play. */ }
    finally { loading.delete(clip); }
  }));
}
async function start() {
  if (!authorized || muted || document.hidden) return;
  const c = ensure(); if (!c) return;
  // Called synchronously from the trusted gesture; policy rejection remains respected.
  const resume = c.state === "running" ? Promise.resolve() : c.resume();
  const playing = music?.paused ? music.play() : Promise.resolve();
  void loadClips(c);
  await Promise.allSettled([resume, playing]);
  // A mute/visibility change can occur while play() is pending.
  if (muted || document.hidden) { music?.pause(); stopEffects(); }
}
function onGesture(event: Event) {
  if (!event.isTrusted || document.hidden) return;
  authorized = true;
  if (!muted && (!context || context.state !== "running" || music?.paused)) void start();
}
/** Start only with an actual gesture, including room links and automatic demo entry. */
export async function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!armed) {
    armed = true;
    document.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
    document.addEventListener("keydown", onGesture, { capture: true, passive: true });
    document.addEventListener("touchend", onGesture, { capture: true, passive: true });
  }
  if (navigator.userActivation?.isActive) authorized = true;
  if (authorized) await start();
}
export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, String(value)); } catch { /* storage is optional */ }
  if (master && context) master.gain.setTargetAtTime(value ? 0 : .65, context.currentTime, .03);
  if (value) { music?.pause(); stopEffects(); }
  else void unlockAudio();
}
export function play(name: Sfx, gain = .45) {
  if (muted || !authorized || document.hidden || !context || !master || context.state !== "running") return;
  const cue = cues[name], buffer = buffers.get(cue.clip);
  if (!buffer || active.has(cue.clip)) return;
  const now = performance.now();
  if (now - (last.get(cue.clip) ?? -Infinity) < cue.cooldown) return;
  last.set(cue.clip, now);
  const source = context.createBufferSource(); source.buffer = buffer;
  const volume = context.createGain(); volume.gain.value = cue.volume * Math.min(1, Math.max(0, gain / .45));
  source.connect(volume); volume.connect(master); active.set(cue.clip, source);
  source.onended = () => { if (active.get(cue.clip) === source) active.delete(cue.clip); source.disconnect(); volume.disconnect(); };
  // The cup recording starts with 0.26s silence; use its first soft physical tap for UI.
  const offset = cue.duration ? .25 : 0;
  const duration = cue.duration ?? buffer.duration;
  if (cue.duration) {
    volume.gain.setValueAtTime(volume.gain.value, context.currentTime + duration - .03);
    volume.gain.linearRampToValueAtTime(0, context.currentTime + duration);
  }
  source.start(0, offset, duration);
}
