/** Device kind detection adapted from Gitzilla client/app/device.ts (café-themed, no kaiju modes). */
export type DeviceKind = "headset" | "phone" | "desktop";

let resolved: DeviceKind | null = null;
let pending: Promise<DeviceKind> | null = null;

export const getDevice = (): DeviceKind | null => resolved;
export const isHeadset = (): boolean => resolved === "headset";

export function detectDevice(): Promise<DeviceKind> {
  return (pending ??= (async () => {
    const override = new URLSearchParams(globalThis.location?.search ?? "").get("device");
    if (override === "headset" || override === "phone" || override === "desktop") return publish(override);
    const nav = globalThis.navigator;
    const ua = nav?.userAgent ?? "";
    const candidate =
      (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 0) || /OculusBrowser|Quest|Pico/i.test(ua);
    if (candidate) {
      try {
        if (await nav?.xr?.isSessionSupported?.("immersive-vr")) return publish("headset");
      } catch {
        /* ordinary desktop/tablet */
      }
    }
    const phone =
      !!globalThis.matchMedia?.("(pointer: coarse)").matches &&
      Math.min(globalThis.innerWidth, globalThis.innerHeight) < 600;
    return publish(phone ? "phone" : "desktop");
  })());
}

function publish(kind: DeviceKind): DeviceKind {
  resolved = kind;
  return kind;
}
