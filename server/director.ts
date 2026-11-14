/**
 * Lightweight game director — observes café metrics and injects contextual events.
 * Choices mutate operational state (layout, rush, menu, cash); the sim computes metrics.
 */
import { randomUUID } from "node:crypto";
import type { DirectorEvent, Metrics, RoomSnapshot } from "../shared/types.ts";
import { applyTransaction } from "./finance.ts";
import { placeFurniture } from "./simulation.ts";

export function maybeSpawnDirectorEvent(snapshot: RoomSnapshot, now: number): DirectorEvent | null {
  if (snapshot.director && !snapshot.director.resolved && snapshot.director.expiresAt > now) {
    return snapshot.director;
  }
  if (snapshot.phase !== "play" || !snapshot.open) return null;

  const m = snapshot.metrics;
  const roll = Math.random();

  if (m.queueLength >= 4 && roll < 0.22) {
    return event(
      "Unexpected rush",
      "A nearby office just finished a meeting. Twelve customers are arriving within minutes. Your current staffing and equipment may not keep up.",
      [
        { id: "temp_help", label: "Hire temporary help (−$120)" },
        { id: "open_station", label: "Open another service station" },
        { id: "reduce_menu", label: "Reduce the menu temporarily" },
        { id: "tough_it", label: "Handle it with existing staff" },
      ],
      "critical",
      now,
    );
  }

  if (m.satisfaction < 55 && roll < 0.15) {
    return event(
      "Reputation dip",
      "Reviews mention long waits. Regulars are hesitating. How do you recover?",
      [
        { id: "discount", label: "Offer a happy-hour discount (−$80)" },
        { id: "staff_focus", label: "Pull staff to the queue" },
        { id: "ignore", label: "Stay the course" },
      ],
      "warn",
      now,
    );
  }

  if (snapshot.finance.balance < 8000 && roll < 0.2) {
    return event(
      "Cash crunch",
      "Payroll and rent are looming. Inventory is thin. Choose carefully.",
      [
        { id: "cut_hours", label: "Shorten open hours (lower rush)" },
        { id: "delay_equip", label: "Defer equipment upgrades" },
        { id: "push_sales", label: "Focus on drink throughput" },
      ],
      "warn",
      now,
    );
  }

  if (m.customersServed > 8 && roll < 0.12) {
    return event(
      "Equipment sputter",
      "The espresso machine is sputtering. Throughput may drop unless you act.",
      [
        { id: "repair", label: "Quick repair (−$90)" },
        { id: "swap", label: "Swap to simplified menu brew" },
        { id: "run_hot", label: "Keep running it hot" },
      ],
      "info",
      now,
    );
  }

  return null;
}

function event(
  title: string,
  body: string,
  choices: DirectorEvent["choices"],
  severity: DirectorEvent["severity"],
  now: number,
): DirectorEvent {
  return {
    id: randomUUID(),
    title,
    body,
    choices,
    severity,
    createdAt: now,
    expiresAt: now + 45_000,
  };
}

/** Guaranteed rush event for `/?demo=1` — no RNG. */
export function forceDemoRushEvent(now = Date.now()): DirectorEvent {
  return event(
    "Unexpected rush",
    "A nearby office just finished a meeting. Twelve customers are arriving within minutes. Your current staffing and equipment may not keep up.",
    [
      { id: "temp_help", label: "Hire temporary help (−$120)" },
      { id: "open_station", label: "Open another service station" },
      { id: "reduce_menu", label: "Reduce the menu temporarily" },
      { id: "tough_it", label: "Handle it with existing staff" },
    ],
    "critical",
    now,
  );
}

/**
 * Apply a director choice as operational state changes only.
 * Metrics (queue, wait, revenue/hr) are recomputed by the simulation.
 */
