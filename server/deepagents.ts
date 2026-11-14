/**
 * Hosted Deepagents-shaped director — calls an LLM when DEEPAGENTS_API_KEY /
 * OPENAI_API_KEY / ANTHROPIC_API_KEY is set; otherwise returns null so the
 * local rule director can run.
 */
import { randomUUID } from "node:crypto";
import type { DirectorEvent, RoomSnapshot } from "../shared/types.ts";

export function deepagentsConfigured(): boolean {
  return !!(
    process.env.DEEPAGENTS_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.DEEPAGENTS_URL?.trim()
  );
}

function provider(): { kind: "openai" | "anthropic" | "custom"; key: string; url: string; model: string } | null {
  const custom = process.env.DEEPAGENTS_URL?.trim();
  const deepKey = process.env.DEEPAGENTS_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (custom) {
    return {
      kind: "custom",
      key: deepKey || openai || anthropic || "",
      url: custom,
      model: process.env.DEEPAGENTS_MODEL?.trim() || "gpt-4o-mini",
    };
  }
  if (openai || deepKey) {
    return {
      kind: "openai",
      key: openai || deepKey!,
      url: "https://api.openai.com/v1/chat/completions",
      model: process.env.DEEPAGENTS_MODEL?.trim() || "gpt-4o-mini",
    };
  }
  if (anthropic) {
    return {
      kind: "anthropic",
      key: anthropic,
      url: "https://api.anthropic.com/v1/messages",
      model: process.env.DEEPAGENTS_MODEL?.trim() || "claude-3-5-haiku-latest",
    };
  }
  return null;
}

function parseEvent(text: string, now: number): DirectorEvent | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as {
      title?: string;
      body?: string;
      severity?: DirectorEvent["severity"];
      choices?: { id: string; label: string }[];
    };
    if (!raw.title || !raw.body || !raw.choices?.length) return null;
    return {
      id: randomUUID(),
      title: raw.title.slice(0, 80),
      body: raw.body.slice(0, 400),
      severity: raw.severity === "critical" || raw.severity === "warn" || raw.severity === "info" ? raw.severity : "warn",
      choices: raw.choices.slice(0, 4).map((c, i) => ({
        id: String(c.id || `choice_${i}`),
        label: String(c.label || `Option ${i + 1}`).slice(0, 60),
      })),
      createdAt: now,
      expiresAt: now + 50_000,
    };
  } catch {
    return null;
  }
}

export async function planDirectorEvent(snapshot: RoomSnapshot, now = Date.now()): Promise<DirectorEvent | null> {
  const cfg = provider();
  if (!cfg) return null;
  if (snapshot.director && !snapshot.director.resolved && snapshot.director.expiresAt > now) return null;
  if (snapshot.phase !== "play" || !snapshot.open) return null;

  const prompt = `You are the SoftOpen café Game Director (LangChain Deepagents style).
Given this café state JSON, invent ONE urgent operational event with 2-4 concrete choices that change staffing, menu, cash, or layout.
Return ONLY JSON: {"title":"...","body":"...","severity":"info|warn|critical","choices":[{"id":"snake_case","label":"..."}]}

STATE:
${JSON.stringify({
  property: snapshot.property?.name,
  metrics: snapshot.metrics,
  balance: snapshot.finance.balance,
  inventory: snapshot.inventory,
  queue: snapshot.metrics.queueLength,
  rushBoost: snapshot.rushBoost,
  players: snapshot.players.map((p) => p.role),
})}`;

  try {
    if (cfg.kind === "anthropic") {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { content?: { text?: string }[] };
      const text = body.content?.map((c) => c.text || "").join("\n") || "";
      return parseEvent(text, now);
    }

    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.7,
        messages: [
          { role: "system", content: "You output only compact JSON for game director events." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      event?: unknown;
    };
    if (body.event) return parseEvent(JSON.stringify(body.event), now);
    const text = body.choices?.[0]?.message?.content || "";
    return parseEvent(text, now);
  } catch {
    return null;
  }
}
