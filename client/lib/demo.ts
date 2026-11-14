/** Judge-demo orchestration: host → Midtown → brief messaging → open café. */

export const DEMO_PROPERTY_ID = "hou-midtown-1204";
export const DEMO_PLAYER_NAME = "Judge";

export type DemoPhase =
  | "idle"
  | "hosting"
  | "selecting"
  | "entering"
  | "opening"
  | "ready"
  | "error";

export interface DemoStatus {
  phase: DemoPhase;
  message: string;
}

export function demoStatusFor(phase: DemoPhase): DemoStatus {
  switch (phase) {
    case "hosting":
      return { phase, message: "Hosting judge room…" };
    case "selecting":
      return { phase, message: "Selecting Midtown Corner Suite…" };
    case "entering":
      return { phase, message: "Walking the Matterport floorplate…" };
    case "opening":
      return { phase, message: "Unlocking the doors for service…" };
    case "ready":
      return { phase, message: "You're live — beat the rival café." };
    case "error":
      return { phase, message: "Demo hitch — try Host café instead." };
    default:
      return { phase: "idle", message: "" };
  }
}

export function isDemoQuery(search = typeof location !== "undefined" ? location.search : ""): boolean {
  const params = new URLSearchParams(search);
  return params.get("demo") === "1" || params.get("demo") === "true";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
