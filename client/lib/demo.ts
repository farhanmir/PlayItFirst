/** Judge-demo orchestration: host → available property → open café. */

export const DEMO_PROPERTY_ID = "hou-midtown-1204";
export const DEMO_PLAYER_NAME = "Judge";

/** Prefer the validated measured suite; practice mode explicitly selects Midtown. */
export const MEASURED_DEMO_PROPERTY_ID = "costar-1018657-21963212";
export function demoPropertyId(properties: { id: string; source?: string; floorPlan?: unknown }[], practice = false): string {
  const measured = properties.filter(p => p.source === "costar-extract" && !!p.floorPlan);
  if (!practice && measured.length) return measured.find(p => p.id === MEASURED_DEMO_PROPERTY_ID)?.id ?? measured[0].id;
  return properties.find(p => p.id === DEMO_PROPERTY_ID)?.id ?? properties[0]?.id ?? DEMO_PROPERTY_ID;
}

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
      return { phase, message: "Selecting the café property…" };
    case "entering":
      return { phase, message: "Preparing the café floor…" };
    case "opening":
      return { phase, message: "Unlocking the doors for service…" };
    case "ready":
      return { phase, message: "Café open. Watch Jamie serve, or take an order yourself." };
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
