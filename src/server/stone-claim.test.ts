import { describe, expect, it } from "vitest";
import { addBot, claim, createRoom, getState, joinRoom, startGame } from "./game";
import { memoryStore } from "./store";
import { beliefOf } from "./belief";

describe("the Stone claim", () => {
  it("anyone can say a player has (or hasn't) a Stone; everyone sees it; it moves no bot's thief odds", async () => {
    const host = await createRoom("Asha");
    await joinRoom(host.code, "Vik");
    for (let i = 0; i < 4; i++) await addBot(host.code, host.token);
    await startGame(host.code, host.token);
    const row = (await memoryStore.get(host.code))!;
    const me = row.lobby.findIndex((p) => p.token === host.token);
    const vik = row.lobby.findIndex((p) => p.name === "Vik");
    const bot = row.lobby.findIndex((p) => p.bot);
    const before = beliefOf(row.state!, bot, row.state!.seed).p.get(vik);
    await claim(host.code, host.token, { kind: "stone", target: vik, has: true });
    const after = (await memoryStore.get(host.code))!;
    const e = after.state!.events.findLast((x) => x.type === "claim")!;
    expect(e.to).toBe("all");
    expect(e.data).toMatchObject({ seat: me, kind: "stone", target: vik, has: true, side: null });
    expect(e.msg).toBe(`Asha: "Vik has a Stone."`);
    expect(beliefOf(after.state!, bot, after.state!.seed).p.get(vik)).toBeCloseTo(before!, 10);
    const view = (await getState(host.code, host.token, 0)).view!;
    expect(view.events.some((x) => x.data?.kind === "stone")).toBe(true);
  });
});
