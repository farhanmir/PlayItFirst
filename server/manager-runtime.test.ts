import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatGoogle } from "@langchain/google";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { configuredModel, createManagerRunner, managerModelConfigured } from "./manager-runtime.ts";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function keys() {
  for (const key of ["GOOGLE_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPAGENTS_MODEL"]) vi.stubEnv(key, "");
}
describe("manager provider configuration", () => {
  it("recognizes Gemini alone, uses Google before its alias and other providers, and honors model overrides", () => {
    keys();
    expect(managerModelConfigured()).toBe(false);
    expect(() => configuredModel()).toThrow("No supported model key");
    vi.stubEnv("GEMINI_API_KEY", " alias-key ");
    expect(managerModelConfigured()).toBe(true);
    const alias = configuredModel() as ChatGoogle;
    expect(alias).toBeInstanceOf(ChatGoogle);
    expect(alias.apiKey).toBe("alias-key");
    expect(alias.model).toBe("gemini-3.6-flash");
    vi.stubEnv("GOOGLE_API_KEY", "google-key");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("DEEPAGENTS_MODEL", "gemini-custom-flash");
    const google = configuredModel() as ChatGoogle;
    expect(google.apiKey).toBe("google-key");
    expect(google.model).toBe("gemini-custom-flash");
  });
  it("preserves OpenAI then Anthropic selection and treats whitespace keys as absent", () => {
    keys();
    vi.stubEnv("GOOGLE_API_KEY", "  ");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    expect(configuredModel()).toBeInstanceOf(ChatOpenAI);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(configuredModel()).toBeInstanceOf(ChatAnthropic);
    expect(managerModelConfigured()).toBe(true);
  });
  it("runs Gemini tool serialization and responses through the actual Deepagents graph (mock HTTP, not live evidence)", async () => {
    keys();
    vi.stubEnv("GOOGLE_API_KEY", "synthetic-test-key");
    const responses = [
      [{ functionCall: { name: "get_cafe_state", args: {} } }],
      [{ functionCall: { name: "propose_action", args: { action: "reorder_supplies", reason: "Synthetic restock" } } }],
      [{ text: "Approve the $35 restock." }],
    ];
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
      expect(request.url).toContain("generativelanguage.googleapis.com");
      requests.push(await request.json());
      const parts = responses.shift();
      if (!parts) throw new Error("Unexpected extra model call");
      return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }] }),
        { headers: { "content-type": "application/json" } });
    }));
    const propose = vi.fn(() => ({ id: "synthetic-proposal", status: "pending", cost: 35 }));
    const execute = vi.fn();
    const runner = createManagerRunner(() => {
      const model = configuredModel();
      model.disableStreaming = true;
      return model;
    });
    const result = await runner({ prompt: "Inspect and propose a restock", history: [], signal: AbortSignal.timeout(5000),
      tools: { inspect: () => ({ synthetic: true, balance: 100, inventory: { milk: 1 } }), propose, execute, outcome: () => ({}) } });
    expect(result).toMatchObject({ summary: "Approve the $35 restock.",
      providerIdentity: { provider: "google", model: "gemini-3.6-flash" } });
    expect(JSON.stringify(result)).not.toContain("synthetic-test-key");
    expect(propose).toHaveBeenCalledWith("reorder_supplies", "Synthetic restock");
    expect(execute).not.toHaveBeenCalled();
    expect(requests).toHaveLength(3);
    const serialized = JSON.stringify(requests);
    expect(serialized).toContain("functionDeclarations");
    expect(serialized).toContain("functionResponse");
    expect(serialized).not.toContain("write_file");
  });
});
