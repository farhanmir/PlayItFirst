/**
 * Phone audio lifecycle adapted from Gitzilla's client/audio/phone.ts —
 * gesture arming, silent WAV media session, visibility recovery for iOS Safari.
 */
type PhoneAudioState = "locked" | "running" | "suspended" | "interrupted" | "closed";
type PlaybackSession = "pending" | "playback" | "media";
interface AudioSessionLike {
  type: string;
}

const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;

let silentWav: string | undefined;

function silentDataUri(): string {
  if (silentWav) return silentWav;
  const bytes = new Uint8Array(44 + 1600);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, 1600, true);
  silentWav = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
  return silentWav;
}

export function createPhoneAudio(callbacks: { muted(): boolean; onRunning(): void }) {
  let context: AudioContext | undefined;
  let disposed = false;
  let bound = false;
  let armed = false;
  let attemptedRecovery = false;
  let media: HTMLAudioElement | null = null;
  let session: PlaybackSession = "pending";
  let audioSession: AudioSessionLike | undefined;
  let previousSessionType: string | undefined;

  const state = (): PhoneAudioState =>
    disposed ? "closed" : context ? (String(context.state) as PhoneAudioState) : "locked";
  const sessionReady = () => callbacks.muted() || session === "playback" || (!!media && !media.paused);
  const needsGesture = () => !disposed && (state() !== "running" || !sessionReady());

  const disarm = () => {
    if (!armed) return;
    for (const type of GESTURES) document.removeEventListener(type, onGesture, true);
    armed = false;
  };
  const arm = () => {
    if (armed || disposed) return;
    for (const type of GESTURES) document.addEventListener(type, onGesture, { capture: true, passive: true });
    armed = true;
  };
  const publish = () => {
    if (!needsGesture()) disarm();
    else arm();
  };
  const onGesture = (event: Event) => {
    if (event.type === "pointerdown" && (event as PointerEvent).pointerType === "touch") return;
    if (context) void api.unlock(context).catch(() => undefined);
  };
  const recover = () => {
    if (disposed || !context || document.hidden) return;
    if (attemptedRecovery) {
      publish();
      return;
    }
    attemptedRecovery = true;
    void api.unlock(context).catch(() => undefined);
  };
  const onState = () => {
    if (disposed) return;
    if (state() === "running") {
      attemptedRecovery = false;
      callbacks.onRunning();
      publish();
    } else {
      publish();
      if (state() === "suspended" || state() === "interrupted") recover();
    }
  };
  const onWake = () => {
    if (document.hidden || disposed) return;
    attemptedRecovery = false;
    recover();
  };
  const onMediaPause = () => {
    if (!disposed && !callbacks.muted()) publish();
  };

  const api = {
    get needsGesture() {
      return needsGesture();
    },
    prepare() {
      if (disposed || typeof navigator === "undefined") return;
      try {
        const candidate = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
        if (candidate) {
          if (!audioSession) {
            audioSession = candidate;
            previousSessionType = candidate.type;
          }
          if (candidate.type !== "playback") candidate.type = "playback";
          if (candidate.type === "playback") {
            session = "playback";
            return;
          }
        }
      } catch {
        /* older Safari */
      }
      session = "media";
    },
    unlock(ctx: AudioContext): Promise<void> {
      if (disposed) return Promise.resolve();
      context = ctx;
      api.prepare();
      if (!bound) {
        context.addEventListener("statechange", onState);
        document.addEventListener("visibilitychange", onWake);
        window.addEventListener("pageshow", onWake);
        bound = true;
      }
      arm();
      let resumed: Promise<void>;
      try {
        resumed = context.resume();
        if (session === "media" && !callbacks.muted()) {
          if (!media) {
            media = document.createElement("audio");
            media.src = silentDataUri();
            media.loop = true;
            media.preload = "auto";
            media.setAttribute("playsinline", "");
            media.setAttribute("webkit-playsinline", "");
            media.setAttribute("aria-hidden", "true");
            media.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
            media.addEventListener("pause", onMediaPause);
            document.body.append(media);
          }
          if (media.paused) {
            try {
              void media.play()?.then(() => publish()).catch(() => undefined);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (error) {
        return Promise.reject(error);
      }
      publish();
      return resumed.then(() => {
        if (!disposed) onState();
      });
    },
    mutedChanged() {
      if (disposed) return;
      if (callbacks.muted()) {
        media?.pause();
        publish();
      } else if (context) void api.unlock(context).catch(() => undefined);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disarm();
      context?.removeEventListener("statechange", onState);
      if (bound) {
        document.removeEventListener("visibilitychange", onWake);
        window.removeEventListener("pageshow", onWake);
      }
      if (media) {
        media.removeEventListener("pause", onMediaPause);
        media.pause();
        media.removeAttribute("src");
        media.load();
        media.remove();
        media = null;
      }
      try {
        if (audioSession?.type === "playback" && previousSessionType !== undefined) {
          audioSession.type = previousSessionType;
        }
      } catch {
        /* teardown */
      }
    },
  };
  return api;
}
