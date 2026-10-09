import { describe, expect, it } from "vitest";
import { addBot, chat, createRoom, getState, joinRoom, startGame } from "./game";
import { memoryStore } from "./store";
import { CAPTION_PREFIX } from "@/lib/whisper";

describe("bots hear captions at a mixed table", () => {
  it("a plain accusation in a caption reaches the bots as a claim — and never the humans' screens", async () => {
    const host = await createRoom("Asha");
    const vik = await joinRoom(host.code, "Vik");
    await joinRoom(host.code, "Meera");
    for (let i = 0; i < 3; i++) await addBot(host.code, host.token);
    await startGame(host.code, host.token);
    const row = await memoryStore.get(host.code);
    const vikSeat = row!.lobby.findIndex((p) => p.name === "Vik");
    const meeraSeat = row!.lobby.findIndex((p) => p.name === "Meera");
    await chat(host.code, vik.token, `${CAPTION_PREFIX}Meera is a thief`);
    const after = (await memoryStore.get(host.code))!;
    const heard = after.state!.events.filter((e) => e.type === "claim" && e.data?.heard);
    expect(heard).toHaveLength(1);
    expect(heard[0].data).toMatchObject({ seat: vikSeat, kind: "accuse", target: meeraSeat, side: "T" });
    const bots = after.lobby.flatMap((p, i) => (p.bot ? [i] : []));
    expect(heard[0].to).toEqual(bots);
    // the humans read the caption itself; the claim is not on their screens twice
    const asha = await getState(host.code, host.token, 0);
    expect(asha.view!.events.some((e) => e.type === "claim" && e.data?.heard)).toBe(false);
    expect(asha.messages.some((m) => m.text.endsWith("Meera is a thief"))).toBe(true);
    // unclear speech is ignored
    await chat(host.code, vik.token, `${CAPTION_PREFIX}hmm I don't know`);
    expect((await memoryStore.get(host.code))!.state!.events.filter((e) => e.data?.heard)).toHaveLength(1);
  });
});
