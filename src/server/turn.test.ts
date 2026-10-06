import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CF = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
    { urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:53?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "u", credential: "c" },
  ],
};

async function fresh() {
  vi.resetModules();
  return (await import("./turn")).iceServers;
}

describe("TURN credentials for table voice", () => {
  beforeEach(() => { vi.unstubAllEnvs(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("with no provider set, phones get STUN only", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = await (await fresh())();
    expect(r.relay).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Cloudflare: asks for short-lived servers with the secret, drops browser-blocked port 53, and reuses them", async () => {
    vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "key1");
    vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "secret");
    const fetch = vi.fn(async () => new Response(JSON.stringify(CF), { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const ice = await fresh();
    const r = await ice();
    expect(fetch).toHaveBeenCalledWith("https://rtc.live.cloudflare.com/v1/turn/keys/key1/credentials/generate-ice-servers",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer secret" }) }));
    expect(r.relay).toBe(true);
    const urls = r.iceServers.flatMap((s) => [s.urls].flat());
    expect(urls.some((u) => /:53(\?|$)/.test(u))).toBe(false);
    expect(urls).toContain("turns:turn.cloudflare.com:443?transport=tcp");
    expect(JSON.stringify(r)).not.toContain("secret");
    await ice();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("metered.ca Open Relay works as the alternative", async () => {
    vi.stubEnv("METERED_TURN_APP", "tunga");
    vi.stubEnv("METERED_TURN_API_KEY", "k");
    const fetch = vi.fn(async (url: string) => url && new Response(JSON.stringify([{ urls: "turn:global.relay.metered.ca:80", username: "u", credential: "c" }])));
    vi.stubGlobal("fetch", fetch);
    const r = await (await fresh())();
    expect(fetch.mock.calls[0][0]).toBe("https://tunga.metered.live/api/v1/turn/credentials?apiKey=k");
    expect(r.relay).toBe(true);
  });

  it("static TURN (ExpressTURN / own coturn) is passed through, and combines with another provider", async () => {
    vi.stubEnv("TURN_URLS", "turn:relay1.expressturn.com:3478, turn:relay1.expressturn.com:443?transport=tcp");
    vi.stubEnv("TURN_USERNAME", "efUSER");
    vi.stubEnv("TURN_CREDENTIAL", "pw");
    vi.stubEnv("METERED_TURN_APP", "tunga");
    vi.stubEnv("METERED_TURN_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ urls: "turn:global.relay.metered.ca:80", username: "u", credential: "c" }]))));
    const r = await (await fresh())();
    expect(r.relay).toBe(true);
    expect(r.iceServers).toContainEqual({ urls: ["turn:relay1.expressturn.com:3478", "turn:relay1.expressturn.com:443?transport=tcp"], username: "efUSER", credential: "pw" });
    expect(r.iceServers.flatMap((s) => [s.urls].flat())).toContain("turn:global.relay.metered.ca:80");
  });

  it("if the provider is down, voice falls back to STUN instead of failing", async () => {
    vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "key1");
    vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "bad");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await (await fresh())();
    expect(r.relay).toBe(false);
    expect(r.iceServers.length).toBeGreaterThan(0);
  });
});
