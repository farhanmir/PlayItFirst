/** Judge-demo orchestration: host → available property → open café. */

export const DEMO_PROPERTY_ID = "hou-midtown-1204";
export const DEMO_PLAYER_NAME = "Judge";

/**
 * Play Demo always starts in the open-plan Midtown sample café when it is offered,
 * even when measured CoStar suites are loaded; those stay selectable on the property screen.
 */
export function demoPropertyId(properties: { id: string }[]): string {
  return properties.some((p) => p.id === DEMO_PROPERTY_ID) ? DEMO_PROPERTY_ID : properties[0]?.id ?? DEMO_PROPERTY_ID;
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
      return { phase, message: "Café open. Take your first order at the counter." };
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
