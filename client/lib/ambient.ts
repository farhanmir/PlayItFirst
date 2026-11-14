/** Soft looping café bed — procedural, no asset downloads. */
import { unlockAudio } from "./audio";

let ctx: AudioContext | null = null;
let bed: { stop: () => void } | null = null;
let enabled = true;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

export async function startAmbient() {
  if (!enabled) return;
  await unlockAudio();
  const c = getCtx();
  if (!c || bed) return;
  if (c.state === "suspended") await c.resume();

  const master = c.createGain();
  master.gain.value = 0.045;
  master.connect(c.destination);

  const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;

  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const hum = c.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 55;
  const humGain = c.createGain();
  humGain.gain.value = 0.15;

  src.connect(filter);
  filter.connect(master);
  hum.connect(humGain);
  humGain.connect(master);
  src.start();
  hum.start();

  bed = {
    stop() {
      try {
        src.stop();
        hum.stop();
      } catch {
        /* already stopped */
      }
      master.disconnect();
      bed = null;
    },
  };
}

export function stopAmbient() {
  bed?.stop();
  bed = null;
}

export function setAmbientEnabled(v: boolean) {
  enabled = v;
  if (!v) stopAmbient();
  else void startAmbient();
}