export function applyDirectorChoice(
  snapshot: RoomSnapshot,
  choiceId: string,
): { snapshot: RoomSnapshot; photon?: string } {
  if (snapshot.director?.resolved) {
    return { snapshot };
  }

  let finance = snapshot.finance;
  let photon: string | undefined;
  const log = [...snapshot.eventLog];
  let next: RoomSnapshot = { ...snapshot };
  const property = snapshot.property;

  const charge = (label: string, amount: number, category: "wages" | "equipment" | "other" | "inventory") => {
    if (amount > 0 && finance.balance < amount) {
      log.unshift(`Can't afford ${label} — need $${amount}`);
      return false;
    }
    finance = applyTransaction(finance, label, -amount, category);
    return true;
  };

  switch (choiceId) {
    case "temp_help":
      if (!charge("Temporary barista help", 120, "wages")) break;
      // Jamie assists sooner; ease the rush pressure — sim recomputes queue
      next = {
        ...next,
        rushBoost: Math.max(0, (snapshot.rushBoost ?? 1) - 0.5),
        lastHumanInteractAt: snapshot.simTime - 10,
        aiBarista: snapshot.aiBarista ?? { holding: null },
      };
      photon = "temp barista checked in. i'll cover the overflow.";
      log.unshift("Hired temporary help (−$120) — Jamie covering harder");
      break;
    case "open_station": {
      if (!property || !snapshot.layout) {
        log.unshift("Can't open a station — no layout");
        break;
      }
      const x = Math.min(property.width - 1.2, 2.8);
      const z = Math.min(property.depth - 1.2, 6.2);
      next = placeFurniture(snapshot, "coffee_machine", x, z);
      finance = next.finance;
      photon = "second machine is live. i moved jordan to drinks.";
      log.unshift("Opened a second espresso station (placed machine)");
      break;
    }
    case "reduce_menu":
      next = { ...next, menuReduced: true };
      photon = "menu simplified — faster tickets through the line.";
      log.unshift("Temporarily reduced the menu (faster brew rate in sim)");
      break;
    case "tough_it":
      next = { ...next, rushBoost: (snapshot.rushBoost ?? 0) + 1.2 };
      photon = "we're getting slammed. pickup is backing up and milk is low.";
      log.unshift("Chose to tough out the rush — higher arrival pressure");
      break;
    case "discount":
      if (!charge("Happy-hour promo stock", 80, "other")) break;
      next = { ...next, rushBoost: Math.max(0, (snapshot.rushBoost ?? 0) - 0.15) };
      log.unshift("Launched a happy-hour discount (−$80 promo cost)");
      break;
    case "staff_focus":
      next = {
        ...next,
        rushBoost: Math.max(0, (snapshot.rushBoost ?? 0) - 0.35),
        lastHumanInteractAt: snapshot.simTime - 8,
      };
      log.unshift("Pulled staff to the queue — eased rush boost");
      break;
    case "ignore":
      log.unshift("Stayed the course on reputation");
      break;
    case "repair":
      if (!charge("Espresso machine repair", 90, "equipment")) break;
      next = { ...next, rushBoost: Math.max(0, (snapshot.rushBoost ?? 0) - 0.1) };
      log.unshift("Repaired espresso machine (−$90)");
      break;
    case "swap":
      next = { ...next, menuReduced: true };
      log.unshift("Switched to simplified menu brew");
      break;
    case "run_hot":
      next = { ...next, rushBoost: (snapshot.rushBoost ?? 0) + 0.35 };
      log.unshift("Kept the machine running hot — higher operational stress");
      break;
    case "cut_hours":
      next = { ...next, rushBoost: Math.max(0, (snapshot.rushBoost ?? 0) - 0.55) };
      log.unshift("Shortened open hours — lower arrival pressure");
      break;
    case "delay_equip":
      log.unshift("Deferred equipment upgrades");
      break;
    case "push_sales":
      // Encourage throughput via menu focus without inventing revenue
      next = { ...next, menuReduced: true };
      log.unshift("Focused on high-throughput drinks (simplified menu)");
      break;
    default:
      log.unshift(`Director choice: ${choiceId}`);
  }

  return {
    snapshot: {
      ...next,
      finance,
      eventLog: log.slice(0, 30),
      director: snapshot.director ? { ...snapshot.director, resolved: choiceId } : null,
    },
    photon,
  };
}

export function directorDifficultyHint(metrics: Metrics): string {
  if (metrics.satisfaction > 80 && metrics.queueLength < 2) {
    return "Business is humming — expect harder scenarios.";
  }
  if (metrics.satisfaction < 50) {
    return "Softening challenges while you stabilize.";
  }
  return "Balanced challenge pacing.";
}
