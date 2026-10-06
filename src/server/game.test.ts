import { describe, expect, it } from "vitest";
import { act, chat, createRoom, getState, joinRoom, startGame, tick, HttpError } from "./game";
import { defaultAction } from "@/engine/decisions";
import { waitingOn } from "@/engine/engine";
import { memoryStore } from "./store";

async function room(n: number) {
  const host = await createRoom("Host");
  const tokens = [host.token];
  for (let i = 1; i < n; i++) tokens.push((await joinRoom(host.code, `P${i}`)).token);
  return { code: host.code, tokens };
}
const err = async (p: Promise<unknown>, status: number) => {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await p.catch((e) => expect(e.status).toBe(status));
};

describe("room service (memory store)", () => {
  it("create, join, start, and play a whole game through the API layer", async () => {
    const { code, tokens } = await room(6);
    await err(startGame(code, tokens[1]), 403);           // only the host starts
    await startGame(code, tokens[0]);
    await err(joinRoom(code, "Late"), 409);                // no joining once started
    for (let i = 0; i < 2000; i++) {
      const row = await memoryStore.get(code);
      if (row!.status === "over") break;
      const seat = waitingOn(row!.state!)[0];
      await act(code, row!.lobby[seat].token, defaultAction(row!.state!, seat));
    }
    const s = await getState(code, tokens[0], 0);
    expect(s.status).toBe("over");
    expect(s.view!.finalReveal).not.toBeNull();
  });

  it("a player only ever receives their own secrets", async () => {
    const { code, tokens } = await room(5);
    await startGame(code, tokens[0]);
    const row = (await memoryStore.get(code))!;
    for (let seat = 0; seat < 5; seat++) {
      const st = await getState(code, row.lobby[seat].token, 0);
      expect(st.you.seat).toBe(seat);
      expect(st.view!.me.role).toBe(row.state!.players[seat].role);
      for (const p of st.view!.players) expect(p).not.toHaveProperty("role");
      expect(st.view!.events.every((e) => e.to === "all" || e.to.includes(seat))).toBe(true);
      expect(JSON.stringify(st)).not.toContain(row.lobby[(seat + 1) % 5].token); // nobody sees another token
    }
  });

  it("rejects strangers, out-of-turn moves and illegal moves", async () => {
    const { code, tokens } = await room(4);
    await startGame(code, tokens[0]);
    await err(getState(code, "nope", 0), 403);
    const row = (await memoryStore.get(code))!;
    const turn = waitingOn(row.state!)[0];
    const notTurn = (turn + 1) % 4;
    await err(act(code, row.lobby[notTurn].token, { type: "pass", pass: [] }), 422);
    await err(act(code, row.lobby[turn].token, { type: "pass", pass: ["STONE_1", "FAISLA", "KUNDLI"] }), 422);
  });

  it("two simultaneous moves: exactly one wins, the table stays consistent", async () => {
    const { code, tokens } = await room(4);
    await startGame(code, tokens[0]);
    const row = (await memoryStore.get(code))!;
    const seat = waitingOn(row.state!)[0];
    const a = defaultAction(row.state!, seat);
    const results = await Promise.allSettled([act(code, row.lobby[seat].token, a), act(code, row.lobby[seat].token, a)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await memoryStore.get(code))!.version).toBe(row.version + 1);
  });

  it("tick does nothing before the deadline, and plays the defaults after it", async () => {
    const { code, tokens } = await room(4);
    await startGame(code, tokens[0]);
    expect((await tick(code)).applied).toBe(false);
    const row = (await memoryStore.get(code))!;
    row.deadline = Date.now() - 1;
    await memoryStore.update({ ...row }, row.version);
    expect((await tick(code)).applied).toBe(true);
    expect((await memoryStore.get(code))!.state!.events.some((e) => e.type === "timeout")).toBe(true);
  });

  it("eliminated players cannot chat", async () => {
    const { code, tokens } = await room(5);
    await startGame(code, tokens[0]);
    await chat(code, tokens[2], "hello");
    const row = (await memoryStore.get(code))!;
    const seat = row.lobby.findIndex((p) => p.token === tokens[2]);
    row.state!.players[seat].alive = false;
    await memoryStore.update({ ...row }, row.version);
    await err(chat(code, tokens[2], "boo"), 403);
    expect((await getState(code, tokens[0], 0)).messages.map((m) => m.text)).toEqual(["hello"]);
  });
});
