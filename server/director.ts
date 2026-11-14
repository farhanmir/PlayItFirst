/**
 * Lightweight game director — LangChain Deepagents-shaped planner without requiring an API key.
 * Observes café metrics and injects contextual events with real state consequences.
 */
import { randomUUID } from "node:crypto";
import type { DirectorEvent, Metrics, RoomSnapshot } from "../shared/types.ts";

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
        { id: "discount", label: "Offer a happy-hour discount" },
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
        { id: "cut_hours", label: "Shorten open hours" },
        { id: "delay_equip", label: "Defer equipment upgrades" },
        { id: "push_sales", label: "Push high-margin drinks" },
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
        { id: "swap", label: "Swap to manual brew" },
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

export function applyDirectorChoice(
  snapshot: RoomSnapshot,
  choiceId: string,
): { snapshot: RoomSnapshot; photon?: string } {
  const finance = { ...snapshot.finance };
  const metrics = { ...snapshot.metrics };
  let photon: string | undefined;
  const log = [...snapshot.eventLog];

  switch (choiceId) {
    case "temp_help":
      finance.balance -= 120;
      finance.expenses += 120;
      metrics.queueLength = Math.max(0, metrics.queueLength - 2);
      photon = "temp barista checked in. queue should ease in a minute.";
      log.unshift("Hired temporary help (−$120)");
      snapshot = { ...snapshot, rushBoost: Math.max(0, (snapshot.rushBoost ?? 1) - 0.4) };
      break;
    case "open_station":
      metrics.queueLength = Math.max(0, metrics.queueLength - 1);
      log.unshift("Opened a second service station");
      photon = "second station is live. i moved jordan to drinks.";
      break;
    case "reduce_menu":
      metrics.avgWaitSec = Math.max(20, metrics.avgWaitSec * 0.7);
      log.unshift("Temporarily reduced the menu");
      snapshot = { ...snapshot, menuReduced: true };
      break;
    case "tough_it":
      metrics.satisfaction = Math.max(20, metrics.satisfaction - 8);
      log.unshift("Chose to tough out the rush");
      photon = "we're getting slammed. pickup is backing up and milk is low.";
      snapshot = { ...snapshot, rushBoost: (snapshot.rushBoost ?? 0) + 1.2 };
      break;
    case "discount":
      finance.balance -= 80;
      metrics.satisfaction = Math.min(100, metrics.satisfaction + 10);
      log.unshift("Launched a happy-hour discount");
      break;
    case "staff_focus":
      metrics.queueLength = Math.max(0, metrics.queueLength - 1);
      metrics.avgWaitSec = Math.max(15, metrics.avgWaitSec * 0.85);
      log.unshift("Pulled staff to the queue");
      break;
    case "repair":
      finance.balance -= 90;
      finance.expenses += 90;
      log.unshift("Repaired espresso machine (−$90)");
      break;
    case "swap":
      metrics.avgWaitSec *= 1.1;
      log.unshift("Switched to manual brew");
      break;
    case "run_hot":
      metrics.satisfaction = Math.max(20, metrics.satisfaction - 5);
      log.unshift("Kept the machine running hot");
      break;
    case "cut_hours":
      metrics.revenuePerHour *= 0.85;
      finance.expenses = Math.max(0, finance.expenses - 40);
      log.unshift("Shortened open hours");
      break;
    case "delay_equip":
      log.unshift("Deferred equipment upgrades");
      break;
    case "push_sales":
      metrics.revenuePerHour *= 1.15;
      log.unshift("Pushed high-margin drinks");
      break;
    default:
      log.unshift(`Director choice: ${choiceId}`);
  }

  return {
    snapshot: {
      ...snapshot,
      finance,
      metrics,
      eventLog: log.slice(0, 30),
      director: snapshot.director
        ? { ...snapshot.director, resolved: choiceId }
        : null,
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
