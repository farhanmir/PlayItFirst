import { afterEach, describe, expect, it, vi } from "vitest";
import { photonMessagingTransport } from "./phone-policy.ts";
import { photonConfigFromEnv } from "./photon-bridge.ts";
import { PhoneBridge, phoneConfig } from "./phone-bridge.ts";
afterEach(() => vi.unstubAllEnvs());
describe("exclusive Photon ingress policy", () => {
  it("defaults to bounded inbox and disables webhook construction", () => {
    vi.stubEnv("PHOTON_MESSAGING_TRANSPORT", "");
    expect(photonMessagingTransport()).toBe("bounded-inbox");
    expect(photonConfigFromEnv()).toBeNull();
  });
  it("never starts inbox polling in webhook mode even with complete inbox credentials", () => {
    vi.stubEnv("PHOTON_MESSAGING_TRANSPORT", "webhook");
    vi.stubEnv("PHOTON_API_KEY", "pho_sk_test");vi.stubEnv("PHOTON_PROJECT_ID", "pho_prj_00000000000000000000000001");
    vi.stubEnv("PHOTON_TEST_SENDER", "+15555550123");vi.stubEnv("PHOTON_AGENT_HANDLE", "+15555550124");
    const bridge = new PhoneBridge(phoneConfig());
    expect(bridge.status().messagingConfigured).toBe(false);
  });
  it("fails closed for an unknown transport value", () => {
    vi.stubEnv("PHOTON_MESSAGING_TRANSPORT", "both");
    expect(photonMessagingTransport()).toBe("disabled");
    expect(photonConfigFromEnv()).toBeNull();
    expect(new PhoneBridge(phoneConfig()).status().messagingConfigured).toBe(false);
  });
});
