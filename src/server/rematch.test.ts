import { describe, expect, it, vi } from "vitest";
import { act, addBot, createRoom, getState, joinRoom, rematch, removeBot, startGame, tick, HttpError } from "./game";
import { memoryStore } from "./store";
import { defaultAction } from "@/engine/decisions";
import { waitingOn } from "@/engine/engine";

async function playOut(code: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    for (let i = 0; i < 3000; i++) {
      const row = (await memoryStore.get(code))!;
      if (row.status === "over") return;
      const seat = waitingOn(row.state!)[0];
      if (seat === undefined) { vi.setSystemTime(row.deadline! + 1); await tick(code); continue; }
      await act(code, row.lobby[seat].token, defaultAction(row.state!, seat));
    }
  } finally { vi.useRealTimers(); }
}

describe("play again and the host's lobby", () => {
  it("the host can remove any player but themselves, only in the lobby", async () => {
    const host = await createRoom("Asha");
    await joinRoom(host.code, "Troll");
    await addBot(host.code, host.token);
    const s = await getState(host.code, host.token, 0);
    expect(s.host).toBe(0);
    await expect(removeBot(host.code, host.token, 0)).rejects.toBeInstanceOf(HttpError);
    await removeBot(host.code, host.token, 1); // the human
    expect((await memoryStore.get(host.code))!.lobby).toHaveLength(2);
    expect((await memoryStore.get(host.code))!.lobby.some((p) => p.name === "Troll")).toBe(false);
  });

  it("PLAY AGAIN moves the same group to a fresh table, keeps the old log, and is idempotent", async () => {
    const host = await createRoom("Asha");
    const vik = await joinRoom(host.code, "Vik");
    for (let i = 0; i < 4; i++) await addBot(host.code, host.token);
    await expect(rematch(host.code, host.token)).rejects.toBeInstanceOf(HttpError); // not over yet
    await startGame(host.code, host.token);
    await playOut(host.code);
    await expect(rematch(host.code, vik.token)).rejects.toBeInstanceOf(HttpError); // host only
    const { code: next } = await rematch(host.code, host.token);
    expect((await rematch(host.code, host.token)).code).toBe(next);
    const old = (await memoryStore.get(host.code))!;
    expect(old.status).toBe("over");
    expect(old.state!.events.length).toBeGreaterThan(0);
    // every phone learns where the group went, and its seat token works there
    expect((await getState(host.code, vik.token, 0)).next).toBe(next);
    const fresh = await getState(next, vik.token, 0);
    expect(fresh.status).toBe("lobby");
    expect(fresh.lobby!.names.sort()).toEqual(old.lobby.map((p) => p.name).sort());
    expect(fresh.lobby!.bots.filter(Boolean)).toHaveLength(4);
    expect((await getState(next, host.token, 0)).you.host).toBe(true);
  });
});
