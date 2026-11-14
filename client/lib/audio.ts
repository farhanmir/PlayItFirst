/**
 * Lightweight café WebAudio — inspired by Gitzilla's synth approach,
 * specialized for PlayFirst SFX (no Gitzilla combat themes).
 */

type Sfx = "ui" | "open" | "order" | "brew" | "serve" | "coin" | "rush" | "ping" | "sad" | "place";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const last = new Map<string, number>();

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  return ctx;
}

export async function unlockAudio() {
  const c = ensure();
  if (!c) return;
  if (c.state === "suspended") await c.resume();
  play("ui", 0.2);
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) master.gain.setTargetAtTime(v ? 0 : 0.55, ctx.currentTime, 0.02);
}

export function play(name: Sfx, gain = 0.45) {
  if (muted) return;
  const c = ensure();
  if (!c || !master || c.state !== "running") return;
  const now = c.currentTime;
  const prev = last.get(name) ?? 0;
  if (now - prev < 0.05) return;
  last.set(name, now);

  const patches = patchesFor(name);
  for (const p of patches) {
    const osc = p.noise ? c.createBufferSource() : c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(master);

    if (p.noise) {
      const len = Math.floor(c.sampleRate * p.dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * (i / len));
      (osc as AudioBufferSourceNode).buffer = buf;
      (osc as AudioBufferSourceNode).connect(g);
      (osc as AudioBufferSourceNode).start(now + p.at);
      (osc as AudioBufferSourceNode).stop(now + p.at + p.dur + 0.02);
    } else {
      const o = osc as OscillatorNode;
      o.type = p.type ?? "sine";
      o.frequency.setValueAtTime(p.f0 ?? 440, now + p.at);
      if (p.f1) o.frequency.exponentialRampToValueAtTime(Math.max(40, p.f1), now + p.at + p.dur);
      o.connect(g);
      o.start(now + p.at);
      o.stop(now + p.at + p.dur + 0.03);
    }

    const peak = gain * (p.gain ?? 1);
    g.gain.setValueAtTime(0, now + p.at);
    g.gain.linearRampToValueAtTime(peak, now + p.at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.at + p.dur);
  }
}

interface Patch {
  at: number;
  dur: number;
  gain?: number;
  f0?: number;
  f1?: number;
  type?: OscillatorType;
  noise?: boolean;
}

function patchesFor(name: Sfx): Patch[] {
  switch (name) {
    case "ui":
      return [{ at: 0, dur: 0.08, f0: 660, f1: 880, type: "triangle", gain: 0.5 }];
    case "open":
      return [
        { at: 0, dur: 0.12, f0: 392, type: "triangle", gain: 0.45 },
        { at: 0.1, dur: 0.16, f0: 523, type: "triangle", gain: 0.5 },
        { at: 0.22, dur: 0.22, f0: 659, type: "sine", gain: 0.55 },
      ];
    case "order":
      return [{ at: 0, dur: 0.1, f0: 784, f1: 988, type: "square", gain: 0.25 }];
    case "brew":
      return [
        { at: 0, dur: 0.25, noise: true, gain: 0.35 },
        { at: 0.02, dur: 0.2, f0: 180, f1: 90, type: "sawtooth", gain: 0.2 },
      ];
    case "serve":
      return [
        { at: 0, dur: 0.08, f0: 880, type: "sine", gain: 0.4 },
        { at: 0.07, dur: 0.12, f0: 1175, type: "triangle", gain: 0.45 },
      ];
    case "coin":
      return [
        { at: 0, dur: 0.06, f0: 1318, type: "square", gain: 0.3 },
        { at: 0.05, dur: 0.1, f0: 1760, type: "sine", gain: 0.35 },
      ];
    case "rush":
      return [
        { at: 0, dur: 0.15, f0: 220, f1: 440, type: "sawtooth", gain: 0.35 },
        { at: 0.12, dur: 0.2, f0: 330, f1: 660, type: "sawtooth", gain: 0.3 },
      ];
    case "ping":
      return [{ at: 0, dur: 0.14, f0: 1046, f1: 1568, type: "sine", gain: 0.4 }];
    case "sad":
      return [
        { at: 0, dur: 0.16, f0: 392, f1: 294, type: "triangle", gain: 0.35 },
        { at: 0.12, dur: 0.2, f0: 294, f1: 220, type: "sine", gain: 0.3 },
      ];
    case "place":
      return [{ at: 0, dur: 0.07, f0: 240, f1: 160, type: "triangle", gain: 0.35 }, { at: 0, dur: 0.05, noise: true, gain: 0.15 }];
    default:
      return [{ at: 0, dur: 0.08, f0: 440, type: "sine", gain: 0.3 }];
  }
}
