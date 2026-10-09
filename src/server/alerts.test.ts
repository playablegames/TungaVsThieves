import { describe, expect, it, vi } from "vitest";

const sent: { endpoint: string; body: string }[] = [];
vi.mock("./push", () => ({
  pushConfigured: true,
  sendPush: async (sub: { endpoint: string }, a: { body: string }) => { sent.push({ endpoint: sub.endpoint, body: a.body }); return true; },
}));

const { createRoom, joinRoom, setAlerts, startGame, act, getState } = await import("./game");
const { memoryStore } = await import("./store");
const { waitingOn } = await import("@/engine/engine");
const { defaultAction } = await import("@/engine/decisions");

const sub = (x: string) => ({ endpoint: `https://push.example/${x}`, keys: { p256dh: "k", auth: "a" } });

describe("turn alerts", () => {
  it("push only to a player whose move it now is AND whose phone is switched away", async () => {
    const host = await createRoom("Asha");
    const others = [];
    for (const n of ["Vik", "Meera", "Sam", "Lal"]) others.push(await joinRoom(host.code, n));
    const all = [host, ...others];
    for (const [i, p] of all.entries()) await setAlerts(host.code, p.token, { sub: sub(String(i)), hidden: i % 2 === 0 });
    expect((await getState(host.code, host.token, 0)).you.alerts).toBe(true);
    await startGame(host.code, host.token);
    // play turns until a few alerts went out
    for (let k = 0; k < 40 && sent.length < 3; k++) {
      const row = (await memoryStore.get(host.code))!;
      const seat = waitingOn(row.state!)[0];
      if (seat === undefined) break;
      await act(host.code, row.lobby[seat].token, defaultAction(row.state!, seat));
    }
    const row = (await memoryStore.get(host.code))!;
    expect(sent.length).toBeGreaterThan(0);
    for (const s of sent) {
      const seat = row.lobby.findIndex((p) => p.push?.endpoint === s.endpoint);
      expect(row.lobby[seat].hidden).toBe(true); // never to a phone that is looking at the game
    }
  });

  it("a bad subscription is refused; switching away writes only when it changes", async () => {
    const host = await createRoom("Asha");
    await expect(setAlerts(host.code, host.token, { sub: { endpoint: "http://insecure", keys: {} } })).rejects.toThrow();
    await setAlerts(host.code, host.token, { sub: sub("x"), hidden: true });
    const v = (await memoryStore.get(host.code))!.version;
    await setAlerts(host.code, host.token, { hidden: true });
    expect((await memoryStore.get(host.code))!.version).toBe(v);
  });
});
