import { describe, expect, it, vi } from "vitest";
import {
  CustomerMinds,
  customerMindsConfigured,
  grokCompleter,
  mindPrompt,
  parseDecision,
  type MindCompleter,
  type MindCustomer,
} from "./customer-mind.ts";

const MENU = ["latte", "americano", "cappuccino", "cold brew", "mocha", "espresso"];
const ava: MindCustomer = { id: "c1", name: "Ava", persona: "student", preference: "latte", budget: 6 };
const ctx = { menu: MENU, queueLength: 2, waitSec: 12 };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("parseDecision", () => {
  it("keeps valid arrive fields and drops an off-menu order", () => {
    const d = parseDecision("c1", "arrive", '{"name":"Marisol","persona":"office","order":"Mocha","line":"Big day, need fuel."}', MENU);
    expect(d).toEqual({ customerId: "c1", moment: "arrive", name: "Marisol", persona: "office", order: "mocha", line: "Big day, need fuel." });
    const off = parseDecision("c1", "arrive", '{"order":"pumpkin spice","line":"Hi"}', MENU);
    expect(off?.order).toBeUndefined();
  });

  it("clamps impatience and tips, and ignores fields for other moments", () => {
    expect(parseDecision("c1", "impatient", '{"patienceDelta":-99,"tip":4}', MENU)).toEqual({
      customerId: "c1", moment: "impatient", patienceDelta: -30,
    });
    expect(parseDecision("c1", "exit", '{"tip":20,"review":"Great crema."}', MENU)).toMatchObject({ tip: 5, review: "Great crema." });
  });

  it("tolerates prose around the JSON and rejects garbage", () => {
    expect(parseDecision("c1", "counter", 'Sure! {"order":"espresso"} thanks', MENU)?.order).toBe("espresso");
    expect(parseDecision("c1", "counter", "not json", MENU)).toBeNull();
    expect(parseDecision("c1", "counter", "{}", MENU)).toBeNull();
  });
});

describe("mindPrompt", () => {
  it("sends only generic café context", () => {
    const p = JSON.parse(mindPrompt(ava, "arrive", ctx));
    expect(Object.keys(p).sort()).toEqual(["cafe", "moment", "varietySeed", "you", "yourWaitSeconds"]);
    expect(Object.keys(p.cafe).sort()).toEqual(["menu", "queueLength"]);
  });
});

describe("CustomerMinds", () => {
  it("collects decisions asynchronously and asks each moment once", async () => {
    const complete = vi.fn<MindCompleter>(async () => '{"order":"americano","line":"Make it strong."}');
    const minds = new CustomerMinds({ complete });
    await minds.ask(ava, "counter", ctx);
    expect(minds.ask(ava, "counter", ctx)).toBeNull();
    expect(minds.drain()).toEqual([{ customerId: "c1", moment: "counter", order: "americano", line: "Make it strong." }]);
    expect(minds.drain()).toEqual([]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(minds.stats).toMatchObject({ asked: 1, answered: 1, failed: 0, skipped: 1 });
  });

  it("caps concurrent requests", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const minds = new CustomerMinds({ complete: async () => { await gate; return '{"line":"hi"}'; }, maxInFlight: 2 });
    const a = minds.ask({ ...ava, id: "a" }, "arrive", ctx);
    const b = minds.ask({ ...ava, id: "b" }, "arrive", ctx);
    expect(minds.ask({ ...ava, id: "c" }, "arrive", ctx)).toBeNull();
    release();
    await Promise.all([a, b]);
    expect(minds.ask({ ...ava, id: "c" }, "arrive", ctx)).not.toBeNull();
  });

  it("falls back silently on errors, bad replies and timeouts", async () => {
    const failing = new CustomerMinds({ complete: async () => { throw new Error("HTTP 500"); } });
    await failing.ask(ava, "arrive", ctx);
    const junk = new CustomerMinds({ complete: async () => "lol" });
    await junk.ask(ava, "arrive", ctx);
    const slow = new CustomerMinds({
      timeoutMs: 5,
      complete: (_s, _u, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
    });
    await slow.ask(ava, "arrive", ctx);
    for (const m of [failing, junk, slow]) {
      expect(m.drain()).toEqual([]);
      expect(m.stats.failed).toBe(1);
    }
    expect(slow.log[0].error).toBe("timeout");
    expect(failing.log[0].error).toBe("HTTP 500");
  });

  it("forget allows a returning customer id to be asked again", async () => {
    const minds = new CustomerMinds({ complete: async () => '{"line":"hey"}' });
    await minds.ask(ava, "arrive", ctx);
    minds.forget("c1");
    expect(minds.ask(ava, "arrive", ctx)).not.toBeNull();
    await flush();
  });
});

describe("grokCompleter", () => {
  it("posts an OpenAI-compatible JSON chat request to xAI", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"line":"ok"}' } }] })));
    const complete = grokCompleter({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await complete("sys", "user", new AbortController().signal)).toBe('{"line":"ok"}');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "grok-4.20-non-reasoning", response_format: { type: "json_object" } });
  });

  it("surfaces HTTP failures without leaking the key", async () => {
    const complete = grokCompleter({ apiKey: "secret-key", fetchImpl: (async () => new Response("no", { status: 401 })) as unknown as typeof fetch });
    await expect(complete("s", "u", new AbortController().signal)).rejects.toThrow(/HTTP 401/);
    await expect(complete("s", "u", new AbortController().signal)).rejects.not.toThrow(/secret-key/);
  });
});

describe("customerMindsConfigured", () => {
  it("needs a key and respects the off switch", () => {
    expect(customerMindsConfigured({})).toBe(false);
    expect(customerMindsConfigured({ XAI_API_KEY: "k" })).toBe(true);
    expect(customerMindsConfigured({ XAI_API_KEY: "k", CUSTOMER_MINDS: "off" })).toBe(false);
  });
});
